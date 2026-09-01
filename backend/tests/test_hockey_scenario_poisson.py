"""Tests voor het Bayesiaans/Poisson teamsterkte-model (item 1030)."""

import pytest

from services.hockey_scenario_poisson import (
    DEFAULT_MU, MAX_GOALS_PER_TEAM, build_poisson_elements, estimate_team_strengths, match_score_distribution,
)
from services.hockey_scenario_types import MatchFixture, TeamStat


def _team(team_id, name, played=0, gf=0, ga=0, points=0):
    return TeamStat(
        team_id=team_id, team_name=name, played=played, won=0, drawn=0, lost=0,
        goals_for=gf, goals_against=ga, points=points,
    )


def test_team_with_no_matches_gets_neutral_strength():
    standings = [_team(1, "A", played=0), _team(2, "B", played=5, gf=15, ga=5)]
    strengths, mu = estimate_team_strengths(standings)
    assert strengths[1].attack == 1.0
    assert strengths[1].defense == 1.0


def test_mu_falls_back_to_default_without_any_played_matches():
    standings = [_team(1, "A"), _team(2, "B")]
    _, mu = estimate_team_strengths(standings)
    assert mu == DEFAULT_MU


def test_strong_attack_pulls_estimate_above_one():
    # B scoort 3x zoveel per wedstrijd als het poule-gemiddelde.
    standings = [_team(1, "A", played=10, gf=10, ga=10), _team(2, "B", played=10, gf=30, ga=10)]
    strengths, _ = estimate_team_strengths(standings)
    assert strengths[2].attack > strengths[1].attack
    assert strengths[2].attack > 1.0


def test_shrinkage_keeps_small_samples_closer_to_neutral_than_large_samples():
    # Zelfde ratio (3x poule-gemiddeld scoren), maar team C heeft veel meer
    # wedstrijden gespeeld dan team B - C's schatting moet verder van 1.0
    # afwijken (minder shrinkage) dan B's schatting.
    standings = [
        _team(1, "A", played=20, gf=20, ga=20),
        _team(2, "B", played=1, gf=3, ga=1),
        _team(3, "C", played=20, gf=60, ga=20),
    ]
    strengths, _ = estimate_team_strengths(standings)
    assert 1.0 < strengths[2].attack < strengths[3].attack


def test_match_score_distribution_sums_to_one_and_is_bounded():
    standings = [_team(1, "A", played=10, gf=10, ga=10), _team(2, "B", played=10, gf=10, ga=10)]
    strengths, mu = estimate_team_strengths(standings)
    dist = match_score_distribution(strengths, mu, 1, 2)
    assert sum(dist.values()) == pytest.approx(1.0)
    assert all(0 <= h <= MAX_GOALS_PER_TEAM and 0 <= a <= MAX_GOALS_PER_TEAM for h, a in dist)
    assert all(p >= 0 for p in dist.values())


def test_stronger_home_team_gets_higher_win_probability_than_uniform():
    standings = [_team(1, "A", played=10, gf=30, ga=5), _team(2, "B", played=10, gf=5, ga=30)]
    strengths, mu = estimate_team_strengths(standings)
    dist = match_score_distribution(strengths, mu, home_team_id=1, away_team_id=2)
    p_home_win = sum(p for (h, a), p in dist.items() if h > a)
    assert p_home_win > 1 / 3  # duidelijk boven de uniforme 33%-aanname


def test_build_poisson_elements_weights_sum_to_one_per_match():
    standings = [_team(1, "A", played=5, gf=10, ga=8), _team(2, "B", played=5, gf=8, ga=10)]
    matches = [MatchFixture(match_id=1, home_team_id=1, away_team_id=2)]
    elements = build_poisson_elements(standings, matches)
    assert len(elements) == 1
    assert sum(elements[0].weights) == pytest.approx(1.0)
    assert len(elements[0].outcomes) == len(elements[0].weights)
