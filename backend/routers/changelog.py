from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from core.database import get_session
from core.auth import require_admin
from core.logging import log_action
from models.core import User
from models.changelog import ChangelogEntry

router = APIRouter(tags=["changelog"])


class ChangelogOut(BaseModel):
    id: str
    version: str
    site: str
    title: str
    description: Optional[str]
    released_at: datetime
    created_at: datetime


class ChangelogCreate(BaseModel):
    version: str
    site: str = "core"
    title: str
    description: Optional[str] = None
    released_at: Optional[datetime] = None


# Publiek endpoint — geen auth nodig
@router.get("/api/changelog", response_model=list[ChangelogOut])
def public_changelog(
    site: Optional[str] = None,
    session: Session = Depends(get_session),
):
    q = select(ChangelogEntry)
    if site:
        q = q.where(ChangelogEntry.site == site)
    return session.exec(q.order_by(ChangelogEntry.released_at.desc())).all()


# Admin endpoints
@router.get("/api/admin/changelog", response_model=list[ChangelogOut])
def list_changelog(
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    return session.exec(
        select(ChangelogEntry).order_by(ChangelogEntry.released_at.desc())
    ).all()


@router.post("/api/admin/changelog", response_model=ChangelogOut, status_code=201)
def create_entry(
    data: ChangelogCreate,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    entry = ChangelogEntry(
        version=data.version,
        site=data.site,
        title=data.title,
        description=data.description,
        released_at=data.released_at or datetime.utcnow(),
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    log_action(session, "changelog.create", user_id=admin.id,
               payload={"version": data.version, "site": data.site})
    return entry


