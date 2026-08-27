from typing import Any

from fastapi import HTTPException
from sqlmodel import Session, select

from models.core import UserPreference


def get_or_create_user_pref(session: Session, user_id: str) -> UserPreference:
    """Fetch a user's UserPreference row, creating an empty one if it doesn't exist yet."""
    row = session.exec(select(UserPreference).where(UserPreference.user_id == user_id)).first()
    if not row:
        row = UserPreference(user_id=user_id, extra={})
        session.add(row)
        session.flush()
    return row


def get_or_404(session: Session, model: type, id: Any, label: str = "Item") -> Any:
    """Fetch a row by primary key or raise HTTP 404."""
    item = session.get(model, id)
    if not item:
        raise HTTPException(status_code=404, detail=f"{label} niet gevonden")
    return item


def ensure_unique(session: Session, model: type, field: Any, value: Any, label: str = "Item") -> None:
    """Raise HTTP 400 when a row matching field == value already exists."""
    existing = session.exec(select(model).where(field == value)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"{label} bestaat al")
