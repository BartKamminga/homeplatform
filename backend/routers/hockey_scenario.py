"""Poule-scenario-simulatie (item 963) - generiek dispatch-endpoint over
SCENARIO_TYPE_REGISTRY; publieke, auth-loze conventie zoals hockey_public.py."""

from dataclasses import asdict
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from core.database import get_session
from models.hockey_discovery import HockeyPoule
from services.hockey_scenario import MATCH_OUTCOMES, load_poule_inputs
from services.scenario_types import SCENARIO_TYPE_REGISTRY

router = APIRouter(prefix="/api/hockey", tags=["hockey-scenario"])


def _parse_fixed(fixed: List[str]) -> Tuple[Dict[int, str], Dict[int, Tuple[int, int]]]:
    """'Wat als'-aannames uit de querystring: 'matchId:H|D|A' (item 963),
    optioneel aangevuld met een score 'matchId:H|D|A:thuisdoelpunten:uitdoelpunten'
    (item 1034) - de score moet overeenkomen met de opgegeven uitslag, anders 400
    (voorkomt dat een encoding-bug in de frontend stilzwijgend een van de twee
    negeert)."""
    outcomes: Dict[int, str] = {}
    scores: Dict[int, Tuple[int, int]] = {}
    usage = "verwacht 'matchId:H|D|A' of 'matchId:H|D|A:thuisdoelpunten:uitdoelpunten'"
    for item in fixed:
        parts = item.split(":")
        if len(parts) not in (2, 4):
            raise HTTPException(400, f"ongeldige fixed-waarde: {item!r} ({usage})")
        match_id_str, outcome = parts[0], parts[1]
        if not match_id_str.isdigit() or outcome not in MATCH_OUTCOMES:
            raise HTTPException(400, f"ongeldige fixed-waarde: {item!r} ({usage})")
        match_id = int(match_id_str)
        outcomes[match_id] = outcome
        if len(parts) == 4:
            home_str, away_str = parts[2], parts[3]
            if not (home_str.isdigit() and away_str.isdigit()):
                raise HTTPException(400, f"ongeldige score in fixed-waarde: {item!r} ({usage})")
            home_goals, away_goals = int(home_str), int(away_str)
            implied = "H" if home_goals > away_goals else ("A" if home_goals < away_goals else "D")
            if implied != outcome:
                raise HTTPException(
                    400, f"score {home_goals}-{away_goals} in {item!r} komt niet overeen met uitslag {outcome!r}",
                )
            scores[match_id] = (home_goals, away_goals)
    return outcomes, scores


@router.get("/public/hockey-poules/{pid}/simulate")
def simulate_poule_scenario(
    pid: int,
    team_id: int = Query(...),
    target_position: Optional[int] = Query(None),
    scenario_type: str = Query("position", alias="type"),
    comparator: str = Query("lte"),
    method: str = Query("auto"),
    fixed: List[str] = Query([]),
    session: Session = Depends(get_session),
):
    poule = session.get(HockeyPoule, pid)
    if not poule:
        raise HTTPException(404, "Poule niet gevonden")

    scenario = SCENARIO_TYPE_REGISTRY.get(scenario_type)
    if not scenario:
        raise HTTPException(400, f"Onbekend simulatietype: {scenario_type}")
    if scenario_type == "position" and target_position is None:
        raise HTTPException(400, "target_position is verplicht voor type='position'")
    if comparator not in ("lte", "eq", "gte"):
        raise HTTPException(400, "comparator moet 'lte', 'eq' of 'gte' zijn")
    if method not in ("auto", "exact", "monte_carlo", "poisson"):
        raise HTTPException(400, "method moet 'auto', 'exact', 'monte_carlo' of 'poisson' zijn")
    fixed_outcomes, fixed_scores = _parse_fixed(fixed)

    standings, remaining = load_poule_inputs(session, poule.poule_id)
    try:
        summary = scenario["run"](
            standings, remaining, team_id=team_id, target_position=target_position,
            comparator=comparator, method=method, fixed_outcomes=fixed_outcomes, fixed_scores=fixed_scores,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    return {
        "poule_id": pid, "poule_name": poule.name, "type": scenario_type,
        **asdict(summary),
    }
