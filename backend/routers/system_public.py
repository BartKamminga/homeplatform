"""System — publieke endpoints (health/version/config/sites), geen auth
vereist. Opgesplitst uit routers/system.py (item 844) - dat bestand bundelde
dit met admin-only monitoring in 1 kitchen-sink router."""

from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlmodel import Session, select

from core.database import engine, get_session
from core.settings import settings
from models.core import Group, Site, SiteAccess, UserGroup

router = APIRouter(prefix="/api", tags=["system"])

_optional_token = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_db_revision() -> str:
    try:
        from alembic.runtime.migration import MigrationContext  # type: ignore
        with engine.connect() as conn:
            context = MigrationContext.configure(conn)
            return context.get_current_revision() or "geen migraties"
    except Exception:
        return "onbekend"


@router.get("/health")
def health():
    return {"status": "ok", "environment": settings.ENVIRONMENT}


@router.get("/version")
def version():
    return {"core": settings.APP_VERSION, "db_revision": get_db_revision(), "sites": {}}


@router.get("/config")
def public_config():
    return {
        "sentry_dsn": settings.SENTRY_DSN or None,
        "environment": settings.ENVIRONMENT,
        "sentry_min_level": settings.SENTRY_MIN_LEVEL,
    }


@router.get("/sites")
def public_sites(
    session: Session = Depends(get_session),
    token: Optional[str] = Depends(_optional_token),
):
    """Retourneert alleen sites die zichtbaar zijn voor de aanvrager.

    Onbeperkte sites (geen SiteAccess-rijen) zijn altijd zichtbaar.
    Beperkte sites zijn alleen zichtbaar voor ingelogde gebruikers met de juiste groep.
    """
    restricted_ids = {sa.site_id for sa in session.exec(select(SiteAccess)).all()}

    accessible_ids: set[str] = set()
    if token:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id = payload.get("sub")
            if user_id:
                group_ids = set(session.exec(
                    select(UserGroup.group_id).where(UserGroup.user_id == user_id)
                ).all())
                if group_ids:
                    accessible_ids = {
                        sa.site_id
                        for sa in session.exec(
                            select(SiteAccess).where(SiteAccess.group_id.in_(group_ids))
                        ).all()
                    }
                # Admingroep heeft altijd toegang tot admin-module sites
                admin_group = session.exec(
                    select(Group).where(Group.slug == "admins")
                ).first()
                if admin_group and admin_group.id in group_ids:
                    admin_site_ids = {
                        s.id for s in session.exec(
                            select(Site).where(Site.module == "admin")
                        ).all()
                    }
                    accessible_ids |= admin_site_ids
        except (JWTError, Exception):
            pass

    sites = session.exec(
        select(Site).where(Site.is_active.is_(True)).order_by(Site.name)
    ).all()
    return [
        {"name": s.name, "slug": s.slug, "module": s.module, "icon": s.icon}
        for s in sites
        if s.id not in restricted_ids or s.id in accessible_ids
    ]
