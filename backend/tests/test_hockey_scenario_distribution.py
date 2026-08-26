"""Tests voor de kans-per-eindpositie-berekening (item 963-vervolg)."""

from services.hockey_scenario_distribution import simulate_position_distribution
from services.hockey_scenario_types import MatchFixture, TeamStat


def _team(team_id, name, points, gf=0, ga=0):
    return TeamStat(
        team_id=team_id, team_name=name, played=0, won=0, drawn=0, lost=0,
        goals_for=gf, goals_against=ga, points=points,
    )


def test_probabilities_sum_to_one_and_match_hand_computed_truth_table():
    standings = [_team(1, "A", 10), _team(2, "B", 10)]
    remaining = [MatchFixture(match_id=1, home_team_id=1, away_team_id=2)]
    summary = simulate_position_distribution(standings, remaining, team_id=1)

    assert summary.team_count == 2
    assert abs(sum(summary.position_probabilities.values()) - 1.0) < 1e-9
    # H of D -> A eerste (2 van de 3 uitkomsten), A (uitwinst B) -> A tweede
    assert summary.position_probabilities[1] == 2 / 3
    assert summary.position_probabilities[2] == 1 / 3


def test_already_decided_case_needs_no_enumeration():
    standings = [_team(1, "A", 30), _team(2, "B", 10)]
    remaining = [MatchFixture(match_id=1, home_team_id=2, away_team_id=1)]
    summary = simulate_position_distribution(standings, remaining, team_id=1)
    assert summary.position_probabilities[1] == 1.0
    assert summary.position_probabilities[2] == 0.0


def test_fixed_outcomes_shift_the_distribution():
    standings = [_team(1, "A", 10), _team(2, "B", 10)]
    remaining = [MatchFixture(match_id=1, home_team_id=1, away_team_id=2)]
    a_wins = simulate_position_distribution(standings, remaining, team_id=1, fixed_outcomes={1: "H"})
    assert a_wins.position_probabilities[1] == 1.0
    assert any("Aanname" in c for c in a_wins.caveats)


def test_monte_carlo_fallback_when_cap_exceeded():
    standings = [_team(1, "A", 10), _team(2, "B", 10)]
    remaining = [MatchFixture(match_id=i, home_team_id=1, away_team_id=2) for i in range(1, 4)]
    summary = simulate_position_distribution(
        standings, remaining, team_id=1, max_combinations=5, sample_size=2000,
    )
    assert summary.confidence == "sampled"
    assert abs(sum(summary.position_probabilities.values()) - 1.0) < 1e-9
    assert any("steekproef" in c for c in summary.caveats)
