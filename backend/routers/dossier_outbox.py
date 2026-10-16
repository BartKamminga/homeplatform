"""Outbox router (item 1355) - eigen prefix, zodat "outbox" nooit als dossier-id wordt gelezen."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session

from core.auth import get_current_user
from core.database import get_session
from models.core import User
import services.dossier_outbox as svc

router = APIRouter(prefix="/api/dossier-outbox", tags=["dossiers"])


class OutboxIn(BaseModel):
    title: str
    summary: Optional[str] = None
    sender_role: Optional[str] = None
    received_at: Optional[datetime] = None
    value: str = "medium"
    urgency: str = "week"
    action: str = "reply"
    draft_reply: Optional[str] = None
    reason: Optional[str] = None
    source_url: Optional[str] = None
    external_ref: Optional[str] = None


class OutboxPatch(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    value: Optional[str] = None
    urgency: Optional[str] = None
    action: Optional[str] = None
    draft_reply: Optional[str] = None
    status: Optional[str] = None


class MoveIn(BaseModel):
    dossier_id: str


@router.get("")
def list_items(status: str = "open", session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    return [svc.item_to_dict(i) for i in svc.list_items(session, user, status)]


@router.post("", status_code=201)
def add_item(body: OutboxIn, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    item, created = svc.add_item(session, user, **body.model_dump())
    return {**svc.item_to_dict(item), "created": created}


@router.patch("/{item_id}")
def update_item(
    item_id: str, body: OutboxPatch,
    session: Session = Depends(get_session), user: User = Depends(get_current_user),
):
    return svc.item_to_dict(svc.update_item(session, user, item_id, **body.model_dump()))


@router.post("/{item_id}/to-dossier")
def move_to_dossier(
    item_id: str, body: MoveIn,
    session: Session = Depends(get_session), user: User = Depends(get_current_user),
):
    return svc.item_to_dict(svc.move_to_dossier(session, user, item_id, body.dossier_id))
