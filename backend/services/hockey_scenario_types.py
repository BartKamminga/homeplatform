"""Gedeelde databouwstenen voor poule-scenario-simulatie (item 963) - los
bestand om een circulaire import tussen hockey_scenario.py en
hockey_scenario_bounds.py/hockey_scenario_poisson.py te vermijden."""

from dataclasses import dataclass
from typing import Dict, Optional, Tuple

POINTS_WIN, POINTS_DRAW, POINTS_LOSS = 3, 1, 0  # AANNAME: KNHB-puntenregel
_RESULT_POINTS = {"win": POINTS_WIN, "draw": POINTS_DRAW, "loss": POINTS_LOSS}


@dataclass(frozen=True)
class TeamStat:
    team_id: int
    team_name: str
    played: int
    won: int
    drawn: int
    lost: int
    goals_for: int
    goals_against: int
    points: int

    @property
    def goal_diff(self) -> int:
        return self.goals_for - self.goals_against


@dataclass(frozen=True)
class MatchFixture:
    match_id: Optional[int]
    home_team_id: int
    away_team_id: int
    round: Optional[int] = None


def bump_with_score(stat: TeamStat, result: str, goals_for: int, goals_against: int) -> TeamStat:
    """Als hockey_scenario.py::_bump, maar telt ook de doelpunten van deze
    ene wedstrijd mee op - gedeeld tussen hockey_scenario_poisson.py (item
    1030) en de score-invoer bij wat-als-aannames (item 1034)."""
    return TeamStat(
        team_id=stat.team_id, team_name=stat.team_name, played=stat.played + 1,
        won=stat.won + (1 if result == "win" else 0),
        drawn=stat.drawn + (1 if result == "draw" else 0),
        lost=stat.lost + (1 if result == "loss" else 0),
        goals_for=stat.goals_for + goals_for,
        goals_against=stat.goals_against + goals_against,
        points=stat.points + _RESULT_POINTS[result],
    )


def apply_score_outcome(state: Dict[int, TeamStat], fixture: MatchFixture, score: Tuple[int, int]) -> Dict[int, TeamStat]:
    """Als hockey_scenario.py::_apply_outcome, maar op basis van een exacte
    score i.p.v. alleen H/D/A - werkt het doelsaldo van deze ene wedstrijd
    bij in plaats van het ongewijzigd te laten."""
    home_goals, away_goals = score
    if home_goals > away_goals:
        home_result, away_result = "win", "loss"
    elif home_goals < away_goals:
        home_result, away_result = "loss", "win"
    else:
        home_result, away_result = "draw", "draw"
    new_state = dict(state)
    new_state[fixture.home_team_id] = bump_with_score(state[fixture.home_team_id], home_result, home_goals, away_goals)
    new_state[fixture.away_team_id] = bump_with_score(state[fixture.away_team_id], away_result, away_goals, home_goals)
    return new_state
