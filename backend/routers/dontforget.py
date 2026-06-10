from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session

from core.database import get_session
from core.auth import get_current_user
from core.limiter import limiter
from core.logging import log_action
from models.core import User
import services.dontforget as svc

router = APIRouter(prefix="/api/dontforget", tags=["dontforget"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TaskCreate(BaseModel):
    title:        str = Field(..., min_length=1, max_length=200)
    photo_path:   Optional[str] = None
    when:         str = "morning"
    repeat:       str = "once"
    day_of_week:  Optional[int] = None
    priority:     str = "normal"
    source:       str = "user"
    group_id:     Optional[str] = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Titel mag niet leeg zijn")
        return v


class TaskUpdate(BaseModel):
    title:        Optional[str] = None
    photo_path:   Optional[str] = None
    when:         Optional[str] = None
    repeat:       Optional[str] = None
    day_of_week:  Optional[int] = None
    priority:     Optional[str] = None
    done:         Optional[bool] = None
    group_id:     Optional[str] = None


class TaskOut(BaseModel):
    id:           str
    title:        str
    photo_path:   Optional[str]
    when:         str
    repeat:       str
    day_of_week:  Optional[int]
    priority:     str
    done:         bool
    source:       str
    created_at:   datetime
    completed_at: Optional[datetime]
    completed_by: Optional[str]
    user_id:      str
    group_id:     Optional[str]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/tasks", response_model=list[TaskOut])
@limiter.limit("120/minute")
def list_tasks(
    request: Request,
    done: Optional[bool] = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return svc.get_tasks(session, user, done)


@router.post("/tasks", response_model=TaskOut)
@limiter.limit("30/minute")
def create_task(
    request: Request,
    data: TaskCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    task = svc.create_task(session, user, **data.model_dump())
    log_action(session, "task.create", site="dontforget", user_id=user.id,
               payload={"task_id": task.id, "title": task.title})
    return task


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: str,
    data: TaskUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    task = svc.update_task(session, user, task_id, data.model_dump(exclude_unset=True))
    log_action(session, "task.update", site="dontforget", user_id=user.id,
               payload={"task_id": task.id, "fields": list(data.model_dump(exclude_unset=True))})
    return task


@router.post("/tasks/{task_id}/complete", response_model=TaskOut)
def complete_task(
    task_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    task = svc.complete_task(session, user, task_id)
    log_action(session, "task.complete", site="dontforget", user_id=user.id,
               payload={"task_id": task.id, "title": task.title})
    return task


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    title = svc.delete_task(session, user, task_id)
    log_action(session, "task.delete", site="dontforget", user_id=user.id,
               payload={"task_id": task_id, "title": title})
    return {"ok": True}
