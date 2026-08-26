"""Poule-scenario-simulatie (item 963) - generiek dispatch-endpoint over
SCENARIO_TYPE_REGISTRY; publieke, auth-loze conventie zoals hockey_public.py."""

from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from core.database import get_session
from models.hockey_discovery import HockeyPoule
from services.hockey_scenario import load_poule_inputs
from services.scenario_types import SCENARIO_TYPE_REGISTRY

router = APIRouter(prefix="/api/hockey", tags=["hockey-scenario"])


@router.get("/public/hockey-poules/{pid}/simulate")
def simulate_poule_scenario(
    pid: int,
    team_id: int = Query(...),
    target_position: int = Query(...),
    scenario_type: str = Query("position", alias="type"),
    comparator: str = Query("lte"),
    method: str = Query("auto"),
    session: Session = Depends(get_session),
):
    poule = session.get(HockeyPoule, pid)
    if not poule:
        raise HTTPException(404, "Poule niet gevonden")

    scenario = SCENARIO_TYPE_REGISTRY.get(scenario_type)
    if not scenario:
        raise HTTPException(400, f"Onbekend simulatietype: {scenario_type}")
    if comparator not in ("lte", "eq", "gte"):
        raise HTTPException(400, "comparator moet 'lte', 'eq' of 'gte' zijn")
    if method not in ("auto", "exact", "monte_carlo"):
        raise HTTPException(400, "method moet 'auto', 'exact' of 'monte_carlo' zijn")

    standings, remaining = load_poule_inputs(session, poule.poule_id)
    try:
        summary = scenario["run"](
            standings, remaining, team_id=team_id, target_position=target_position,
            comparator=comparator, method=method,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    return {
        "poule_id": pid, "poule_name": poule.name, "type": scenario_type,
        **asdict(summary),
    }
