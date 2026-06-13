from fastapi import APIRouter, Depends, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import inspect as sa_inspect, text, update as sa_update
from sqlmodel import Session, select
from typing import Optional

from core.database import engine, get_session
from core.settings import settings
from core.auth import require_admin
from core.limiter import limiter
from core.stats import api_call_stats, api_call_since
from models.core import AuditLog, Group, Site, SiteAccess, User, UserGroup

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


# ── Admin: System overview ────────────────────────────────────────────────────

@router.get("/admin/system/overview")
def system_overview(session: Session = Depends(get_session), _: User = Depends(require_admin)):
    users      = session.exec(select(User)).all()
    groups     = session.exec(select(Group)).all()
    user_grps  = session.exec(select(UserGroup)).all()
    sites      = session.exec(select(Site)).all()
    site_acc   = session.exec(select(SiteAccess)).all()
    recent_log = session.exec(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(6)
    ).all()

    group_members: dict[str, int] = {}
    for ug in user_grps:
        group_members[ug.group_id] = group_members.get(ug.group_id, 0) + 1

    # Tabeltellingen via inspect (valideert tabelnamen via DB-metadata)
    tables = [
        "users", "groups", "user_groups", "themes", "user_preferences",
        "sites", "site_access", "invite_tokens", "audit_log",
        "roadmap_items", "changelog",
        "tasks", "mixmusic_genres", "mixmusic_track_meta", "mixmusic_track_hearts",
        "tournix_clubs", "tournix_tournaments", "tournix_pools", "tournix_teams",
        "tournix_fields", "tournix_matches", "tournix_predictions", "tournix_snapshots",
    ]
    inspector = sa_inspect(engine)
    available_tables = set(inspector.get_table_names())
    table_counts: dict[str, int] = {}
    with engine.connect() as conn:
        for t in tables:
            if t not in available_tables:
                table_counts[t] = 0
                continue
            try:
                row = conn.execute(text(f'SELECT COUNT(*) FROM "{t}"')).fetchone()
                table_counts[t] = row[0] if row else 0
            except Exception:
                table_counts[t] = 0

    db_url = settings.DATABASE_URL
    db_display = db_url.rsplit("/", 1)[-1] if "/" in db_url else db_url

    return {
        "environment": settings.ENVIRONMENT,
        "database_file": db_display,
        "db_revision": get_db_revision(),
        "sentry_enabled": bool(settings.SENTRY_DSN),
        "sentry_min_level": settings.SENTRY_MIN_LEVEL,
        "backend_version": settings.APP_VERSION,
        "music_dir": settings.MUSIC_DIR,
        "users": {
            "total": len(users),
            "active": sum(1 for u in users if u.is_active),
            "inactive": sum(1 for u in users if not u.is_active),
        },
        "groups": [
            {"id": g.id, "name": g.name, "slug": g.slug, "members": group_members.get(g.id, 0)}
            for g in groups
        ],
        "sites": [
            {
                "name": s.name, "slug": s.slug, "module": s.module,
                "is_active": s.is_active, "icon": s.icon,
                "restricted": any(sa.site_id == s.id for sa in site_acc),
            }
            for s in sites
        ],
        "tables": table_counts,
        "recent_audit": [
            {
                "action": e.action,
                "site": e.site,
                "user_id": e.user_id,
                "created_at": e.created_at.isoformat(),
            }
            for e in recent_log
        ],
        "links": _build_links(),
    }


def _build_links() -> dict:
    glitchtip = None
    if settings.SENTRY_DSN:
        try:
            from urllib.parse import urlparse
            p = urlparse(settings.SENTRY_DSN)
            glitchtip = f"{p.scheme}://{p.hostname}:{p.port}" if p.port else f"{p.scheme}://{p.hostname}"
        except Exception:
            pass
    external = settings.EXTERNAL_URL.rstrip("/") if settings.EXTERNAL_URL else None
    return {
        "glitchtip": glitchtip,
        "nas": settings.NAS_URL or None,
        "api_docs": "/api/docs" if settings.is_dev else None,
        "external_url": external,
        "cloudflare_tunnel": "https://one.dash.cloudflare.com/networks/tunnels" if external else None,
        "cloudflare_analytics": f"https://dash.cloudflare.com" if external else None,
        "github": "https://github.com/BartKamminga/homeplatform",
    }


# ── Admin: API call stats ─────────────────────────────────────────────────────

@router.get("/admin/api-stats")
def get_api_stats(_: User = Depends(require_admin)):
    total = sum(api_call_stats.values())
    entries = sorted(api_call_stats.items(), key=lambda x: x[1], reverse=True)
    return {
        "since": api_call_since,
        "total": total,
        "endpoints": [
            {
                "method": k.split(" ", 1)[0],
                "path": k.split(" ", 1)[1] if " " in k else k,
                "calls": v,
                "pct": round(v / total * 100, 1) if total else 0,
            }
            for k, v in entries
        ],
    }


# ── Admin: Audit log ──────────────────────────────────────────────────────────

@router.get("/admin/audit-log")
@limiter.limit("60/minute")
def get_audit_log(
    request: Request,
    limit: int = 50,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    entries = session.exec(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(min(limit, 200))
    ).all()
    return [
        {
            "id": e.id,
            "action": e.action,
            "site": e.site,
            "user_id": e.user_id,
            "payload": e.payload,
            "created_at": e.created_at.isoformat(),
        }
        for e in entries
    ]
