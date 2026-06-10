from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from core.database import get_session
from core.auth import get_current_user
from models.core import User
from models.dontforget import Task

router = APIRouter(prefix="/api/dontforget", tags=["dontforget"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TaskCreate(BaseModel):
    title:        str
    photo_path:   Optional[str] = None
    when:         str = "morning"
    repeat:       str = "once"
    day_of_week:  Optional[int] = None
    priority:     str = "normal"
    source:       str = "user"
    group_id:     Optional[str] = None


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
def list_tasks(
    done: Optional[bool] = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Haal alle taken op voor de huidige gebruiker en zijn groepen."""
    query = select(Task).where(Task.user_id == user.id)
    if done is not None:
        query = query.where(Task.done == done)
    query = query.order_by(Task.created_at.desc())
    return session.exec(query).all()


@router.post("/tasks", response_model=TaskOut)
def create_task(
    data: TaskCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    task = Task(
        title=data.title,
        photo_path=data.photo_path,
        when=data.when,
        repeat=data.repeat,
        day_of_week=data.day_of_week,
        priority=data.priority,
        source=data.source,
        group_id=data.group_id,
        user_id=user.id,
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: str,
    data: TaskUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Taak niet gevonden")
    if task.user_id != user.id:
        raise HTTPException(status_code=403, detail="Geen toegang")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.post("/tasks/{task_id}/complete", response_model=TaskOut)
def complete_task(
    task_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Taak niet gevonden")

    task.done         = True
    task.completed_at = datetime.utcnow()
    task.completed_by = user.id

    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Taak niet gevonden")
    if task.user_id != user.id:
        raise HTTPException(status_code=403, detail="Geen toegang")

    session.delete(task)
    session.commit()
    return {"ok": True}
