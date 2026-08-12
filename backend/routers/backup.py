"""Backup & restore router — export/import per app als JSON + DB-snapshot download."""

import json
import os
import re
import sqlite3 as _sqlite3
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import delete, inspect as sa_inspect, text
from sqlmodel import Session, select

from core.auth import get_current_user, require_admin
from core.database import get_session, engine
from core.exceptions import AppError
from core.settings import settings
from models.changelog import ChangelogEntry
from models.core import RoadmapItem
from models.dontforget import Task
from models.hockey import HockeyPublication, HockeyPublicationTag, HockeyPublicationComp, HockeyPublicationCompTag
from models.mixmusic import Genre, TrackHeart, TrackMeta
from models.tournix import Tournament, TournixField, TournixMatch, TournixPrediction, TournixTeam

router = APIRouter(prefix="/api/admin/backup", tags=["backup"])
backup_router = APIRouter(prefix="/api/backup", tags=["backup"])

# Tabellen per app in volgorde van afhankelijkheid (DELETE in omgekeerde volgorde)
APP_CONFIG = {
    "mixmusic": {
        "tables": [Genre, TrackHeart, TrackMeta],
        "keys":   ["genres", "hearts", "meta"],
    },
    "dontforget": {
        "tables": [Task],
        "keys":   ["tasks"],
    },
    "tournix": {
        "tables": [Tournament, TournixTeam, TournixField, TournixMatch, TournixPrediction],
        "keys":   ["tournaments", "teams", "fields", "matches", "predictions"],
    },
    "platform": {
        "tables": [RoadmapItem, ChangelogEntry],
        "keys":   ["roadmap_items", "changelog"],
    },
    "hockey-inside": {
        "tables": [HockeyPublicationCompTag, HockeyPublicationComp, HockeyPublicationTag, HockeyPublication],
        "keys":   ["publication_comp_tags", "publication_comps", "publication_tags", "publications"],
    },
}


def _row_to_dict(obj) -> dict:
    d = {}
    for col in obj.__class__.__table__.columns:
        val = getattr(obj, col.name)
        if isinstance(val, datetime):
            val = val.isoformat()
        d[col.name] = val
    return d


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

