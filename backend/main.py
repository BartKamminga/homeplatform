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

from routers import system, auth, users, groups, themes, sites, audit  # noqa: E402
from routers import mixmusic, changelog, tracking, dontforget, uploads  # noqa: E402
from routers import tournix, fiets, backup  # noqa: E402
from routers import tournix_import  # noqa: E402
from routers.backup import backup_router  # noqa: E402
from routers import roadmap  # noqa: E402
from routers import downloader  # noqa: E402
from routers import app_settings  # noqa: E402

logger = logging.getLogger("homeplatform")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    create_db_and_tables()
    if not settings.is_dev and settings.SECRET_KEY == "dev-secret-change-me":
        logger.warning("SECRET_KEY is still the default dev value — change it in production!")
    downloader.reset_stale_jobs()
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
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    logger.error("IntegrityError op %s: %s", request.url.path, exc)
    if settings.SENTRY_DSN:
        sentry_sdk.capture_exception(exc)
    return JSONResponse(status_code=409, content={"detail": "Dubbele waarde of database-conflict"})


app.include_router(system.router)
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
app.include_router(tournix.router)
app.include_router(tournix_import.router)
app.include_router(fiets.router)
app.include_router(backup.router)
app.include_router(backup_router)
app.include_router(roadmap.router)
app.include_router(downloader.router)
app.include_router(app_settings.router)


@app.get("/")
def root():
    return {"message": "Homeplatform API", "docs": "/api/docs"}
