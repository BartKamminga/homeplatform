from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session

from core.auth import get_current_user
from core.database import get_session
from core.logging import log_action
from models.core import User
import services.mindbox_deadlines as svc

# Los router-bestand (i.p.v. toevoegen aan het al 400+ regels tellende
# routers/mindbox.py) - zie CLAUDE.md bestandsgrens-afspraak, item 1117.
router = APIRouter(prefix="/api/mindbox", tags=["mindbox"])


class MindboxDeadlineOut(BaseModel):
    id:          str
    date:        date
    title:       str
    description: Optional[str]
    case_id:     Optional[str]
    created_at:  datetime
    updated_at:  datetime


class MindboxDeadlineCreate(BaseModel):
    date:        date
    title:       str
    description: Optional[str] = None
    case_id:     Optional[str] = None


class MindboxDeadlineUpdate(BaseModel):
    date:        Optional[date] = None
    title:       Optional[str] = None
    description: Optional[str] = None
    case_id:     Optional[str] = None
    clear_case:  bool = False


@router.get("/deadlines", response_model=list[MindboxDeadlineOut])
def list_deadlines(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return svc.get_deadlines(session, user)


@router.post("/deadlines", response_model=MindboxDeadlineOut)
def create_deadline(
    data: MindboxDeadlineCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    deadline = svc.create_deadline(session, user, data.date, data.title, data.description, data.case_id)
    log_action(session, "mindbox.deadline.create", site="mindbox", user_id=user.id,
               payload={"deadline_id": deadline.id, "date": str(deadline.date)})
    return deadline


@router.patch("/deadlines/{deadline_id}", response_model=MindboxDeadlineOut)
def update_deadline(
    deadline_id: str,
    data: MindboxDeadlineUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    deadline = svc.update_deadline(
        session, user, deadline_id, data.date, data.title, data.description, data.case_id, data.clear_case,
    )
    log_action(session, "mindbox.deadline.update", site="mindbox", user_id=user.id,
               payload={"deadline_id": deadline.id})
    return deadline


@router.delete("/deadlines/{deadline_id}")
def delete_deadline(
    deadline_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    svc.delete_deadline(session, user, deadline_id)
    log_action(session, "mindbox.deadline.delete", site="mindbox", user_id=user.id,
               payload={"deadline_id": deadline_id})
    return {"ok": True}
