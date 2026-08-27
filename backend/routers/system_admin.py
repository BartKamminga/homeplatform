"""System — admin-only monitoring (overview/deploy-status/beatport-provider/
api-stats/scrapster-cache/site-events/site-stats/audit-log). Opgesplitst uit
routers/system.py (item 844) - dat bestand bundelde dit met de publieke
health/version/config/sites-endpoints in 1 kitchen-sink router."""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import inspect as sa_inspect, text
from sqlmodel import Session, select
from typing import Optional

from core.database import engine, get_session
from core.settings import settings
from core.auth import require_admin
from core.limiter import limiter
from core.stats import api_call_stats, api_call_since
from models.core import AuditLog, Group, Site, SiteAccess, User, UserGroup
from routers.system_public import get_db_revision

router = APIRouter(prefix="/api/admin", tags=["system-admin"])


# ── Admin: System overview ────────────────────────────────────────────────────

@router.get("/system/overview")
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
        # Platform / core
        "users", "groups", "user_groups", "user_api_keys", "themes", "user_preferences",
        "sites", "site_access", "invite_tokens", "audit_log", "app_settings",
        "roadmap_items", "roadmap_history", "changelog",
        # DontForget
        "tasks",
        # MixMusic
        "mixmusic_genres", "mixmusic_track_meta", "mixmusic_track_hearts", "mixmusic_excluded_tracks",
        # Tournix / Poulebord
        "tournix_clubs", "tournix_tournaments", "tournix_pools", "tournix_teams",
        "tournix_fields", "tournix_matches", "tournix_predictions", "tournix_snapshots",
        "tournix_phases", "tournix_phase_teams", "tournix_phase_fields",
        "tournix_tournament_fases", "tournix_import_log",
        "poulebord_boards",
        # Hockey
        "hockey_clubs", "hockey_competitions", "hockey_poules", "hockey_teams",
        "hockey_poule_matches", "hockey_poule_standings", "vanger_cmd_queue",
        # BeatCrades / downloader
        "download_jobs", "download_crades", "download_crade_groups", "download_sections",
        # Agent Control
        "agent_notifications", "agent_tasks", "agent_run_logs",
        # Overig
        "data_captures",
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
        "download_dir": settings.DOWNLOAD_DIR,
        "beatportdl_config_dir": settings.BEATPORTDL_CONFIG_DIR or None,
        "beatport_provider": _active_beatport_provider(),
        "nas_host": settings.NAS_IP or None,
        "nas_path": settings.NAS_PATH or None,
        "nas_url":  settings.NAS_URL  or None,
        "links": _build_links(),
        "hardware": _get_hardware_info(),
    }


# ── Admin: Deploy-status ──────────────────────────────────────────────────────

class DeployVersionIn(BaseModel):
    version: str
    commit: str
    short: str = ""


@router.get("/deploy-status")
def get_deploy_status(_: User = Depends(require_admin)):
    import json as _json, os as _os
    def read_info(path):
        try:
            with open(path) as f:
                return _json.load(f)
        except Exception:
            return None

    from models.settings import AppSetting
    versions = []
    with engine.connect() as conn:
        try:
            rows = conn.execute(text("SELECT value FROM app_settings WHERE key = 'deploy.versions'")).fetchone()
            if rows:
                versions = _json.loads(rows[0])
        except Exception:
            pass

    return {
        "current": read_info("/app/db/deploy_info.json"),
        "versions": versions,
    }


@router.post("/deploy-versions")
def post_deploy_version(body: DeployVersionIn, _: User = Depends(require_admin)):
    import json as _json
    from models.settings import AppSetting
    from sqlmodel import Session as _Session
    with _Session(engine) as s:
        row = s.get(AppSetting, "deploy.versions")
        versions = _json.loads(row.value) if row else []
        if not any(v["version"] == body.version for v in versions):
            import datetime as _dt
            versions.insert(0, {
                "version": body.version,
                "commit": body.commit,
                "short": body.short or body.commit[:7],
                "recorded_at": _dt.datetime.utcnow().isoformat() + "Z",
            })
            versions = versions[:50]
        if row:
            row.value = _json.dumps(versions)
        else:
            s.add(AppSetting(key="deploy.versions", value=_json.dumps(versions)))
        s.commit()
    return {"ok": True, "version": body.version}


