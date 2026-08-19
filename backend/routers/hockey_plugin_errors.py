"""Hockey — plugin-error-logging (hockey-vanger extensie) - verplaatst uit
routers/hockey_capture.py (item 697)."""

import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.capture import DataCapture, new_uuid

router = APIRouter(prefix="/api/hockey", tags=["hockey-plugin-errors"])


class PluginErrorIn(BaseModel):
    message:    str
    context:    Optional[str] = None
    url:        Optional[str] = None
    session_id: Optional[str] = None


@router.post("/plugin-error")
def log_plugin_error(
    body: PluginErrorIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    session.add(DataCapture(
        id=new_uuid(),
        source="hockey-vanger",
        capture_type="plugin_error",
        external_id="plugin_error",
        session_id=body.session_id,
        payload=body.message,
        meta=json.dumps({
            "context": body.context,
            "url":     body.url,
        }, ensure_ascii=False),
        captured_at=now,
    ))
    session.commit()
    return {"ok": True}


@router.get("/plugin-errors")
def get_plugin_errors(
    limit: int = 50,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    rows = session.exec(
        select(DataCapture)
        .where(DataCapture.source == "hockey-vanger")
        .where(DataCapture.capture_type == "plugin_error")
        .order_by(col(DataCapture.captured_at).desc())
        .limit(limit)
    ).all()
    return {
        "total": len(rows),
        "errors": [
            {
                "id":         r.id,
                "message":    r.payload,
                "meta":       json.loads(r.meta or "{}"),
                "session_id": r.session_id,
                "captured_at": r.captured_at.isoformat(),
            }
            for r in rows
        ],
    }


@router.delete("/plugin-errors")
def clear_plugin_errors(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    rows = session.exec(
        select(DataCapture)
        .where(DataCapture.source == "hockey-vanger")
        .where(DataCapture.capture_type == "plugin_error")
    ).all()
    count = len(rows)
    for r in rows:
        session.delete(r)
    session.commit()
    return {"deleted": count}
