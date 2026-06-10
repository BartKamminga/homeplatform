from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy import func
from pydantic import BaseModel

from core.database import get_session
from core.auth import require_admin, PROTECTED_GROUPS
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
    _: User = Depends(require_admin),
):
    groups = session.exec(select(Group)).all()

    # Eén query voor alle member counts
    count_rows = session.exec(
        select(UserGroup.group_id, func.count(UserGroup.user_id))
        .group_by(UserGroup.group_id)
    ).all()
    counts = {gid: cnt for gid, cnt in count_rows}

    return [
        GroupOut(id=g.id, name=g.name, slug=g.slug, member_count=counts.get(g.id, 0))
        for g in groups
    ]


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
    log_action(session, "group.create", user_id=admin.id, payload={"group": data.slug})
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
    if group.slug in PROTECTED_GROUPS:
        raise HTTPException(status_code=400, detail="Standaard groepen kunnen niet worden verwijderd")

    session.delete(group)
    session.commit()
    log_action(session, "group.delete", user_id=admin.id, payload={"group": group.slug})
    return {"message": f"Groep {group.slug} verwijderd"}
