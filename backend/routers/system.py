from fastapi import APIRouter, Depends, Request
from alembic.runtime.migration import MigrationContext
from core.database import engine
from sqlmodel import select, Session
from core.database import get_session
from core.settings import settings
from models.core import Site
import os

router = APIRouter(prefix="/api", tags=["system"])

CORE_VERSION = "0.3.0"


def get_db_revision() -> str:
    try:
        with engine.connect() as conn:
            context = MigrationContext.configure(conn)
            return context.get_current_revision() or "geen migraties"
    except Exception:
        return "onbekend"


@router.get("/health")
def health():
    return {"status": "ok", "environment": os.getenv("ENVIRONMENT", "development")}


@router.get("/version")
def version():
    return {
        "core": CORE_VERSION,
        "db_revision": get_db_revision(),
        "sites": {},
    }


@router.get("/debug-headers")
async def debug_headers(request: Request):
    return dict(request.headers)


@router.get("/config")
def public_config():
    return {
        "sentry_dsn": settings.SENTRY_DSN or None,
        "environment": settings.ENVIRONMENT,
    }


@router.get("/sites")
def public_sites(session: Session = Depends(get_session)):
    """Publiek endpoint — toont actieve sites zonder auth."""
    sites = session.exec(select(Site).where(Site.is_active == True)).all()
    return [
        {"name": s.name, "slug": s.slug, "module": s.module, "icon": s.icon}
        for s in sites
    ]
