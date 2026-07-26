"""Tournix router — thin aggregator."""

from fastapi import APIRouter

from routers.tournix_tournaments import router as tournaments_router
from routers.tournix_teams import router as teams_router  # bevat Poulebord public endpoints

router = APIRouter()

router.include_router(tournaments_router)
router.include_router(teams_router)
