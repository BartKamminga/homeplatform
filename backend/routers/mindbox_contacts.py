from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session

from core.auth import get_current_user
from core.database import get_session
from core.logging import log_action
from models.core import User
from routers.mindbox import MindboxItemOut
import services.mindbox_contacts as svc

# Los router-bestand (i.p.v. toevoegen aan het al 380+ regels tellende
# routers/mindbox.py) - zie CLAUDE.md bestandsgrens-afspraak, item 1052.
router = APIRouter(prefix="/api/mindbox", tags=["mindbox"])


class MindboxContactOut(BaseModel):
    id:            str
    email:         str
    display_name:  Optional[str]
    notes:         Optional[str]
    created_at:    datetime
    updated_at:    datetime


class MindboxContactCreate(BaseModel):
    email:         str
    display_name:  Optional[str] = None


class MindboxContactUpdate(BaseModel):
    display_name:  Optional[str] = None
    notes:         Optional[str] = None


class MindboxItemContactLink(BaseModel):
    email:         str
    display_name:  Optional[str] = None


@router.get("/contacts", response_model=list[MindboxContactOut])
def list_contacts(
    email: Optional[str] = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return svc.get_contacts(session, user, email)


@router.post("/contacts", response_model=MindboxContactOut)
def create_contact(
    data: MindboxContactCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    contact = svc.find_or_create_contact(session, user, data.email, data.display_name)
    log_action(session, "mindbox.contact.create", site="mindbox", user_id=user.id,
               payload={"contact_id": contact.id, "email": contact.email})
    return contact


@router.patch("/contacts/{contact_id}", response_model=MindboxContactOut)
def update_contact(
    contact_id: str,
    data: MindboxContactUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    contact = svc.update_contact(session, user, contact_id, data.display_name, data.notes)
    log_action(session, "mindbox.contact.update", site="mindbox", user_id=user.id,
               payload={"contact_id": contact.id, "fields": list(data.model_dump(exclude_unset=True))})
    return contact


@router.delete("/contacts/{contact_id}")
def delete_contact(
    contact_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    svc.delete_contact(session, user, contact_id)
    log_action(session, "mindbox.contact.delete", site="mindbox", user_id=user.id, payload={"contact_id": contact_id})
    return {"ok": True}


@router.post("/items/{item_id}/contact", response_model=MindboxItemOut)
def link_item_contact(
    item_id: str,
    data: MindboxItemContactLink,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    item = svc.link_item_contact(session, user, item_id, data.email, data.display_name)
    log_action(session, "mindbox.item.contact_link", site="mindbox", user_id=user.id,
               payload={"item_id": item_id, "contact_ids": item["contact_ids"], "email": data.email})
    return item


@router.delete("/items/{item_id}/contact/{contact_id}", response_model=MindboxItemOut)
def unlink_item_contact(
    item_id: str,
    contact_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    item = svc.unlink_item_contact(session, user, item_id, contact_id)
    log_action(session, "mindbox.item.contact_unlink", site="mindbox", user_id=user.id,
               payload={"item_id": item_id, "contact_id": contact_id})
    return item
