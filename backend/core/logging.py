from datetime import datetime
from typing import Optional
from sqlmodel import Session

from models.core import AuditLog


def log_action(
    session: Session,
    action: str,
    user_id: Optional[str] = None,
    site: Optional[str] = "admin",
    payload: Optional[dict] = None,
) -> None:
    """Schrijf een actie naar de audit log."""
    entry = AuditLog(
        user_id=user_id,
        site=site,
        action=action,
        payload=payload,
        created_at=datetime.utcnow(),
    )
    session.add(entry)
    session.commit()
