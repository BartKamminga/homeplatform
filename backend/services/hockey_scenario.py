"""Poule-eindpositie-scenario voor Hockey Discovery (item 963) - eerste
concrete toepassing van de generieke simulatie-engine
(services/scenario_engine.py). Rekenkern is DB-onafhankelijk (werkt op
TeamStat/MatchFixture-lijsten) - alleen load_poule_inputs() kent de DB.

AANNAME (expliciet, want Hockey Discovery levert zelf geen puntenregel/
tiebreak - de stand komt 1-op-1 van hockey.nl): puntenregel 3/1/0, tiebreak
op (-punten, -doelsaldo, -doelpunten voor, team_id) zonder onderling
resultaat of loting. Doelsaldo van nog te spelen wedstrijden wordt niet
gesimuleerd - elke resterende wedstrijd heeft 3 uitkomsten (thuiswinst/
gelijk/uitwinst), geen score, om de combinatorische ruimte niet nog groter
te maken. Deze beperkingen staan als caveat in elke ScenarioSummary zodat
een LLM ze niet als harde zekerheid navertelt."""

from dataclasses import dataclass
from typing import Dict, List, Literal, Optional, Tuple

from sqlmodel import Session, select

from models.hockey_discovery import HockeyPouleMatch, HockeyPouleStanding
from services.hockey_scenario_bounds import bound_verdict, relevant_matches
from services.hockey_scenario_format import describe_examples, describe_outcome, outcome_hint
from services.hockey_scenario_poisson import bucket_outcome_breakdown, build_poisson_elements
from services.hockey_scenario_types import (
    POINTS_DRAW, POINTS_LOSS, POINTS_WIN, MatchFixture, TeamStat, apply_score_outcome,
)
from services.scenario_engine import ScenarioSpec, VariableElement, run_scenario

MATCH_OUTCOMES = ("H", "D", "A")  # thuiswinst / gelijk / uitwinst
# Gemeten (item 963-vervolg): elke exacte combo kost ~40 microseconde in deze
# Python-implementatie, dus 200.000 was in de praktijk 8+ seconden - te traag
# voor een request. 20.000 combo's (<=9 resterende wedstrijden) blijft <1s en
# geeft daarna een voorspelbare, gelijkblijvende looptijd via de steekproef
# i.p.v. een sprong naar seconden zodra er 1 wedstrijd minder open staat.
MAX_EXACT_COMBINATIONS = 20_000
SAMPLE_SIZE = 20_000

CAVEATS = [
    "Puntenregel 3 (winst) / 1 (gelijk) / 0 (verlies).",
    "Tiebreak op doelsaldo en doelpunten voor - geen onderling resultaat of loting.",
    "Doelsaldo van nog te spelen wedstrijden wordt niet gesimuleerd (alleen de uitslag telt).",
]

_RESULT_POINTS = {"win": POINTS_WIN, "draw": POINTS_DRAW, "loss": POINTS_LOSS}
_OUTCOME_RESULTS = {"H": ("win", "loss"), "D": ("draw", "draw"), "A": ("loss", "win")}


@dataclass(frozen=True)
class ScenarioSummary:
    team_id: int
    team_name: str
    target_position: int
    comparator: str
    method_used: str
    verdict: Literal["guaranteed", "impossible", "depends"]
    confidence: Literal["exact", "sampled"]
    combinations_total: int
    combinations_considered: int
    goal_probability: Optional[float]
    pivotal_matches: List[dict]
    satisfying_examples: List[list]
    failing_examples: List[list]
    caveats: List[str]
    standings: List[dict]  # na eventuele fixed_outcomes herberekende stand (item 1034), PoolTable-vriendelijke vorm


def load_poule_inputs(session: Session, poule_id: int) -> Tuple[List[TeamStat], List[MatchFixture]]:
    """poule_id = hockey.nl poule-id (HockeyPoule.poule_id), niet de interne PK."""
    standings = [
        TeamStat(
            team_id=r.team_id, team_name=r.team_name, played=r.played, won=r.won,
            drawn=r.drawn, lost=r.lost, goals_for=r.goals_for, goals_against=r.goals_against,
            points=r.points,
        )
        for r in session.exec(
            select(HockeyPouleStanding).where(HockeyPouleStanding.poule_id == poule_id)
        ).all()
    ]
    remaining = [
        MatchFixture(match_id=m.match_id, home_team_id=m.home_team_id, away_team_id=m.away_team_id, round=m.round)
        for m in session.exec(
            select(HockeyPouleMatch)
            .where(HockeyPouleMatch.poule_id == poule_id)
            .where(HockeyPouleMatch.status != "final")
        ).all()
        if m.home_team_id is not None and m.away_team_id is not None
    ]
    return standings, remaining


