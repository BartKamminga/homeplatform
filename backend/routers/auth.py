import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func as sa_func
from sqlmodel import Session, select
from pydantic import BaseModel

from core.database import get_session
from core.auth import (
    verify_password, create_access_token, decode_token, get_current_user, hash_password, oauth2_scheme,
)
from core.crud import get_or_create_user_pref
from core.invites import create_invited_user, invite_next, open_invite
from core.limiter import limiter
from core.logging import log_action
from models.core import User, UserGroup, Group, Site, SiteAccess, InviteToken, UserPreference, UserApiKey

router = APIRouter(prefix="/api/auth", tags=["auth"])


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    username: str


class GroupDetail(BaseModel):
    slug: str
    member_count: int


class MeResponse(BaseModel):
    id: str
    username: str
    email: str
    display_name: Optional[str] = None
    locale: str
    is_active: bool
    groups: list[str]
    active_group: Optional[str] = None
    group_details: list[GroupDetail] = []
    pref_group_dontforget: Optional[str] = None
    pref_group_mixmusic: Optional[str] = None
    pref_group_tournix: Optional[str] = None


class ActiveGroupIn(BaseModel):
    group_slug: Optional[str] = None


class PreferencesIn(BaseModel):
    pref_group_dontforget: Optional[str] = None
    pref_group_mixmusic: Optional[str] = None
    pref_group_tournix: Optional[str] = None


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
    old_token: str = Depends(oauth2_scheme),
):
    # Inlogmethode (amr) behouden, anders valt een Google/MS-login terug naar 8 uur
    claims = {"sub": current_user.id}
    if not old_token.startswith("hp_"):
        amr = decode_token(old_token).get("amr")
        if amr:
            claims["amr"] = amr
    token = create_access_token(claims)
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
    count_rows = session.exec(
        select(UserGroup.group_id, sa_func.count(UserGroup.user_id))
        .where(UserGroup.group_id.in_([g.id for g in groups]))
        .group_by(UserGroup.group_id)
    ).all()
    counts = dict(count_rows)
    group_details = [GroupDetail(slug=g.slug, member_count=counts.get(g.id, 0)) for g in groups]

    def _group_slug(group_id: Optional[str]) -> Optional[str]:
        if not group_id:
            return None
        g = session.get(Group, group_id)
        return g.slug if g else None

    return MeResponse(
        id=current_user.id, username=current_user.username,
        email=current_user.email, display_name=current_user.display_name, locale=current_user.locale,
        is_active=current_user.is_active, groups=[g.slug for g in groups],
        active_group=active_group, group_details=group_details,
        pref_group_dontforget=_group_slug(current_user.pref_group_dontforget),
        pref_group_mixmusic=_group_slug(current_user.pref_group_mixmusic),
        pref_group_tournix=_group_slug(current_user.pref_group_tournix),
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


@router.patch("/me/preferences")
def set_preferences(
    body: PreferencesIn,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    def _resolve_group_id(slug: Optional[str]) -> Optional[str]:
        if not slug:
            return None
        group = session.exec(select(Group).where(Group.slug == slug)).first()
        if not group:
            raise HTTPException(status_code=404, detail=f"Groep niet gevonden: {slug}")
        is_member = session.exec(
            select(UserGroup)
            .where(UserGroup.user_id == current_user.id)
            .where(UserGroup.group_id == group.id)
        ).first()
        if not is_member:
            raise HTTPException(status_code=403, detail=f"Niet lid van groep: {slug}")
        return group.id

    if "pref_group_dontforget" in body.model_fields_set:
        current_user.pref_group_dontforget = _resolve_group_id(body.pref_group_dontforget)
    if "pref_group_mixmusic" in body.model_fields_set:
        current_user.pref_group_mixmusic = _resolve_group_id(body.pref_group_mixmusic)
    if "pref_group_tournix" in body.model_fields_set:
        current_user.pref_group_tournix = _resolve_group_id(body.pref_group_tournix)
    session.add(current_user)
    session.commit()
    return {
        "pref_group_dontforget": body.pref_group_dontforget,
        "pref_group_mixmusic": body.pref_group_mixmusic,
        "pref_group_tournix": body.pref_group_tournix,
    }


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


# ── UI-voorkeuren (opgeslagen in user_preferences.extra) ─────────────────────

@router.get("/me/ui-prefs")
def get_ui_prefs(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    row = session.exec(select(UserPreference).where(UserPreference.user_id == current_user.id)).first()
    return row.extra or {} if row else {}


@router.patch("/me/ui-prefs")
async def set_ui_prefs(
    request: Request,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    data = await request.json()
    if not isinstance(data, dict):
        raise HTTPException(status_code=422, detail="Body moet een object zijn")
    row = get_or_create_user_pref(session, current_user.id)
    row.extra = {**(row.extra or {}), **data}
    session.add(row)
    session.commit()
    return row.extra


# ── Profiel bewerken ──────────────────────────────────────────────────────────

class UpdateMeIn(BaseModel):
    current_password: str
    new_password: str


@router.patch("/me")
def update_me(
    body: UpdateMeIn,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Huidig wachtwoord klopt niet")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="Nieuw wachtwoord minimaal 8 tekens")
    current_user.password_hash = hash_password(body.new_password)
    current_user.updated_at = datetime.utcnow()
    session.add(current_user)
    session.commit()
    return {"message": "Wachtwoord gewijzigd"}


# ── Uitnodigingen ─────────────────────────────────────────────────────────────

class CreateInviteIn(BaseModel):
    group_slug: Optional[str] = None
    reusable: bool = False        # groepslink: meerdere mensen, 30 dagen (item 1332)
    next: Optional[str] = None    # startpagina na aanmelden, bv. /vbt/


class AcceptInviteIn(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    display_name: Optional[str] = None


@router.post("/invite")
def create_invite(
    body: CreateInviteIn,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    def is_member_of(group: Optional[Group]) -> bool:
        return bool(group and session.exec(
            select(UserGroup).where(UserGroup.user_id == current_user.id).where(UserGroup.group_id == group.id)
        ).first())

    is_admin = is_member_of(session.exec(select(Group).where(Group.slug == "admins")).first())
    group_id = None
    if body.group_slug:
        group = session.exec(select(Group).where(Group.slug == body.group_slug)).first()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if not is_admin and not is_member_of(group):
            raise HTTPException(status_code=403, detail="You are not a member of this group")
        group_id = group.id
    elif not is_admin:
        raise HTTPException(status_code=403, detail="Choose a group or use an admin account")
    if body.reusable and not group_id:
        raise HTTPException(status_code=422, detail="A group link needs a group")
    next_path = (body.next or "").strip() or None
    if next_path and (not next_path.startswith("/") or next_path.startswith("//") or "\\" in next_path):
        raise HTTPException(status_code=422, detail="Start page must be a path on this site, e.g. /vbt/")
    token_str = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(days=30 if body.reusable else 7)
    session.add(InviteToken(token=token_str, created_by=current_user.id, expires_at=expires,
                            group_id=group_id, reusable=body.reusable, next_path=next_path))
    session.commit()
    return {"token": token_str, "expires_at": expires.isoformat()}


@router.get("/invite/{token}")
def check_invite(token: str, session: Session = Depends(get_session)):
    invite = session.exec(select(InviteToken).where(InviteToken.token == token)).first()
    if not invite:
        raise HTTPException(status_code=404, detail="This invitation does not exist.")
    if invite.used_at and not invite.reusable:
        raise HTTPException(status_code=410, detail="This invitation has already been used.")
    if invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="This invitation has expired.")
    group_name = None
    if invite.group_id:
        g = session.get(Group, invite.group_id)
        if g:
            group_name = g.name
    return {"valid": True, "expires_at": invite.expires_at.isoformat(), "group_name": group_name,
            "next": invite_next(invite)}


@router.post("/invite/{token}/accept", response_model=TokenResponse)
def accept_invite(token: str, body: AcceptInviteIn, session: Session = Depends(get_session)):
    invite = open_invite(session, token)
    if not invite:
        raise HTTPException(status_code=400, detail="This invitation is no longer valid.")
    if not body.username.strip():
        raise HTTPException(status_code=422, detail="Username is required")
    if session.exec(select(User).where(User.username == body.username.strip())).first():
        raise HTTPException(status_code=409, detail="This username is already taken")
    email = body.email.strip() if body.email else f"{body.username.strip()}@homeplatform.local"
    if body.email and session.exec(select(User).where(User.email == email)).first():
        raise HTTPException(status_code=409, detail="This email address is already in use")
    user = create_invited_user(
        session, invite, username=body.username.strip(), email=email,
        password_hash=hash_password(body.password), display_name=(body.display_name or "").strip() or None,
    )
    log_action(session, "user.invite_accept", user_id=user.id, payload={"username": user.username})
    access_token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=access_token, token_type="bearer",
                         user_id=user.id, username=user.username)


# ── API Keys ──────────────────────────────────────────────────────────────────

class ApiKeyCreate(BaseModel):
    name: str


class ApiKeyOut(BaseModel):
    id: str
    name: str
    key_hint: str
    created_at: datetime
    last_used_at: Optional[datetime] = None


class ApiKeyCreated(ApiKeyOut):
    key: str   # alleen bij aanmaken getoond


@router.get("/api-keys", response_model=list[ApiKeyOut])
def list_api_keys(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    keys = session.exec(
        select(UserApiKey)
        .where(UserApiKey.user_id == current_user.id)
        .where(UserApiKey.revoked_at.is_(None))
    ).all()
    return [ApiKeyOut(id=k.id, name=k.name, key_hint=k.key_hint,
                      created_at=k.created_at, last_used_at=k.last_used_at) for k in keys]


@router.post("/api-keys", response_model=ApiKeyCreated)
def create_api_key(
    body: ApiKeyCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not body.name.strip():
        raise HTTPException(status_code=422, detail="Naam is verplicht")
    raw_key = "hp_" + secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_hint = raw_key[3:11]   # 8 tekens na "hp_"
    api_key = UserApiKey(
        user_id=current_user.id,
        name=body.name.strip(),
        key_hash=key_hash,
        key_hint=key_hint,
    )
    session.add(api_key)
    session.commit()
    session.refresh(api_key)
    return ApiKeyCreated(id=api_key.id, name=api_key.name, key_hint=key_hint,
                         created_at=api_key.created_at, key=raw_key)


@router.delete("/api-keys/{key_id}", status_code=204)
def revoke_api_key(
    key_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    api_key = session.get(UserApiKey, key_id)
    if not api_key or api_key.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="API key niet gevonden")
    api_key.revoked_at = datetime.utcnow()
    session.add(api_key)
    session.commit()
