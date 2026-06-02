from typing import Optional
from sqlmodel import Session, select

from models.core import User, UserGroup, Group, Site, SiteAccess


def user_has_site_access(session: Session, user_id: str, site_slug: str) -> bool:
    """Controleert of een gebruiker toegang heeft tot een specifieke site."""
    site = session.exec(
        select(Site).where(Site.slug == site_slug)
    ).first()
    if not site:
        return False

    # Admins hebben altijd toegang
    is_admin = session.exec(
        select(UserGroup)
        .join(Group, Group.id == UserGroup.group_id)
        .where(UserGroup.user_id == user_id)
        .where(Group.slug == "admins")
    ).first()
    if is_admin:
        return True

    # Check site_access via groepen
    access = session.exec(
        select(SiteAccess)
        .join(Group, Group.id == SiteAccess.group_id)
        .join(UserGroup, UserGroup.group_id == Group.id)
        .where(UserGroup.user_id == user_id)
        .where(SiteAccess.site_id == site.id)
    ).first()

    return access is not None


def get_user_groups(session: Session, user_id: str) -> list[str]:
    """Geeft lijst van group slugs waar de gebruiker lid van is."""
    groups = session.exec(
        select(Group)
        .join(UserGroup, UserGroup.group_id == Group.id)
        .where(UserGroup.user_id == user_id)
    ).all()
    return [g.slug for g in groups]
