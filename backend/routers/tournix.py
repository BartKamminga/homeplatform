"""Tournix router — thin aggregator.

Sub-modules:
  tournix_tournaments  — tournament CRUD, stages, import
  tournix_teams        — teams, clubs
  tournix_pools        — pools, pool-team assignment
  tournix_matches      — matches, scores, standings, schedules, predictions, snapshots
  tournix_fields       — fields
"""

from fastapi import APIRouter

from routers.tournix_tournaments import router as tournaments_router
from routers.tournix_teams import router as teams_router
from routers.tournix_pools import router as pools_router
from routers.tournix_matches import router as matches_router
from routers.tournix_fields import router as fields_router
from routers.tournix_phases import router as phases_router

router = APIRouter()

router.include_router(tournaments_router)
router.include_router(teams_router)
router.include_router(pools_router)
router.include_router(matches_router)
router.include_router(fields_router)
router.include_router(phases_router)
