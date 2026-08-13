import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from core.database import get_session
from core.auth import get_current_user
from core.crud import get_or_404
from models.core import RoadmapItem, RoadmapHistory, User
from models.changelog import ChangelogEntry

router = APIRouter(prefix="/api/roadmap", tags=["roadmap"])


class RoadmapItemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    site: str = "platform"
    priority: str = "medium"
    status: str = "idea"
    notes: Optional[str] = None
    version: Optional[str] = None
    impact: Optional[str] = None
    risk: Optional[str] = None
    scope: Optional[str] = None
    owner: Optional[str] = None
    images: Optional[str] = None


class RoadmapItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    site: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    version: Optional[str] = None
    impact: Optional[str] = None
    risk: Optional[str] = None
    scope: Optional[str] = None
    owner: Optional[str] = None
    images: Optional[str] = None


def _maybe_create_changelog(item: RoadmapItem, session: Session) -> None:
    if item.status != "done" or not item.version:
        return
    existing = session.exec(
        select(ChangelogEntry).where(
            ChangelogEntry.site == item.site,
            ChangelogEntry.version == item.version,
            ChangelogEntry.title == item.title,
        )
    ).first()
    if existing:
        return
    entry = ChangelogEntry(
        version=item.version,
        site=item.site,
        title=item.title,
        description=item.notes or item.description,
        released_at=datetime.utcnow(),
    )
    session.add(entry)


def _log_history(item: RoadmapItem, action: str, changes: dict, user: User, session: Session) -> None:
    record = RoadmapHistory(
        item_id=item.id,
        username=user.username,
        action=action,
        changes=json.dumps(changes, ensure_ascii=False) if changes else None,
    )
    session.add(record)


@router.get("", response_model=List[RoadmapItem])
def list_items(
    site: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    q = select(RoadmapItem)
    if site:
        q = q.where(RoadmapItem.site == site)
    if status:
        q = q.where(RoadmapItem.status == status)
    if priority:
        q = q.where(RoadmapItem.priority == priority)
    q = q.order_by(RoadmapItem.created_at.desc())
    return session.exec(q).all()


@router.get("/{item_id}", response_model=RoadmapItem)
def get_item(
    item_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return get_or_404(session, RoadmapItem, item_id, "RoadmapItem")


@router.get("/{item_id}/history", response_model=List[RoadmapHistory])
def get_item_history(
    item_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    get_or_404(session, RoadmapItem, item_id, "RoadmapItem")
    return session.exec(
        select(RoadmapHistory)
        .where(RoadmapHistory.item_id == item_id)
        .order_by(RoadmapHistory.created_at.asc())
    ).all()


@router.post("", response_model=RoadmapItem)
def create_item(
    body: RoadmapItemCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    item = RoadmapItem(**body.model_dump())
    session.add(item)
    session.flush()
    _maybe_create_changelog(item, session)
    _log_history(item, "created", {k: {"from": None, "to": v} for k, v in body.model_dump().items() if v is not None}, user, session)
    session.commit()
    session.refresh(item)
    return item


@router.patch("/{item_id}", response_model=RoadmapItem)
def update_item(
    item_id: int,
    body: RoadmapItemUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    item = get_or_404(session, RoadmapItem, item_id, "RoadmapItem")
    data = body.model_dump(exclude_unset=True)
    changes = {k: {"from": getattr(item, k), "to": v} for k, v in data.items() if getattr(item, k) != v}
    for k, v in data.items():
        setattr(item, k, v)
    item.updated_at = datetime.utcnow()
    session.add(item)
    _maybe_create_changelog(item, session)
    action = "closed" if data.get("status") == "done" else "updated"
    if changes:
        _log_history(item, action, changes, user, session)
    session.commit()
    session.refresh(item)
    return item


@router.delete("/{item_id}")
def delete_item(
    item_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    item = get_or_404(session, RoadmapItem, item_id, "RoadmapItem")
    session.delete(item)
    session.commit()
    return {"ok": True}
