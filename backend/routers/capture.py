import json
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.capture import DataCapture, new_uuid

router = APIRouter(prefix="/api/capture", tags=["capture"])


# ── Request models ────────────────────────────────────────────────────────────

class ArchiveItem(BaseModel):
    external_id: str
    capture_type: str          # 'poule'
    payload: dict              # full API JSON
    meta: dict                 # normalized summary


class ArchiveBody(BaseModel):
    source: str                # 'hockey-vanger'
    session_id: str
    items: List[ArchiveItem]


# ── POST /api/capture/archive ─────────────────────────────────────────────────

@router.post("/archive")
def archive(body: ArchiveBody, session: Session = Depends(get_session), _=Depends(get_current_user)):
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Build set of already-stored (session_id, external_id) pairs so duplicate
    # calls from the same popup session are idempotent.
    existing = set(
        session.exec(
            select(col(DataCapture.external_id))
            .where(DataCapture.session_id == body.session_id)
        ).all()
    )

    created = 0
    for item in body.items:
        if item.external_id in existing:
            continue
        capture = DataCapture(
            id=new_uuid(),
            source=body.source,
            capture_type=item.capture_type,
            external_id=item.external_id,
            session_id=body.session_id,
            payload=json.dumps(item.payload, ensure_ascii=False),
            meta=json.dumps(item.meta, ensure_ascii=False),
            captured_at=now,
        )
        session.add(capture)
        created += 1

    session.commit()
    return {"created": created, "skipped": len(body.items) - created}


# ── GET /api/capture/sessions ─────────────────────────────────────────────────

@router.get("/sessions")
def list_sessions(
    source: Optional[str] = "hockey-vanger",
    limit: int = 50,
    offset: int = 0,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    stmt = (
        select(DataCapture)
        .where(DataCapture.source == source)
        .order_by(col(DataCapture.captured_at).desc())
        .limit((offset + limit + 1) * 20)          # over-fetch so we can group client-side
    )
    rows = session.exec(stmt).all()

    # Group by session_id, keeping earliest captured_at per session
    sessions: dict = {}
    order: List[str] = []
    for row in rows:
        sid = row.session_id
        if sid not in sessions:
            order.append(sid)
            sessions[sid] = {
                "session_id": sid,
                "captured_at": row.captured_at.isoformat(),
                "item_count": 0,
                "competitions": set(),
            }
        sessions[sid]["item_count"] += 1
        try:
            m = json.loads(row.meta)
            comp = m.get("competition", "")
            if comp:
                sessions[sid]["competitions"].add(comp)
        except Exception:
            pass

    page_ids = order[offset:offset + limit]
    result = []
    for sid in page_ids:
        s = sessions[sid]
        s["competitions"] = sorted(s["competitions"])
        result.append(s)

    return {"sessions": result, "has_more": len(order) > offset + limit}


# ── GET /api/capture/sessions/{session_id}/items ──────────────────────────────

@router.get("/sessions/{session_id}/items")
def session_items(
    session_id: str,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    rows = session.exec(
        select(DataCapture)
        .where(DataCapture.session_id == session_id)
        .order_by(col(DataCapture.captured_at).asc())
    ).all()

    if not rows:
        raise HTTPException(404, "Sessie niet gevonden")

    items = []
    for row in rows:
        items.append({
            "id": row.id,
            "external_id": row.external_id,
            "capture_type": row.capture_type,
            "captured_at": row.captured_at.isoformat(),
            "meta": json.loads(row.meta),
            "payload": json.loads(row.payload) if row.payload else None,
        })

    return {"items": items}


# ── DELETE /api/capture/sessions/{session_id} ─────────────────────────────────

@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    rows = session.exec(select(DataCapture).where(DataCapture.session_id == session_id)).all()
    if not rows:
        raise HTTPException(404, "Sessie niet gevonden")
    for row in rows:
        session.delete(row)
    session.commit()
    return {"deleted": len(rows)}


# ── DELETE /api/capture/sessions?older_than_days=N ────────────────────────────

@router.delete("/sessions")
def delete_old_sessions(
    older_than_days: int,
    source: Optional[str] = "hockey-vanger",
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=older_than_days)
    rows = session.exec(
        select(DataCapture)
        .where(DataCapture.source == source)
        .where(DataCapture.captured_at < cutoff)
    ).all()
    for row in rows:
        session.delete(row)
    session.commit()
    return {"deleted": len(rows)}


# ── POST /api/capture/reprocess ───────────────────────────────────────────────

class ReprocessBody(BaseModel):
    session_id: Optional[str] = None
    capture_id: Optional[str] = None


REPROCESSABLE = ("poule_capture", "comp_detail", "clubs_list", "club_detail")


@router.post("/reprocess")
def reprocess(body: ReprocessBody, session: Session = Depends(get_session), _=Depends(get_current_user)):
    """Herverwerk gearchiveerde captures (poule_capture en comp_detail) via de discovery-parser."""
    from routers.hockey_vanger import (
        _parse_raw_poule, _call_poule_capture, _call_competition_detail,
        _call_clubs_list_raw, _call_club_detail_raw,
    )

    if body.session_id:
        captures = session.exec(
            select(DataCapture)
            .where(DataCapture.session_id == body.session_id)
            .where(DataCapture.capture_type.in_(REPROCESSABLE))
        ).all()
    elif body.capture_id:
        cap = session.get(DataCapture, body.capture_id)
        captures = [cap] if cap and cap.capture_type in REPROCESSABLE else []
    else:
        return {"ok": 0, "failed": 0, "errors": []}

    ok = 0
    failed = 0
    errors: List[str] = []
    for capture in captures:
        try:
            raw = json.loads(capture.payload)
            if capture.capture_type == "poule_capture":
                poule_id = int(capture.external_id.replace("poule_capture_", ""))
                capture_body = _parse_raw_poule(raw, {"poule_id": poule_id})
                if not capture_body:
                    failed += 1
                    errors.append(f"{capture.external_id}: parse mislukt")
                    continue
                _call_poule_capture(capture_body, session)
            elif capture.capture_type == "comp_detail":
                comp_id = int(capture.external_id.replace("comp_detail_", ""))
                result = _call_competition_detail(raw, session, {"comp_id": comp_id})
                if not result:
                    failed += 1
                    errors.append(f"{capture.external_id}: parse mislukt")
                    continue
            elif capture.capture_type == "clubs_list":
                raw_list = raw if isinstance(raw, list) else raw.get("clubs", [])
                _call_clubs_list_raw(raw_list, session)
            elif capture.capture_type == "club_detail":
                result = _call_club_detail_raw(raw, session)
                if not result:
                    failed += 1
                    errors.append(f"{capture.external_id}: parse mislukt")
                    continue
            session.commit()
            ok += 1
        except Exception as e:
            session.rollback()
            failed += 1
            errors.append(f"{capture.external_id}: {str(e)}")

    return {"ok": ok, "failed": failed, "errors": errors[:10]}
