"""Uitnodigingen: controleren en een gebruiker aanmaken. Gedeeld door het
wachtwoordpad (routers/auth.py) en aanmelden met Google/Microsoft
(routers/auth_oidc.py, item 1271)."""

import re
from datetime import datetime
from typing import Optional

from sqlmodel import Session, select

from models.core import Group, InviteToken, User, UserGroup


def open_invite(session: Session, token: str) -> Optional[InviteToken]:
    """De uitnodiging als hij bestaat, niet verlopen is en (tenzij het een
    herbruikbare groepslink is) nog niet gebruikt."""
    invite = session.exec(select(InviteToken).where(InviteToken.token == token)).first()
    if not invite or (invite.used_at and not invite.reusable) or invite.expires_at < datetime.utcnow():
        return None
    return invite


def invite_next(invite: InviteToken) -> str:
    """Waar je na aanmelden via deze uitnodiging heen gaat."""
    return invite.next_path or "/landing/"


def join_invite_group(session: Session, invite: InviteToken, user: User) -> None:
    """Bestaande gebruiker via een groepslink: alleen lid maken van de groep
    (verbruikt de uitnodiging niet). Commit door de aanroeper."""
    if not invite.group_id:
        return
    exists = session.exec(select(UserGroup).where(UserGroup.user_id == user.id,
                                                  UserGroup.group_id == invite.group_id)).first()
    if not exists:
        session.add(UserGroup(user_id=user.id, group_id=invite.group_id))


def unique_username(session: Session, email: Optional[str], fallback: str = "user") -> str:
    """Gebruikersnaam uit het deel voor de @ (alleen a-z, 0-9, . _ -), met een
    volgnummer als hij al bestaat: bart, bart2, bart3..."""
    base = re.sub(r"[^a-z0-9._-]", "", (email or "").split("@")[0].lower())[:30] or fallback
    candidate, n = base, 1
    while session.exec(select(User).where(User.username == candidate)).first():
        n += 1
        candidate = f"{base}{n}"
    return candidate


def create_invited_user(
    session: Session,
    invite: InviteToken,
    *,
    username: str,
    email: str,
    password_hash: str,
    display_name: Optional[str] = None,
) -> User:
    """Maakt de gebruiker aan, zet hem in members + de groep van de
    uitnodiging en markeert de uitnodiging als gebruikt (commit)."""
    user = User(username=username, email=email, password_hash=password_hash,
                display_name=display_name, is_active=True)
    session.add(user)
    session.flush()
    members_group = session.exec(select(Group).where(Group.slug == "members")).first()
    if members_group:
        session.add(UserGroup(user_id=user.id, group_id=members_group.id))
    if invite.group_id and invite.group_id != (members_group.id if members_group else None):
        session.add(UserGroup(user_id=user.id, group_id=invite.group_id))
        user.active_group_id = invite.group_id
        session.add(user)
    invite.used_at = datetime.utcnow()
    invite.used_by_user_id = user.id
    invite.use_count = (invite.use_count or 0) + 1
    session.add(invite)
    session.commit()
    return user
