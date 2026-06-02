from fastapi import APIRouter
from alembic.runtime.migration import MigrationContext
from core.database import engine
import os

router = APIRouter(prefix="/api", tags=["system"])

CORE_VERSION = "0.2.0"


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
