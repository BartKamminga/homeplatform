from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel, Field, field_validator
from typing import Optional

from core.database import get_session, persist
from core.auth import require_admin, hash_password, GUEST_GROUP
from core.crud import get_or_404
from core.logging import log_action
from models.core import User, UserGroup, Group, UserPreference

router = APIRouter(prefix="/api/admin/users", tags=["admin - users"])


class UserOut(BaseModel):
    id: str
    username: str
    email: str
    locale: str
    is_active: bool
    groups: list[str]


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., min_length=5, max_length=200)
    password: str = Field(..., min_length=8)
    locale: str = "nl"

    @field_validator("username", "email")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()


class UserUpdate(BaseModel):
    email: Optional[str] = Field(default=None, min_length=5, max_length=200)
    locale: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8)


def _enrich(user: User, session: Session) -> UserOut:
    """Bouw UserOut voor één gebruiker (single-row operaties)."""
    groups = session.exec(
        select(Group)
        .join(UserGroup, UserGroup.group_id == Group.id)
        .where(UserGroup.user_id == user.id)
    ).all()
    return UserOut(
        id=user.id, username=user.username, email=user.email,
        locale=user.locale, is_active=user.is_active,
        groups=[g.slug for g in groups],
    )


@router.get("/", response_model=list[UserOut])
def list_users(
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    users = session.exec(select(User).order_by(User.username)).all()

    rows = session.exec(
        select(UserGroup.user_id, Group.slug)
        .join(Group, Group.id == UserGroup.group_id)
    ).all()
    groups_by_user: dict[str, list[str]] = {}
    for uid, slug in rows:
        groups_by_user.setdefault(uid, []).append(slug)

    return [
        UserOut(
            id=u.id, username=u.username, email=u.email,
            locale=u.locale, is_active=u.is_active,
            groups=groups_by_user.get(u.id, []),
        )
        for u in users
    ]


@router.post("/", response_model=UserOut, status_code=201)
def create_user(
    data: UserCreate,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    if session.exec(select(User).where(User.username == data.username)).first():
        raise HTTPException(status_code=409, detail="Gebruikersnaam al in gebruik")
    if session.exec(select(User).where(User.email == data.email)).first():
        raise HTTPException(status_code=409, detail="E-mailadres al in gebruik")

    user = persist(session, User(
        username=data.username, email=data.email,
        password_hash=hash_password(data.password), locale=data.locale,
    ))
    guest_group = session.exec(select(Group).where(Group.slug == GUEST_GROUP)).first()
    if guest_group:
        session.add(UserGroup(user_id=user.id, group_id=guest_group.id))
        session.commit()
    log_action(session, "user.create", user_id=admin.id, payload={"new_user": user.username})
    return _enrich(user, session)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    data: UserUpdate,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    user = get_or_404(session, User, user_id, "Gebruiker")

    if data.email is not None:
        user.email = data.email
    if data.locale is not None:
        user.locale = data.locale
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.password is not None:
        user.password_hash = hash_password(data.password)

    persist(session, user)
    log_action(session, "user.update", user_id=admin.id, payload={"updated_user": user.username})
    return _enrich(user, session)


@router.post("/{user_id}/groups/{group_slug}")
def add_user_to_group(
    user_id: str,
    group_slug: str,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    user = session.get(User, user_id)
    group = session.exec(select(Group).where(Group.slug == group_slug)).first()
    if not user or not group:
        raise HTTPException(status_code=404, detail="Gebruiker of groep niet gevonden")

    existing = session.exec(
        select(UserGroup)
        .where(UserGroup.user_id == user_id)
        .where(UserGroup.group_id == group.id)
    ).first()
    if not existing:
        session.add(UserGroup(user_id=user_id, group_id=group.id))
        session.commit()
        log_action(session, "user.group.add", user_id=admin.id,
                   payload={"user": user.username, "group": group_slug})
    return {"message": f"{user.username} toegevoegd aan {group_slug}"}


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Je kunt je eigen account niet verwijderen")
    user = get_or_404(session, User, user_id, "Gebruiker")

    # Blokkeer als dit de laatste admin is
    admin_group = session.exec(select(Group).where(Group.slug == "admins")).first()
    if admin_group:
        is_admin = session.exec(
            select(UserGroup).where(UserGroup.user_id == user_id, UserGroup.group_id == admin_group.id)
        ).first()
        if is_admin:
            admin_count = len(session.exec(
                select(UserGroup).where(UserGroup.group_id == admin_group.id)
            ).all())
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail="Kan de laatste beheerder niet verwijderen")

    username = user.username
    for row in session.exec(select(UserGroup).where(UserGroup.user_id == user_id)).all():
        session.delete(row)
    pref = session.exec(select(UserPreference).where(UserPreference.user_id == user_id)).first()
    if pref:
        session.delete(pref)
    session.delete(user)
    session.commit()
    log_action(session, "user.delete", user_id=admin.id, payload={"deleted_user": username})


@router.delete("/{user_id}/groups/{group_slug}")
def remove_user_from_group(
    user_id: str,
    group_slug: str,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    user = session.get(User, user_id)
    group = session.exec(select(Group).where(Group.slug == group_slug)).first()
    if not user or not group:
        raise HTTPException(status_code=404, detail="Gebruiker of groep niet gevonden")

    link = session.exec(
        select(UserGroup)
        .where(UserGroup.user_id == user_id)
        .where(UserGroup.group_id == group.id)
    ).first()
    if link:
        session.delete(link)
        session.commit()
        log_action(session, "user.group.remove", user_id=admin.id,
                   payload={"user": user.username, "group": group_slug})
    return {"message": f"{user.username} verwijderd uit {group_slug}"}
