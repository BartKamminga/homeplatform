import json
from datetime import datetime, timezone
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
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    stmt = (
        select(DataCapture)
        .where(DataCapture.source == source)
        .order_by(col(DataCapture.captured_at).desc())
        .limit(limit * 20)          # over-fetch so we can group client-side
    )
    rows = session.exec(stmt).all()

    # Group by session_id, keeping earliest captured_at per session
    sessions: dict = {}
    for row in rows:
        sid = row.session_id
        if sid not in sessions:
            meta = json.loads(row.meta)
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

    result = []
    for s in sessions.values():
        s["competitions"] = sorted(s["competitions"])
        result.append(s)
        if len(result) >= limit:
            break

    return {"sessions": result}


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


# ── POST /api/capture/reprocess ───────────────────────────────────────────────

class ReprocessBody(BaseModel):
    session_id: Optional[str] = None
    capture_id: Optional[str] = None


@router.post("/reprocess")
def reprocess(body: ReprocessBody, session: Session = Depends(get_session), _=Depends(get_current_user)):
    """Herverwerk gearchiveerde poule-captures via de discovery-parser."""
    from routers.hockey_discovery import _parse_raw_poule, _call_poule_capture

    if body.session_id:
        captures = session.exec(
            select(DataCapture)
            .where(DataCapture.session_id == body.session_id)
            .where(DataCapture.capture_type == "poule_capture")
        ).all()
    elif body.capture_id:
        cap = session.get(DataCapture, body.capture_id)
        captures = [cap] if cap and cap.capture_type == "poule_capture" else []
    else:
        return {"ok": 0, "failed": 0, "errors": []}

    ok = 0
    failed = 0
    errors: List[str] = []
    for capture in captures:
        try:
            raw = json.loads(capture.payload)
            poule_id = int(capture.external_id.replace("poule_capture_", ""))
            params = {"poule_id": poule_id}
            capture_body = _parse_raw_poule(raw, params)
            if not capture_body:
                failed += 1
                errors.append(f"{capture.external_id}: parse mislukt")
                continue
            _call_poule_capture(capture_body, session)
            session.commit()
            ok += 1
        except Exception as e:
            session.rollback()
            failed += 1
            errors.append(f"{capture.external_id}: {str(e)}")

    return {"ok": ok, "failed": failed, "errors": errors[:10]}
