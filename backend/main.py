import logging
import time
import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler as _default_http_handler
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sentry_sdk.integrations.logging import LoggingIntegration

from core.database import create_db_and_tables
from core.settings import settings

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

from routers import system, auth, users, groups, themes, sites, audit
from routers import mixmusic
from routers import changelog
from routers import tracking
from routers import dontforget
from routers import uploads

logger = logging.getLogger("homeplatform")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(
    title="Homeplatform API",
    version="0.2.0",
    docs_url="/api/docs" if settings.is_dev else None,
    redoc_url="/api/redoc" if settings.is_dev else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        ["http://localhost:5172", "http://localhost:3000"]
        if settings.is_dev
        else ["https://jouwdomein.nl"]
    ),
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
    return response


@app.exception_handler(HTTPException)
async def sentry_http_exception_handler(request: Request, exc: HTTPException):
    if settings.SENTRY_DSN:
        if exc.status_code >= 500:
            level = "error"
        elif exc.status_code in (401, 403):
            level = "warning"
        else:
            level = "info"
        with sentry_sdk.new_scope() as scope:
            scope.set_tag("http.status_code", exc.status_code)
            scope.set_tag("http.path", str(request.url.path))
            scope.set_tag("http.method", request.method)
            sentry_sdk.capture_message(
                f"HTTP {exc.status_code}: {exc.detail}", level=level
            )
    return await _default_http_handler(request, exc)


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


@app.get("/")
def root():
    return {"message": "Homeplatform API", "docs": "/api/docs"}
