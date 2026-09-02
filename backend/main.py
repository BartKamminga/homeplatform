import logging
import time
import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler as _default_http_handler
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from sentry_sdk.integrations.logging import LoggingIntegration
from sqlalchemy.exc import IntegrityError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from core.database import create_db_and_tables
from core.exceptions import AppError
from core.limiter import limiter
from core.settings import settings
from core.stats import api_call_stats

_LEVEL_ORDER = {"debug": 0, "info": 1, "warning": 2, "error": 3, "fatal": 4}

def _before_send(event, hint):
    lvl = event.get("level", "error")
    min_lvl = settings.SENTRY_MIN_LEVEL.lower()
    if _LEVEL_ORDER.get(lvl, 3) < _LEVEL_ORDER.get(min_lvl, 2):
        return None
    return event

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        traces_sample_rate=0.1,
        integrations=[
            LoggingIntegration(level=logging.WARNING, event_level=logging.ERROR),
        ],
        before_send=_before_send,
    )

from routers import system_public, system_admin, auth, users, groups, themes, sites, audit  # noqa: E402
from routers import mixmusic, changelog, tracking, dontforget, uploads, bug_reports, push  # noqa: E402
from routers import tournix, fiets, backup  # noqa: E402
from routers import tournix_import  # noqa: E402
from routers.backup import backup_router  # noqa: E402
from routers import roadmap  # noqa: E402
from routers import downloader  # noqa: E402
from routers import app_settings  # noqa: E402
from routers import capture  # noqa: E402
from routers import hockey_clubs  # noqa: E402
from routers import hockey_team_detail  # noqa: E402
from routers import hockey_capture  # noqa: E402
from routers import hockey_plugin_errors  # noqa: E402
from routers import hockey_vanger_queue_filters  # noqa: E402
from routers import hockey_vanger_poule_queue  # noqa: E402
from routers import hockey_vanger_heartbeat  # noqa: E402
from routers import hockey_vanger_calendar  # noqa: E402
from routers import hockey_vanger_cmd_queue  # noqa: E402
from routers import hockey_vanger_cmd_queue_debug  # noqa: E402
from routers import hockey_vanger_schedule_debug  # noqa: E402
from routers import hockey_vanger_smartscan_control  # noqa: E402
from routers import hockey_vanger_gap_analysis  # noqa: E402
from routers import hockey_vanger_sync  # noqa: E402
from routers import hockey_public  # noqa: E402
from routers import hockey_publication  # noqa: E402
from routers import hockey_query  # noqa: E402
from routers import hockey_scenario  # noqa: E402
from routers import poulebord  # noqa: E402
from routers import infra  # noqa: E402
from routers import agent_control  # noqa: E402
from routers import mindbox  # noqa: E402
from routers import mindbox_contacts  # noqa: E402
from routers import mindbox_commands  # noqa: E402
from routers.scrapster import router as scrapster_router, _background_refresh_loop  # noqa: E402

logger = logging.getLogger("homeplatform")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    import asyncio as _asyncio
    create_db_and_tables()
    if not settings.is_dev and settings.SECRET_KEY == "dev-secret-change-me":
        logger.warning("SECRET_KEY is still the default dev value — change it in production!")

    from routers.downloader_helpers import get_app_setting as _get_setting
    from routers.downloader_worker import reinit_semaphore, run_download as _run_download
    reinit_semaphore(int(_get_setting("beatcrades.max_concurrent", "2")))

    stale_ids = downloader.reset_stale_jobs()
    for _job_id in stale_ids:
        _asyncio.create_task(_run_download(_job_id))

    _asyncio.create_task(_background_refresh_loop())

    yield


app = FastAPI(
    title="Homeplatform API",
    version="0.2.0",
    docs_url="/api/docs" if settings.is_dev else None,
    redoc_url="/api/redoc" if settings.is_dev else None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    ms = (time.time() - start) * 1000
    logger.info("%s %s %s %.0fms", request.method, request.url.path, response.status_code, ms)
    route = request.scope.get("route")
    path = route.path if route else request.url.path
    api_call_stats[f"{request.method} {path}"] += 1
    return response


@app.exception_handler(HTTPException)
async def sentry_http_exception_handler(request: Request, exc: HTTPException):
    if settings.SENTRY_DSN:
        level = "error" if exc.status_code >= 500 else ("warning" if exc.status_code in (401, 403) else "info")
        with sentry_sdk.new_scope() as scope:
            scope.set_tag("http.status_code", exc.status_code)
            scope.set_tag("http.path", str(request.url.path))
            scope.set_tag("http.method", request.method)
            sentry_sdk.capture_message(f"HTTP {exc.status_code}: {exc.detail}", level=level)
    return await _default_http_handler(request, exc)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    if settings.SENTRY_DSN and exc.status_code >= 500:
        sentry_sdk.capture_exception(exc)
    body = {"detail": exc.detail}
    if exc.code:
        body["code"] = exc.code
    if exc.extra:
        body["extra"] = exc.extra
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    logger.error("IntegrityError op %s: %s", request.url.path, exc)
    if settings.SENTRY_DSN:
        sentry_sdk.capture_exception(exc)
    return JSONResponse(status_code=409, content={"detail": "Dubbele waarde of database-conflict"})


app.include_router(system_public.router)
app.include_router(system_admin.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(groups.router)
app.include_router(themes.router)
app.include_router(sites.router)
app.include_router(audit.router)
app.include_router(mixmusic.router)
app.include_router(changelog.router)
app.include_router(tracking.router)
app.include_router(dontforget.router)
app.include_router(uploads.router)
app.include_router(mindbox.router)
app.include_router(mindbox_contacts.router)
app.include_router(mindbox_commands.router)
app.include_router(bug_reports.router)
app.include_router(push.router)
app.include_router(tournix.router)
app.include_router(tournix_import.router)
app.include_router(fiets.router)
app.include_router(backup.router)
app.include_router(backup_router)
app.include_router(roadmap.router)
app.include_router(downloader.router)
app.include_router(app_settings.router)
app.include_router(capture.router)
app.include_router(hockey_clubs.router)
app.include_router(hockey_team_detail.router)
app.include_router(hockey_capture.router)
app.include_router(hockey_plugin_errors.router)
app.include_router(hockey_vanger_queue_filters.router)
app.include_router(hockey_vanger_poule_queue.router)
app.include_router(hockey_vanger_heartbeat.router)
app.include_router(hockey_vanger_calendar.router)
app.include_router(hockey_vanger_cmd_queue.router)
app.include_router(hockey_vanger_cmd_queue_debug.router)
app.include_router(hockey_vanger_schedule_debug.router)
app.include_router(hockey_vanger_smartscan_control.router)
app.include_router(hockey_vanger_gap_analysis.router)
app.include_router(hockey_vanger_sync.router)
app.include_router(hockey_public.router)
app.include_router(hockey_publication.router)
app.include_router(hockey_query.router)
app.include_router(hockey_scenario.router)
app.include_router(poulebord.router)
app.include_router(scrapster_router)
app.include_router(infra.router)
app.include_router(agent_control.router)


@app.get("/")
def root():
    return {"message": "Homeplatform API", "docs": "/api/docs"}
