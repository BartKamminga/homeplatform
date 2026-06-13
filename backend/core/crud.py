from typing import Any

from fastapi import HTTPException
from sqlmodel import Session, select


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
