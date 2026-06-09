from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.database import create_db_and_tables
from core.settings import settings
from routers import system, auth, users, groups, themes, sites, audit
from routers import mixmusic
from routers import changelog
from routers import tracking
from routers import dontforget
from routers import uploads


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: zorg dat tabellen bestaan (dev fallback naast Alembic)
    create_db_and_tables()
    yield
    # Shutdown: hier eventueel cleanup


app = FastAPI(
    title="Homeplatform API",
    version="0.2.0",
    docs_url="/api/docs" if settings.is_dev else None,
    redoc_url="/api/redoc" if settings.is_dev else None,
    lifespan=lifespan,
)

# CORS: Vite dev server op poort 5173
app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        ["http://localhost:5173", "http://localhost:3000"]
        if settings.is_dev
        else ["https://jouwdomein.nl"]  # aanpassen voor productie
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
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
