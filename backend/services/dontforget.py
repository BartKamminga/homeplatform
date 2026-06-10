from datetime import datetime

from sqlmodel import Session, select

from core.exceptions import AppError
from models.core import User
from models.dontforget import Task


def get_tasks(session: Session, user: User, done: bool | None = None) -> list[Task]:
    query = select(Task).where(Task.user_id == user.id, Task.deleted_at.is_(None))
    if done is not None:
        query = query.where(Task.done == done)
    return list(session.exec(query.order_by(Task.created_at.desc())).all())


def create_task(session: Session, user: User, **fields) -> Task:
    task = Task(user_id=user.id, **fields)
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


def update_task(session: Session, user: User, task_id: str, updates: dict) -> Task:
    task = session.get(Task, task_id)
    if not task or task.deleted_at is not None:
        raise AppError("Taak niet gevonden", status_code=404)
    if task.user_id != user.id:
        raise AppError("Geen toegang", status_code=403)
    for field, value in updates.items():
        setattr(task, field, value)
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


def complete_task(session: Session, user: User, task_id: str) -> Task:
    task = session.get(Task, task_id)
    if not task or task.deleted_at is not None:
        raise AppError("Taak niet gevonden", status_code=404)
    task.done = True
    task.completed_at = datetime.utcnow()
    task.completed_by = user.id
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


def delete_task(session: Session, user: User, task_id: str) -> str:
    """Soft delete — markeert de taak als verwijderd. Geeft de taaktitel terug."""
    task = session.get(Task, task_id)
    if not task or task.deleted_at is not None:
        raise AppError("Taak niet gevonden", status_code=404)
    if task.user_id != user.id:
        raise AppError("Geen toegang", status_code=403)
    task.deleted_at = datetime.utcnow()
    session.add(task)
    session.commit()
    return task.title
