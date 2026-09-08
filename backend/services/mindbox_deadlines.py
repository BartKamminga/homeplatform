from datetime import date as date_type, datetime
from typing import Optional

from sqlmodel import Session, col, select

from core.exceptions import AppError
from models.core import User
from models.mindbox import MindboxCase
from models.mindbox_deadlines import MindboxDeadline


def _owns(deadline: MindboxDeadline, user: User) -> None:
    if deadline.user_id != user.id:
        raise AppError("Geen toegang", status_code=403)


def _check_case(session: Session, user: User, case_id: Optional[str]) -> None:
    if case_id is None:
        return
    case = session.get(MindboxCase, case_id)
    if not case or case.user_id != user.id:
        raise AppError("Case niet gevonden", status_code=404)


def get_deadlines(session: Session, user: User) -> list[MindboxDeadline]:
    return list(session.exec(
        select(MindboxDeadline)
        .where(MindboxDeadline.user_id == user.id)
        .order_by(col(MindboxDeadline.date).asc())
    ).all())


def get_deadline(session: Session, user: User, deadline_id: str) -> MindboxDeadline:
    deadline = session.get(MindboxDeadline, deadline_id)
    if not deadline:
        raise AppError("Deadline niet gevonden", status_code=404)
    _owns(deadline, user)
    return deadline


def create_deadline(
    session: Session, user: User, date: date_type, title: str,
    description: Optional[str], case_id: Optional[str],
) -> MindboxDeadline:
    _check_case(session, user, case_id)
    deadline = MindboxDeadline(
        user_id=user.id, date=date, title=title, description=description, case_id=case_id,
    )
    session.add(deadline)
    session.commit()
    session.refresh(deadline)
    return deadline


def update_deadline(
    session: Session, user: User, deadline_id: str, date: Optional[date_type], title: Optional[str],
    description: Optional[str], case_id: Optional[str], clear_case: bool,
) -> MindboxDeadline:
    deadline = get_deadline(session, user, deadline_id)
    if date is not None:
        deadline.date = date
    if title is not None:
        deadline.title = title
    if description is not None:
        deadline.description = description
    if clear_case:
        deadline.case_id = None
    elif case_id is not None:
        _check_case(session, user, case_id)
        deadline.case_id = case_id
    deadline.updated_at = datetime.utcnow()
    session.add(deadline)
    session.commit()
    session.refresh(deadline)
    return deadline


def delete_deadline(session: Session, user: User, deadline_id: str) -> None:
    deadline = get_deadline(session, user, deadline_id)
    session.delete(deadline)
    session.commit()
