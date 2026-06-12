from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from core.database import get_session
from core.auth import get_current_user
from models.core import RoadmapItem, User

router = APIRouter(prefix="/api/roadmap", tags=["roadmap"])


class RoadmapItemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    site: str = "platform"
    priority: str = "midden"
    status: str = "idee"
    notes: Optional[str] = None


class RoadmapItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    site: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


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
    item = session.get(RoadmapItem, item_id)
    if not item:
        raise HTTPException(404, "Niet gevonden")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(item, k, v)
    item.updated_at = datetime.utcnow()
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.delete("/{item_id}")
def delete_item(
    item_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    item = session.get(RoadmapItem, item_id)
    if not item:
        raise HTTPException(404, "Niet gevonden")
    session.delete(item)
    session.commit()
    return {"ok": True}
