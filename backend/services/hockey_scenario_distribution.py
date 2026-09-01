"""Kans per eindpositie voor Hockey Discovery (item 963-vervolg) - 2e
concrete toepassing van de generieke simulatie-engine, naast het
positie-scenario in hockey_scenario.py. In plaats van 1 ja/nee-vraag per
positie ("haalt team X positie <=N") berekent dit in 1x de kans op elke
mogelijke eindpositie - herbruikt dezelfde bounds/pruning/aannames als
hockey_scenario.py, dus dezelfde caveats en dezelfde "wat als"-ondersteuning
(fixed_outcomes)."""

from dataclasses import dataclass
from typing import Dict, List, Optional

from services.hockey_scenario import CAVEATS, MAX_EXACT_COMBINATIONS, SAMPLE_SIZE, _apply_fixed_outcomes, _build_elements, _position_of
from services.hockey_scenario_bounds import relevant_matches
from services.hockey_scenario_format import describe_outcome
from services.hockey_scenario_poisson import build_poisson_elements
from services.hockey_scenario_types import MatchFixture, TeamStat
from services.scenario_engine import run_distribution


@dataclass(frozen=True)
class PositionDistributionSummary:
    team_id: int
    team_name: str
    team_count: int
    method_used: str
    confidence: str
    combinations_total: int
    combinations_considered: int
    # positie (1..team_count) -> kans (0..1)
    position_probabilities: Dict[int, float]
    caveats: List[str]


def simulate_position_distribution(
    standings: List[TeamStat], remaining: List[MatchFixture], team_id: int,
    target_position: Optional[int] = None, comparator: str = "lte", method: str = "auto",
    max_combinations: int = MAX_EXACT_COMBINATIONS, sample_size: int = SAMPLE_SIZE,
    fixed_outcomes: Optional[Dict[int, str]] = None,
) -> PositionDistributionSummary:
    """target_position/comparator worden genegeerd - alleen aanwezig zodat dit
    type via dezelfde generieke router-aanroep als 'position' te gebruiken is
    (services/scenario_types.py::SCENARIO_TYPE_REGISTRY)."""
    target = next((s for s in standings if s.team_id == team_id), None)
    if target is None:
        raise ValueError(f"team {team_id} niet gevonden in deze poule-stand")

    caveats = list(CAVEATS)
    if fixed_outcomes:
        standings, remaining, fixed_applied = _apply_fixed_outcomes(standings, remaining, fixed_outcomes)
        target = next(s for s in standings if s.team_id == team_id)
        name_lookup = {s.team_id: s.team_name for s in standings}
        for m in fixed_applied:
            outcome = fixed_outcomes[m.match_id]
            caveats.append(
                f"Aanname: {describe_outcome(outcome, name_lookup.get(m.home_team_id), name_lookup.get(m.away_team_id))} "
                f"({name_lookup.get(m.home_team_id)} vs {name_lookup.get(m.away_team_id)})."
            )

    # Positie-onafhankelijk: dezelfde contested-teams-pruning geldt voor elke
    # doelpositie (zie hockey_scenario_bounds.py) - comparator="lte" gebruikt
    # dus altijd de volledige, positie-onafhankelijke relevantieset.
    pruned = relevant_matches(standings, remaining, team_id, "lte")
    base_state = {s.team_id: s for s in standings}
    if method == "poisson":
        elements = build_poisson_elements(standings, pruned)
        engine_method = "auto"  # exact/monte_carlo blijft een enumeratiedetail, poisson kiest alleen het kansmodel
        caveats.append(
            "Kansen per wedstrijd geschat met een Bayesiaans/Poisson teamsterkte-model (aanval/verdediging uit "
            "doelpunten in deze poule dit seizoen), niet de standaard aanname van gelijke kansen per uitslag. "
            "Bij weinig gespeelde wedstrijden per team blijft de schatting onzeker ondanks shrinkage naar het "
            "poule-gemiddelde. Model is Poisson, geen Negative Binomial - overdispersie in doelpunten wordt niet "
            "gedetecteerd."
        )
    else:
        elements = _build_elements(pruned)
        engine_method = method
    result = run_distribution(
        base_state, elements, lambda state: _position_of(state, team_id),
        method=engine_method, max_combinations=max_combinations, sample_size=sample_size,
    )

    if len(pruned) < len(remaining):
        caveats.append(
            f"{len(remaining) - len(pruned)} resterende wedstrijden hebben geen invloed op deze vraag en zijn genegeerd."
        )
    if result.method_used == "monte_carlo":
        caveats.append(
            f"Schatting op basis van een steekproef van {result.combinations_considered} "
            f"van {result.combinations_total} mogelijke scenario's."
        )

    considered = result.combinations_considered or 1
    probabilities = {
        position + 1: result.value_counts.get(position + 1, 0) / considered
        for position in range(len(standings))
    }

    return PositionDistributionSummary(
        team_id=team_id, team_name=target.team_name, team_count=len(standings),
        method_used=result.method_used, confidence="exact" if result.method_used == "exact" else "sampled",
        combinations_total=result.combinations_total, combinations_considered=result.combinations_considered,
        position_probabilities=probabilities, caveats=caveats,
    )


POSITION_DISTRIBUTION_SCENARIO_TYPE = {
    "key": "position_distribution",
    "label": "Kans per eindpositie",
    "params": [
        {"name": "team_id", "type": "integer", "required": True, "desc": "hockey.nl team id"},
        {"name": "method", "type": "string", "required": False,
         "desc": "'auto' (standaard), 'exact', 'monte_carlo', of 'poisson' (Bayesiaans teamsterkte-model i.p.v. "
                 "gelijke kans per uitslag, item 1030)"},
        {"name": "fixed_outcomes", "type": "object", "required": False,
         "desc": "'Wat als'-aannames: {match_id: 'H'|'D'|'A'}"},
    ],
    "run": simulate_position_distribution,
}
