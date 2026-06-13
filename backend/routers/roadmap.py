from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from core.database import get_session
from core.auth import get_current_user
from core.crud import get_or_404
from models.core import RoadmapItem, User
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


def _maybe_create_changelog(item: RoadmapItem, session: Session) -> None:
    """Auto-create a changelog entry when an item is marked klaar with a version."""
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


@router.post("", response_model=RoadmapItem)
def create_item(
    body: RoadmapItemCreate,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    item = RoadmapItem(**body.model_dump())
    session.add(item)
    _maybe_create_changelog(item, session)
    session.commit()
    session.refresh(item)
    return item


@router.patch("/{item_id}", response_model=RoadmapItem)
def update_item(
    item_id: int,
    body: RoadmapItemUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    item = get_or_404(session, RoadmapItem, item_id, "RoadmapItem")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(item, k, v)
    item.updated_at = datetime.utcnow()
    session.add(item)
    _maybe_create_changelog(item, session)
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
