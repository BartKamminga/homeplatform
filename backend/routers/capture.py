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
        })

    return {"items": items}
