from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional

from core.database import get_session
from core.auth import require_admin
from core.logging import log_action
from models.core import User, Group, UserGroup

router = APIRouter(prefix="/api/admin/groups", tags=["admin - groups"])


class GroupOut(BaseModel):
    id: str
    name: str
    slug: str
    member_count: int


class GroupCreate(BaseModel):
    name: str
    slug: str


@router.get("/", response_model=list[GroupOut])
def list_groups(
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    groups = session.exec(select(Group)).all()
    result = []
    for g in groups:
        count = len(session.exec(
            select(UserGroup).where(UserGroup.group_id == g.id)
        ).all())
        result.append(GroupOut(id=g.id, name=g.name, slug=g.slug, member_count=count))
    return result


@router.post("/", response_model=GroupOut, status_code=201)
def create_group(
    data: GroupCreate,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    existing = session.exec(select(Group).where(Group.slug == data.slug)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Groep slug al in gebruik")

    group = Group(name=data.name, slug=data.slug)
    session.add(group)
    session.commit()
    session.refresh(group)

    log_action(session, "group.create", user_id=admin.id,
               payload={"group": data.slug})
    return GroupOut(id=group.id, name=group.name, slug=group.slug, member_count=0)


@router.delete("/{group_id}")
def delete_group(
    group_id: str,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    group = session.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Groep niet gevonden")
    if group.slug in ("admins", "members"):
        raise HTTPException(status_code=400, detail="Standaard groepen kunnen niet verwijderd worden")

    session.delete(group)
    session.commit()
    log_action(session, "group.delete", user_id=admin.id,
               payload={"group": group.slug})
    return {"message": f"Groep {group.slug} verwijderd"}
