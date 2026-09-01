"""Gedeelde databouwstenen voor poule-scenario-simulatie (item 963) - los
bestand om een circulaire import tussen hockey_scenario.py en
hockey_scenario_bounds.py te vermijden."""

from dataclasses import dataclass
from typing import Optional

POINTS_WIN, POINTS_DRAW, POINTS_LOSS = 3, 1, 0  # AANNAME: KNHB-puntenregel


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