def _bump(stat: TeamStat, result: str) -> TeamStat:
    return TeamStat(
        team_id=stat.team_id, team_name=stat.team_name, played=stat.played + 1,
        won=stat.won + (1 if result == "win" else 0),
        drawn=stat.drawn + (1 if result == "draw" else 0),
        lost=stat.lost + (1 if result == "loss" else 0),
        goals_for=stat.goals_for, goals_against=stat.goals_against,
        points=stat.points + _RESULT_POINTS[result],
    )


def _apply_outcome(state: Dict[int, TeamStat], fixture: MatchFixture, outcome: str) -> Dict[int, TeamStat]:
    home_result, away_result = _OUTCOME_RESULTS[outcome]
    new_state = dict(state)
    new_state[fixture.home_team_id] = _bump(state[fixture.home_team_id], home_result)
    new_state[fixture.away_team_id] = _bump(state[fixture.away_team_id], away_result)
    return new_state


def _ranked_standings(state: Dict[int, TeamStat]) -> List[TeamStat]:
    # AANNAME: tiebreak zonder onderling resultaat/loting - team_id als
    # stabiele laatste sleutel (zie moduledocstring).
    return sorted(state.values(), key=lambda s: (-s.points, -s.goal_diff, -s.goals_for, s.team_id))


def _position_of(state: Dict[int, TeamStat], team_id: int) -> int:
    for i, s in enumerate(_ranked_standings(state)):
        if s.team_id == team_id:
            return i + 1
    raise KeyError(f"team {team_id} niet gevonden in de simulatie-state")


def _serialize_standings(standings: List[TeamStat]) -> List[dict]:
    """Voor ScenarioSummary.standings (item 1034) - PoolTable.jsx-vriendelijke
    vorm (frontend/sites/poulebord/PoolTable.jsx), in poule-volgorde."""
    return [
        {
            "team_id": s.team_id, "name": s.team_name, "pts": s.points,
            "played": s.played, "w": s.won, "d": s.drawn, "l": s.lost,
            "gf": s.goals_for, "ga": s.goals_against,
        }
        for s in _ranked_standings({s.team_id: s for s in standings})
    ]


def _goal(team_id: int, target_position: int, comparator: str):
    def evaluate(state) -> bool:
        pos = _position_of(state, team_id)
        if comparator == "lte":
            return pos <= target_position
        if comparator == "eq":
            return pos == target_position
        return pos >= target_position
    return evaluate


def _build_elements(matches: List[MatchFixture]) -> List[VariableElement]:
    def make_apply(fixture: MatchFixture):
        return lambda state, outcome: _apply_outcome(state, fixture, outcome)
    return [
        VariableElement(key=f"match_{m.match_id if m.match_id is not None else i}", outcomes=MATCH_OUTCOMES, apply=make_apply(m))
        for i, m in enumerate(matches)
    ]


def _apply_fixed_outcomes(
    standings: List[TeamStat], remaining: List[MatchFixture], fixed_outcomes: Dict[int, str],
    fixed_scores: Optional[Dict[int, Tuple[int, int]]] = None,
) -> Tuple[List[TeamStat], List[MatchFixture], List[MatchFixture]]:
    """"Wat als"-ondersteuning: verwerkt vooraf aangenomen uitslagen (op
    match_id) direct in de stand, en haalt die wedstrijden uit de te
    simuleren verzameling - de rest van de engine hoeft hier niets van te
    weten. Onbekende match_id's of ongeldige uitkomsten worden genegeerd.

    fixed_scores is optioneel (item 1034) en per match_id een (h,a)-score -
    als die aanwezig is, telt ook het doelsaldo van die ene wedstrijd mee
    (apply_score_outcome), anders alleen de uitslag zoals voorheen (geen
    doelsaldo-wijziging, zie moduledocstring)."""
    fixed_matches = [m for m in remaining if m.match_id in fixed_outcomes]
    free_remaining = [m for m in remaining if m.match_id not in fixed_outcomes]

    state = {s.team_id: s for s in standings}
    for m in fixed_matches:
        outcome = fixed_outcomes[m.match_id]
        if outcome not in MATCH_OUTCOMES:
            continue
        score = (fixed_scores or {}).get(m.match_id)
        state = apply_score_outcome(state, m, score) if score is not None else _apply_outcome(state, m, outcome)
    return list(state.values()), free_remaining, fixed_matches


