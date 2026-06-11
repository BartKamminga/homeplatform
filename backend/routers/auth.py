from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from pydantic import BaseModel

from core.database import get_session
from core.auth import verify_password, create_access_token, get_current_user
from core.limiter import limiter
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
    active_group: Optional[str] = None


class ActiveGroupIn(BaseModel):
    group_slug: Optional[str] = None


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(
    request: Request,
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
    active_group = None
    if current_user.active_group_id:
        g = session.get(Group, current_user.active_group_id)
        if g:
            active_group = g.slug
    return MeResponse(
        id=current_user.id, username=current_user.username,
        email=current_user.email, locale=current_user.locale,
        is_active=current_user.is_active, groups=[g.slug for g in groups],
        active_group=active_group,
    )


@router.patch("/me/active-group")
def set_active_group(
    body: ActiveGroupIn,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if body.group_slug:
        group = session.exec(select(Group).where(Group.slug == body.group_slug)).first()
        if not group:
            raise HTTPException(status_code=404, detail="Groep niet gevonden")
        member = session.exec(
            select(UserGroup)
            .where(UserGroup.user_id == current_user.id)
            .where(UserGroup.group_id == group.id)
        ).first()
        if not member:
            raise HTTPException(status_code=403, detail="Niet lid van deze groep")
        current_user.active_group_id = group.id
    else:
        current_user.active_group_id = None
    session.add(current_user)
    session.commit()
    return {"active_group": body.group_slug}


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
