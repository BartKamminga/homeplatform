from fastapi import APIRouter, Depends, HTTPException
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


class ChangelogUpdate(BaseModel):
    version: Optional[str] = None
    site: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    released_at: Optional[datetime] = None


# Publiek endpoint — geen auth nodig
@router.get("/api/changelog", response_model=list[ChangelogOut])
def public_changelog(session: Session = Depends(get_session)):
    return session.exec(
        select(ChangelogEntry).order_by(ChangelogEntry.released_at.desc())
    ).all()


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


@router.patch("/api/admin/changelog/{entry_id}", response_model=ChangelogOut)
def update_entry(
    entry_id: str,
    data: ChangelogUpdate,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    entry = session.get(ChangelogEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry niet gevonden")

    if data.version is not None:     entry.version = data.version
    if data.site is not None:        entry.site = data.site
    if data.title is not None:       entry.title = data.title
    if data.description is not None: entry.description = data.description
    if data.released_at is not None: entry.released_at = data.released_at

    session.add(entry)
    session.commit()
    session.refresh(entry)
    log_action(session, "changelog.update", user_id=admin.id,
               payload={"id": entry_id})
    return entry


@router.delete("/api/admin/changelog/{entry_id}")
def delete_entry(
    entry_id: str,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    entry = session.get(ChangelogEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry niet gevonden")
    session.delete(entry)
    session.commit()
    log_action(session, "changelog.delete", user_id=admin.id,
               payload={"id": entry_id})
    return {"message": "Entry verwijderd"}