def _get_hardware_info() -> dict:
    try:
        import psutil, time as _t
        cpu_pct = psutil.cpu_percent(interval=0.3)
        mem  = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        uptime_s = int(_t.time() - psutil.boot_time())

        cpu_temp = None
        try:
            temps = psutil.sensors_temperatures()
            if temps:
                for key in ("coretemp", "cpu_thermal", "k10temp", "acpitz"):
                    if key in temps and temps[key]:
                        cpu_temp = round(temps[key][0].current, 1)
                        break
        except (AttributeError, Exception):
            pass

        return {
            "available": True,
            "cpu_percent": cpu_pct,
            "cpu_temp": cpu_temp,
            "memory": {
                "total_gb": round(mem.total / 1024 ** 3, 1),
                "used_gb":  round(mem.used  / 1024 ** 3, 1),
                "percent":  mem.percent,
            },
            "disk": {
                "total_gb": round(disk.total / 1024 ** 3, 1),
                "used_gb":  round(disk.used  / 1024 ** 3, 1),
                "percent":  disk.percent,
            },
            "uptime_s": uptime_s,
        }
    except Exception:
        return {"available": False}


def _active_beatport_provider() -> str:
    from routers.providers.factory import get_active_beatport_provider
    return get_active_beatport_provider()


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


# ── Admin: Beatport provider ──────────────────────────────────────────────────

class ProviderBody(BaseModel):
    provider: str

@router.get("/beatport-provider")
def get_beatport_provider(_: User = Depends(require_admin)):
    from routers.providers.factory import get_active_beatport_provider, _provider_override
    active = get_active_beatport_provider()
    return {
        "provider": active,
        "from_env": _provider_override is None,
        "options": ["binary", "native"],
    }

@router.put("/beatport-provider")
def put_beatport_provider(body: ProviderBody, _: User = Depends(require_admin)):
    from routers.providers.factory import set_beatport_provider
    if body.provider not in ("binary", "native"):
        raise HTTPException(status_code=422, detail="Ongeldige provider — kies 'binary' of 'native'")
    set_beatport_provider(body.provider)
    return {"provider": body.provider, "from_env": False}


# ── Admin: API call stats ─────────────────────────────────────────────────────

@router.get("/api-stats")
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


# ── Admin: Site analytics ─────────────────────────────────────────────────────

@router.get("/scrapster-cache-status")
def get_scrapster_cache_status(_: User = Depends(require_admin)):
    """Realtime cache- en achtergrond-refresh status van Scrapster."""
    import time as _time
    from routers.scrapster import (
        _cache, _standings_cache, _activity, _refresh_ctrl, CACHE_TTL, IDLE_TIMEOUT,
    )
    now = _time.time()
    idle_secs = now - _activity["ts"] if _activity["ts"] > 0 else None
    enabled = _refresh_ctrl["enabled"]
    return {
        "matches": {
            "age_s": int(now - _cache["ts"]) if _cache["data"] is not None else None,
            "count": len(_cache["data"]) if _cache["data"] is not None else None,
        },
        "standings": {
            "age_s": int(now - _standings_cache["ts"]) if _standings_cache["data"] is not None else None,
            "count": len(_standings_cache["data"]) if _standings_cache["data"] is not None else None,
        },
        "background": {
            "enabled": enabled,
            "active": enabled and idle_secs is not None and idle_secs < IDLE_TIMEOUT,
            "idle_s": int(idle_secs) if idle_secs is not None else None,
            "refresh_interval_s": _refresh_ctrl["interval"],
            "idle_timeout_s": IDLE_TIMEOUT,
            "cache_ttl_s": CACHE_TTL,
        },
    }


@router.post("/scrapster-cache-status/toggle")
def toggle_scrapster_refresh(_: User = Depends(require_admin)):
    """Zet de automatische achtergrond-refresh aan of uit en sla op in DB."""
    from routers.scrapster import _refresh_ctrl
    from models.settings import AppSetting
    from sqlmodel import Session as _Session
    from core.database import engine as _engine
    _refresh_ctrl["enabled"] = not _refresh_ctrl["enabled"]
    with _Session(_engine) as s:
        row = s.get(AppSetting, "scrapster.refresh_enabled")
        if row:
            row.value = "1" if _refresh_ctrl["enabled"] else "0"
        else:
            s.add(AppSetting(key="scrapster.refresh_enabled", value="1" if _refresh_ctrl["enabled"] else "0"))
        s.commit()
    return {"enabled": _refresh_ctrl["enabled"]}


class ScrapsterIntervalIn(BaseModel):
    interval: int