@router.get("/export/{app}")
def export_app(
    app: str,
    session: Session = Depends(get_session),
    _user=Depends(require_admin),
):
    cfg = APP_CONFIG.get(app)
    if not cfg:
        raise AppError(404, f"Onbekende app: {app}")

    payload = {
        "app": app,
        "exported_at": datetime.utcnow().isoformat(),
        "version": 1,
    }
    for model, key in zip(cfg["tables"], cfg["keys"]):
        rows = session.exec(select(model)).all()
        payload[key] = [_row_to_dict(r) for r in rows]

    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M")
    fname = f"{app}-backup-{stamp}.json"
    return JSONResponse(
        content=payload,
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------

@router.post("/import/{app}")
async def import_app(
    app: str,
    file: UploadFile = File(...),
    mode: str = Query("merge", pattern="^(merge|overwrite)$"),
    session: Session = Depends(get_session),
    _user=Depends(require_admin),
):
    cfg = APP_CONFIG.get(app)
    if not cfg:
        raise AppError(404, f"Onbekende app: {app}")

    raw = await file.read()
    try:
        data = json.loads(raw)
    except Exception:
        raise AppError(400, "Ongeldig JSON bestand")

    if data.get("app") != app:
        raise AppError(400, f"Bestand is voor '{data.get('app')}', verwacht '{app}'")

    if mode == "overwrite":
        # Verwijder in omgekeerde volgorde vanwege FK-constraints
        for model in reversed(cfg["tables"]):
            session.exec(delete(model))

    inserted = skipped = errors = 0

    for model, key in zip(cfg["tables"], cfg["keys"]):
        pk_col = model.__table__.primary_key.columns.keys()[0]
        for row in data.get(key, []):
            try:
                pk_val = row.get(pk_col)
                if mode == "merge" and pk_val is not None:
                    existing = session.get(model, pk_val)
                    if existing is not None:
                        skipped += 1
                        continue
                # Verwijder None-waarden voor velden met een default
                cleaned = {k: v for k, v in row.items() if v is not None}
                session.add(model(**cleaned))
                inserted += 1
            except Exception:
                errors += 1

    session.commit()
    return {"inserted": inserted, "skipped": skipped, "errors": errors, "mode": mode}


# ---------------------------------------------------------------------------
# DB Snapshot
# ---------------------------------------------------------------------------

@router.get("/snapshot")
def download_snapshot(_user=Depends(require_admin)):
    db_url = settings.DATABASE_URL
    if not db_url.startswith("sqlite"):
        raise AppError(400, "Snapshot alleen beschikbaar voor SQLite")

    db_path = db_url.replace("sqlite:///", "")
    if db_path.startswith("./"):
        db_path = os.path.join(os.getcwd(), db_path[2:])
    db_path = os.path.abspath(db_path)

    if not os.path.exists(db_path):
        raise AppError(404, "Database bestand niet gevonden")

    # WAL checkpoint zodat de snapshot compleet is
    try:
        with engine.connect() as conn:
            conn.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
    except Exception:
        pass

    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M")
    return FileResponse(
        path=db_path,
        filename=f"homeplatform-snapshot-{stamp}.sqlite",
        media_type="application/octet-stream",
    )


# ---------------------------------------------------------------------------
# Dagelijkse backups — lijst, trigger, restore
# ---------------------------------------------------------------------------

_BACKUP_RE = re.compile(r'^homeplatform-\d{4}-\d{2}-\d{2}\.sqlite$')


def _backup_dir() -> str:
    return os.path.join(os.path.dirname(_resolve_db_path()), "backups")


@router.get("/daily")
def list_daily_backups(_user=Depends(require_admin)):
    bdir = _backup_dir()
    os.makedirs(bdir, exist_ok=True)

    pending = None
    flag = os.path.join(bdir, "pending_restore")
    if os.path.exists(flag):
        with open(flag) as f:
            pending = f.read().strip()

    backups = []
    for fname in os.listdir(bdir):
        if not _BACKUP_RE.match(fname):
            continue
        fpath = os.path.join(bdir, fname)
        stat = os.stat(fpath)
        backups.append({
            "filename": fname,
            "date": fname[len("homeplatform-"):-len(".sqlite")],
            "size_mb": round(stat.st_size / 1024 / 1024, 1),
            "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        })

    backups.sort(key=lambda x: x["date"], reverse=True)
    return {"backups": backups, "pending_restore": pending}


@router.post("/daily/trigger")
def trigger_backup(_user=Depends(require_admin)):
    db_path = _resolve_db_path()
    bdir = _backup_dir()
    os.makedirs(bdir, exist_ok=True)

    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    target = os.path.join(bdir, f"homeplatform-{date_str}.sqlite")

    src = _sqlite3.connect(db_path)
    dst = _sqlite3.connect(target)
    src.backup(dst)
    dst.close()
    src.close()

    size_mb = round(os.path.getsize(target) / 1024 / 1024, 1)
    return {"filename": f"homeplatform-{date_str}.sqlite", "size_mb": size_mb, "status": "ok"}


@router.post("/daily/restore/{filename}")
def request_restore(filename: str, _user=Depends(require_admin)):
    if not _BACKUP_RE.match(filename):
        raise AppError(400, "Ongeldig bestandsnaam")

    bdir = _backup_dir()
    if not os.path.exists(os.path.join(bdir, filename)):
        raise AppError(404, "Backup niet gevonden")

    flag = os.path.join(bdir, "pending_restore")
    with open(flag, "w") as f:
        f.write(filename)

    return {"status": "pending", "filename": filename}


# ---------------------------------------------------------------------------
# /api/backup — download + status
# ---------------------------------------------------------------------------

def _resolve_db_path() -> str:
    """Vertaal DATABASE_URL naar een absoluut bestandspad."""
    db_url = settings.DATABASE_URL
    if not db_url.startswith("sqlite"):
        raise AppError(400, "Backup alleen beschikbaar voor SQLite")
    path = db_url.replace("sqlite:///", "")
    if path.startswith("./"):
        path = os.path.join(os.getcwd(), path[2:])
    return os.path.abspath(path)


@backup_router.get("/download")
def download_db(_user=Depends(get_current_user)):
    """Download de volledige SQLite-database als .sqlite bestand (login vereist)."""
    db_path = _resolve_db_path()
    if not os.path.exists(db_path):
        raise AppError(404, "Database bestand niet gevonden")

    # WAL checkpoint zodat de snapshot compleet is
    try:
        with engine.connect() as conn:
            conn.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
    except Exception:
        pass

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    return FileResponse(
        path=db_path,
        filename=f"homeplatform-{stamp}.sqlite",
        media_type="application/octet-stream",
    )


@backup_router.get("/status")
def backup_status(_user=Depends(get_current_user)):
    """Geeft DB-bestandsgrootte, laatste wijziging, alembic-versie en rij-tellingen."""
    db_path = _resolve_db_path()

    if not os.path.exists(db_path):
        raise AppError(404, "Database bestand niet gevonden")

    stat = os.stat(db_path)
    size_bytes = stat.st_size
    last_modified = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()

    # Alembic-revisie
    try:
        from alembic.runtime.migration import MigrationContext  # type: ignore
        with engine.connect() as conn:
            ctx = MigrationContext.configure(conn)
            alembic_version = ctx.get_current_revision() or "geen migraties"
    except Exception:
        alembic_version = "onbekend"

    # Rij-tellingen voor kernstabellen
    key_tables = ["roadmap_items", "changelog", "users", "groups"]
    inspector = sa_inspect(engine)
    available = set(inspector.get_table_names())
    row_counts: dict[str, int] = {}
    with engine.connect() as conn:
        for t in key_tables:
            if t not in available:
                row_counts[t] = 0
                continue
            try:
                row = conn.execute(text(f'SELECT COUNT(*) FROM "{t}"')).fetchone()
                row_counts[t] = row[0] if row else 0
            except Exception:
                row_counts[t] = 0

    return {
        "db_path": db_path,
        "size_bytes": size_bytes,
        "size_mb": round(size_bytes / 1024 / 1024, 3),
        "last_modified": last_modified,
        "alembic_version": alembic_version,
        "row_counts": row_counts,
    }
