"""Bewijsbare bounds en pruning voor poule-positie-scenario's (item 963).

Deze functies leveren GEEN schatting maar een harde wiskundige garantie: als
bound_verdict "guaranteed" of "impossible" teruggeeft, geldt dat voor elke
denkbare combinatie van resterende uitslagen - zonder dat er 1 wedstrijd is
gesimuleerd. relevant_matches() sluit wedstrijden uit die de hoofdvraag
sowieso niet meer kunnen beinvloeden; dat verandert de uitkomst van een
volledige enumeratie niet, het verkleint alleen de zoekruimte.

Doelsaldo/doelpunten-voor van een team veranderen niet door nog te spelen
wedstrijden (AANNAME, zie services/hockey_scenario.py) - dus de tiebreak
tussen twee teams bij gelijke punten ligt NU al vast en wordt hier expliciet
meegenomen (_tiebreak_beats), niet genegeerd.

Fast-path (bound_verdict/relevant_matches) is alleen uitgewerkt voor
comparator="lte" (de hoofdvraag: "op positie N of beter eindigen", incl.
kampioenschap N=1). Voor "eq"/"gte" valt de simulatie terug op volledige
enumeratie/sampling - nog steeds correct, alleen niet versneld."""

from typing import Dict, List, Literal, Optional, Set, Tuple

from services.hockey_scenario_types import MatchFixture, TeamStat

POINTS_PER_WIN = 3


def _remaining_own_matches(team_id: int, remaining: List[MatchFixture]) -> int:
    return sum(1 for m in remaining if m.home_team_id == team_id or m.away_team_id == team_id)


def points_bracket(stat: TeamStat, remaining_own: int) -> Tuple[int, int]:
    """(min_points, max_points) die dit team aan het eind van het seizoen nog kan halen."""
    return stat.points, stat.points + POINTS_PER_WIN * remaining_own


def _brackets(standings: List[TeamStat], remaining: List[MatchFixture]) -> Dict[int, Tuple[int, int]]:
    return {s.team_id: points_bracket(s, _remaining_own_matches(s.team_id, remaining)) for s in standings}


def _tiebreak_beats(a: TeamStat, b: TeamStat) -> bool:
    """True als team a bij een gelijk puntentotaal voor team b eindigt."""
    return (-a.goal_diff, -a.goals_for, a.team_id) < (-b.goal_diff, -b.goals_for, b.team_id)


def _could_overtake(other: TeamStat, other_bracket: Tuple[int, int], target: TeamStat, target_bracket: Tuple[int, int]) -> bool:
    """True als 'other' in minstens 1 scenario voor 'target' kan eindigen."""
    _, o_max = other_bracket
    t_min, _ = target_bracket
    return o_max >= t_min if _tiebreak_beats(other, target) else o_max > t_min


def _surely_ahead(other: TeamStat, other_bracket: Tuple[int, int], target: TeamStat, target_bracket: Tuple[int, int]) -> bool:
    """True als 'other' in ELK scenario voor 'target' eindigt."""
    o_min, _ = other_bracket
    _, t_max = target_bracket
    return o_min >= t_max if _tiebreak_beats(other, target) else o_min > t_max


def contested_teams(standings: List[TeamStat], remaining: List[MatchFixture], team_id: int) -> Set[int]:
    """Teams waarvan 'wel/niet voor team_id eindigen' nog niet vastligt - alleen
    wedstrijden waarin team_id of een contested team meespeelt kunnen de
    positie-N-vraag nog beinvloeden."""
    target = next(s for s in standings if s.team_id == team_id)
    brackets = _brackets(standings, remaining)
    target_bracket = brackets[team_id]
    contested = set()
    for s in standings:
        if s.team_id == team_id:
            continue
        sb = brackets[s.team_id]
        if _could_overtake(s, sb, target, target_bracket) and not _surely_ahead(s, sb, target, target_bracket):
            contested.add(s.team_id)
    return contested


def bound_verdict(
    standings: List[TeamStat], remaining: List[MatchFixture], team_id: int,
    target_position: int, comparator: str,
) -> Optional[Literal["guaranteed", "impossible"]]:
    """Harde uitspraak zonder enumeratie, of None als het genuine 'depends' is
    (of als voor deze comparator geen fast-path is uitgewerkt)."""
    if comparator not in ("lte", "eq", "gte"):
        raise ValueError(f"onbekende comparator: {comparator}")

    target = next((s for s in standings if s.team_id == team_id), None)
    if target is None:
        return None

    brackets = _brackets(standings, remaining)
    target_bracket = brackets[team_id]
    others = [s for s in standings if s.team_id != team_id]

    surely_ahead_count = sum(1 for s in others if _surely_ahead(s, brackets[s.team_id], target, target_bracket))
    if comparator in ("lte", "eq") and surely_ahead_count >= target_position:
        return "impossible"  # al >= target_position teams die target_id gegarandeerd voorbij gaan

    if comparator == "lte":
        could_overtake_count = sum(1 for s in others if _could_overtake(s, brackets[s.team_id], target, target_bracket))
        if could_overtake_count < target_position:
            return "guaranteed"  # te weinig teams kunnen target_id nog inhalen

    return None


def relevant_matches(
    standings: List[TeamStat], remaining: List[MatchFixture], team_id: int, comparator: str,
) -> List[MatchFixture]:
    """Exacte (niet-heuristische) pruning: verwijderen van de uitgesloten
    wedstrijden verandert de uitkomst van volledige enumeratie niet."""
    if comparator != "lte":
        return list(remaining)  # geen pruning-fast-path voor eq/gte (zie moduledocstring)
    contested = contested_teams(standings, remaining, team_id)
    keep_ids = contested | {team_id}
    return [m for m in remaining if m.home_team_id in keep_ids or m.away_team_id in keep_ids]