def simulate_position(
    standings: List[TeamStat], remaining: List[MatchFixture], team_id: int, target_position: int,
    comparator: str = "lte", method: str = "auto",
    max_combinations: int = MAX_EXACT_COMBINATIONS, sample_size: int = SAMPLE_SIZE,
    fixed_outcomes: Optional[Dict[int, str]] = None, fixed_scores: Optional[Dict[int, Tuple[int, int]]] = None,
) -> ScenarioSummary:
    target = next((s for s in standings if s.team_id == team_id), None)
    if target is None:
        raise ValueError(f"team {team_id} niet gevonden in deze poule-stand")

    caveats = list(CAVEATS)
    fixed_applied: List[MatchFixture] = []
    if fixed_outcomes:
        standings, remaining, fixed_applied = _apply_fixed_outcomes(standings, remaining, fixed_outcomes, fixed_scores)
        target = next(s for s in standings if s.team_id == team_id)
        name_lookup = {s.team_id: s.team_name for s in standings}
        for m in fixed_applied:
            outcome = fixed_outcomes[m.match_id]
            score = (fixed_scores or {}).get(m.match_id)
            score_suffix = f" ({score[0]}-{score[1]})" if score is not None else ""
            caveats.append(
                f"Aanname: {describe_outcome(outcome, name_lookup.get(m.home_team_id), name_lookup.get(m.away_team_id))}"
                f"{score_suffix} ({name_lookup.get(m.home_team_id)} vs {name_lookup.get(m.away_team_id)})."
            )

    verdict = bound_verdict(standings, remaining, team_id, target_position, comparator)
    if verdict is not None:
        return ScenarioSummary(
            team_id=team_id, team_name=target.team_name, target_position=target_position,
            comparator=comparator, method_used="bounds", verdict=verdict, confidence="exact",
            combinations_total=0, combinations_considered=0,
            goal_probability=1.0 if verdict == "guaranteed" else 0.0,
            pivotal_matches=[], satisfying_examples=[], failing_examples=[], caveats=caveats,
            standings=_serialize_standings(standings),
        )

    pruned = relevant_matches(standings, remaining, team_id, comparator)
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
    spec = ScenarioSpec(
        base_state=base_state, elements=elements,
        evaluate=_goal(team_id, target_position, comparator),
    )
    result = run_scenario(spec, method=engine_method, max_combinations=max_combinations, sample_size=sample_size)

    name_by_team = {s.team_id: s.team_name for s in standings}
    by_key = {
        f"match_{m.match_id if m.match_id is not None else i}": m for i, m in enumerate(pruned)
    }
    pivotal = []
    for key, m in by_key.items():
        home_name, away_name = name_by_team.get(m.home_team_id), name_by_team.get(m.away_team_id)
        breakdown = result.outcome_breakdown.get(key, {})
        if method == "poisson":
            breakdown = bucket_outcome_breakdown(breakdown)
        pivotal.append({
            "match_id": m.match_id, "round": m.round, "home_team": home_name, "away_team": away_name,
            "hint": outcome_hint(breakdown, home_name, away_name),
        })
    if len(pruned) < len(remaining):
        caveats.append(
            f"{len(remaining) - len(pruned)} resterende wedstrijden hebben geen invloed op deze vraag en zijn genegeerd."
        )
    if result.method_used == "monte_carlo":
        caveats.append(
            f"Schatting op basis van een steekproef van {result.combinations_considered} "
            f"van {result.combinations_total} mogelijke scenario's."
        )

    if result.method_used == "exact" and result.goal_probability == 1.0:
        overall_verdict = "guaranteed"
    elif result.method_used == "exact" and result.goal_probability == 0.0:
        overall_verdict = "impossible"
    else:
        overall_verdict = "depends"

    return ScenarioSummary(
        team_id=team_id, team_name=target.team_name, target_position=target_position, comparator=comparator,
        method_used=result.method_used, verdict=overall_verdict,
        confidence="exact" if result.method_used == "exact" else "sampled",
        combinations_total=result.combinations_total, combinations_considered=result.combinations_considered,
        goal_probability=result.goal_probability,
        pivotal_matches=pivotal,
        satisfying_examples=describe_examples(result.satisfying_examples, by_key, name_by_team),
        failing_examples=describe_examples(result.failing_examples, by_key, name_by_team),
        caveats=caveats,
        standings=_serialize_standings(standings),
    )


POSITION_SCENARIO_TYPE = {
    "key": "position",
    "label": "Eindpositie-scenario",
    "params": [
        {"name": "team_id", "type": "integer", "required": True, "desc": "hockey.nl team id"},
        {"name": "target_position", "type": "integer", "required": True, "desc": "Doelpositie (1 = kampioenschap)"},
        {"name": "comparator", "type": "string", "required": False,
         "desc": "'lte' (standaard, op positie N of beter), 'eq' (precies N), 'gte' (op positie N of slechter)"},
        {"name": "method", "type": "string", "required": False,
         "desc": "'auto' (standaard), 'exact', 'monte_carlo', of 'poisson' (Bayesiaans teamsterkte-model i.p.v. "
                 "gelijke kans per uitslag, item 1030)"},
        {"name": "fixed_outcomes", "type": "object", "required": False,
         "desc": "'Wat als'-aannames: {match_id: 'H'|'D'|'A'} - deze wedstrijden worden alvast in de stand "
                 "verwerkt en niet meer gesimuleerd."},
        {"name": "fixed_scores", "type": "object", "required": False,
         "desc": "Optioneel, per match_id in fixed_outcomes: {match_id: [thuisdoelpunten, uitdoelpunten]} - "
                 "telt ook het doelsaldo van die wedstrijd mee (item 1034), anders blijft het ongewijzigd."},
    ],
    "run": simulate_position,
}