@router.patch("/scrapster-cache-status/interval")
def set_scrapster_interval(body: ScrapsterIntervalIn, _: User = Depends(require_admin)):
    """Stel de refresh-interval in (minimaal 10 seconden) en sla op in DB."""
    from routers.scrapster import _refresh_ctrl
    from models.settings import AppSetting
    from sqlmodel import Session as _Session
    from core.database import engine as _engine
    interval = max(10, body.interval)
    _refresh_ctrl["interval"] = interval
    with _Session(_engine) as s:
        row = s.get(AppSetting, "scrapster.refresh_interval")
        if row:
            row.value = str(interval)
        else:
            s.add(AppSetting(key="scrapster.refresh_interval", value=str(interval)))
        s.commit()
    return {"interval": interval}


@router.get("/site-events")
def get_site_events(
    site: str,
    hour: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = 100,
    _: User = Depends(require_admin),
):
    """Gedetailleerde events voor een site, optioneel gefilterd op uur en type."""
    from sqlmodel import Session as _Session
    from core.database import engine as _engine
    from sqlalchemy import text as _text

    where = ["site = :site"]
    params: dict = {"site": site, "limit": limit}

    if hour:
        where.append("strftime('%Y-%m-%d %H:00:00', ts) = :hour")
        params["hour"] = hour
    if event_type:
        where.append("event_type = :event_type")
        params["event_type"] = event_type

    where_sql = " AND ".join(where)

    with _Session(_engine) as session:
        rows = session.exec(_text(f"""
            SELECT ts, event_type, ip_hash, user_agent, source_url,
                   duration_ms, status_code, result_count, endpoint, token
            FROM site_events
            WHERE {where_sql}
            ORDER BY ts DESC
            LIMIT :limit
        """), params=params).all()

    return {"events": [
        {
            "ts": r[0], "event_type": r[1], "ip_hash": r[2],
            "user_agent": r[3], "source_url": r[4],
            "duration_ms": r[5], "status_code": r[6],
            "result_count": r[7], "endpoint": r[8], "token": r[9],
        }
        for r in rows
    ]}


@router.get("/site-stats")
def get_site_stats(_: User = Depends(require_admin)):
    """Return aggregated analytics per public site from site_events."""
    from core.analytics import log_site_event  # noqa: F401 — ensures module is importable
    from sqlmodel import Session as _Session
    from core.database import engine as _engine
    from sqlalchemy import text as _text

    with _Session(_engine) as session:
        sites_rows = session.exec(_text("SELECT DISTINCT site FROM site_events")).all()
        sites = [r[0] for r in sites_rows]

        result = {}
        for site in sites:
            today = session.exec(_text("""
                SELECT
                    SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END),
                    COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN ip_hash END),
                    SUM(CASE WHEN event_type = 'api_call' THEN 1 ELSE 0 END)
                FROM site_events
                WHERE site = :site AND ts >= date('now')
            """), params={"site": site}).first()

            week = session.exec(_text("""
                SELECT
                    SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END),
                    COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN ip_hash END)
                FROM site_events
                WHERE site = :site AND ts >= datetime('now', '-7 days')
            """), params={"site": site}).first()

            source = session.exec(_text("""
                SELECT
                    ROUND(AVG(duration_ms)),
                    ROUND(
                        100.0 * SUM(CASE WHEN status_code > 0 AND status_code < 400 THEN 1 ELSE 0 END)
                        / NULLIF(COUNT(*), 0)
                    , 1),
                    MAX(ts)
                FROM site_events
                WHERE site = :site AND event_type = 'source_call'
                AND ts >= datetime('now', '-24 hours')
            """), params={"site": site}).first()

            hourly_rows = session.exec(_text("""
                SELECT strftime('%Y-%m-%d %H:00:00', ts), COUNT(*)
                FROM site_events
                WHERE site = :site AND ts >= datetime('now', '-24 hours')
                GROUP BY strftime('%Y-%m-%d %H:00:00', ts)
                ORDER BY 1
            """), params={"site": site}).all()

            result[site] = {
                "today": {
                    "page_views": today[0] or 0,
                    "unique_visitors": today[1] or 0,
                    "api_calls": today[2] or 0,
                },
                "week": {
                    "page_views": week[0] or 0,
                    "unique_visitors": week[1] or 0,
                },
                "source": {
                    "avg_duration_ms": (source[0] or 0) if source else 0,
                    "success_rate": (source[1] or 0) if source else 0,
                    "last_fetch_at": source[2] if source else None,
                },
                "hourly": [{"hour": r[0], "count": r[1]} for r in hourly_rows],
            }

    return {"sites": result}


# ── Admin: Audit log ──────────────────────────────────────────────────────────

@router.get("/audit-log")
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
