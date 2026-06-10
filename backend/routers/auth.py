from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from pydantic import BaseModel

from core.database import get_session
from core.auth import verify_password, create_access_token, get_current_user
from core.logging import log_action
from models.core import User, UserGroup, Group, Site, SiteAccess

router = APIRouter(prefix="/api/auth", tags=["auth"])


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    username: str


class MeResponse(BaseModel):
    id: str
    username: str
    email: str
    locale: str
    is_active: bool
    groups: list[str]


@router.post("/login", response_model=TokenResponse)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
):
    user = session.exec(select(User).where(User.username == form.username)).first()

    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Onjuiste gebruikersnaam of wachtwoord",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is geblokkeerd")

    token = create_access_token({"sub": user.id})
    log_action(session, "login", user_id=user.id)
    return TokenResponse(access_token=token, token_type="bearer",
                         user_id=user.id, username=user.username)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    current_user: User = Depends(get_current_user),
):
    token = create_access_token({"sub": current_user.id})
    return TokenResponse(access_token=token, token_type="bearer",
                         user_id=current_user.id, username=current_user.username)


@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    log_action(session, "logout", user_id=current_user.id)
    return {"message": "Uitgelogd"}


@router.get("/me", response_model=MeResponse)
def me(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    groups = session.exec(
        select(Group)
        .join(UserGroup, UserGroup.group_id == Group.id)
        .where(UserGroup.user_id == current_user.id)
    ).all()
    return MeResponse(
        id=current_user.id, username=current_user.username,
        email=current_user.email, locale=current_user.locale,
        is_active=current_user.is_active, groups=[g.slug for g in groups],
    )


@router.get("/me/sites")
def my_sites(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    user_groups = session.exec(
        select(UserGroup).where(UserGroup.user_id == current_user.id)
    ).all()
    group_ids = {ug.group_id for ug in user_groups}

    accessible = []
    for site in session.exec(select(Site).where(Site.is_active.is_(True))).all():
        restrictions = session.exec(
            select(SiteAccess).where(SiteAccess.site_id == site.id)
        ).all()
        if not restrictions or any(r.group_id in group_ids for r in restrictions):
            accessible.append(site.slug)
    return {"sites": accessible}
