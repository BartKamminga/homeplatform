"""Tests voor het poule-eindpositie-scenario (item 963)."""

import pytest
from sqlmodel import select

from models.hockey_discovery import HockeyPoule, HockeyPouleMatch, HockeyPouleStanding
from services.hockey_scenario import load_poule_inputs, simulate_position
from services.hockey_scenario_types import MatchFixture, TeamStat


def _team(team_id, name, points, gf=0, ga=0):
    return TeamStat(
        team_id=team_id, team_name=name, played=0, won=0, drawn=0, lost=0,
        goals_for=gf, goals_against=ga, points=points,
    )


def test_guaranteed_when_no_remaining_matches_can_close_the_gap():
    standings = [_team(1, "A", 30), _team(2, "B", 10)]
    remaining = [MatchFixture(match_id=1, home_team_id=2, away_team_id=1)]
    summary = simulate_position(standings, remaining, team_id=1, target_position=1)
    assert summary.verdict == "guaranteed"
    assert summary.combinations_considered == 0


def test_impossible_when_rival_already_out_of_reach():
    standings = [_team(1, "A", 5), _team(2, "B", 40)]
    remaining = [MatchFixture(match_id=1, home_team_id=1, away_team_id=2)]
    summary = simulate_position(standings, remaining, team_id=1, target_position=1)
    assert summary.verdict == "impossible"


def test_depends_and_examples_round_trip():
    standings = [_team(1, "A", 10), _team(2, "B", 10)]
    remaining = [MatchFixture(match_id=1, home_team_id=1, away_team_id=2)]
    summary = simulate_position(standings, remaining, team_id=1, target_position=1)
    assert summary.verdict == "depends"
    assert summary.combinations_total == 3
    assert summary.combinations_considered == 3
    # A wint (H) -> A op 13, B op 10 -> A eerste
    assert any(ex[0]["outcome"] == "H" for ex in summary.satisfying_examples)
    # B wint (A) -> B op 13, A op 10 -> A tweede, dus geen satisfying example
    assert any(ex[0]["outcome"] == "A" for ex in summary.failing_examples)
    assert any("doelsaldo" in c.lower() for c in summary.caveats)


def test_pivotal_match_hint_flags_required_outcome():
    # Enige resterende wedstrijd is 100% bepalend: A moet winnen om 1e te worden.
    standings = [_team(1, "A", 10), _team(2, "B", 10)]
    remaining = [MatchFixture(match_id=1, home_team_id=1, away_team_id=2)]
    summary = simulate_position(standings, remaining, team_id=1, target_position=1)
    hint = summary.pivotal_matches[0]["hint"]
    assert hint["required"] is True
    assert hint["recommended_outcome"] == "H"
    assert hint["recommended_rate"] == 1.0
    assert hint["label"] == "A moet winnen"


def test_pivotal_match_hint_is_probabilistic_when_not_strictly_required():
    standings = [_team(1, "A", 10), _team(2, "B", 10)]
    remaining = [MatchFixture(match_id=i, home_team_id=1, away_team_id=2) for i in range(1, 4)]
    summary = simulate_position(
        standings, remaining, team_id=1, target_position=1,
        max_combinations=5, sample_size=2000,
    )
    for m in summary.pivotal_matches:
        hint = m["hint"]
        assert hint["required"] is False
        assert 0.0 < hint["recommended_rate"] < 1.0
        assert hint["label"] == "A wint"


def test_pruning_ignores_matches_between_locked_teams():
    standings = [_team(1, "A", 10), _team(2, "B", 10), _team(3, "C", 0), _team(4, "D", 0)]
    remaining = [
        MatchFixture(match_id=1, home_team_id=1, away_team_id=2),  # relevant: A vs B
        MatchFixture(match_id=2, home_team_id=3, away_team_id=4),  # irrelevant: C/D kunnen A niet meer inhalen
    ]
    summary = simulate_position(standings, remaining, team_id=1, target_position=1)
    assert summary.combinations_total == 3  # alleen de A-B wedstrijd meegenomen
    assert all(m["match_id"] != 2 for m in summary.pivotal_matches)
    assert any("genegeerd" in c for c in summary.caveats)


def test_monte_carlo_fallback_on_hockey_adapter():
    standings = [_team(1, "A", 10), _team(2, "B", 10)]
    remaining = [MatchFixture(match_id=i, home_team_id=1, away_team_id=2) for i in range(1, 4)]  # 3^3 = 27 combos
    summary = simulate_position(
        standings, remaining, team_id=1, target_position=1,
        max_combinations=5, sample_size=40,
    )
    assert summary.confidence == "sampled"
    assert summary.combinations_total == 27
    assert summary.combinations_considered == 40
    assert any("steekproef" in c for c in summary.caveats)


def test_default_exact_threshold_stays_fast_around_the_boundary():
    """Regressietest: MAX_EXACT_COMBINATIONS moet laag genoeg zijn dat 'net
    over de grens' geen seconden kost (gerapporteerd: 4 teams, 1 wedstrijd
    vastzetten liet de resterende 11 wedstrijden (3^11) omslaan naar exact bij
    de oude grens van 200.000, en dat duurde 8+ seconden)."""
    standings = [_team(1, "A", 10), _team(2, "B", 10)]
    just_under = [MatchFixture(match_id=i, home_team_id=1, away_team_id=2) for i in range(9)]   # 3^9 = 19683
    just_over  = [MatchFixture(match_id=i, home_team_id=1, away_team_id=2) for i in range(10)]  # 3^10 = 59049

    below = simulate_position(standings, just_under, team_id=1, target_position=1, method="auto")
    above = simulate_position(standings, just_over, team_id=1, target_position=1, method="auto")

    assert below.method_used == "exact"
    assert above.method_used == "monte_carlo"
    assert above.combinations_considered <= 20_000  # niet 59.049 stuks doorrekenen


def test_fixed_outcomes_bakes_assumption_into_standings_and_shrinks_search_space():
    standings = [_team(1, "A", 10), _team(2, "B", 10)]
    remaining = [
        MatchFixture(match_id=1, home_team_id=1, away_team_id=2),
        MatchFixture(match_id=2, home_team_id=1, away_team_id=2),
    ]
    baseline = simulate_position(standings, remaining, team_id=1, target_position=1)
    assert baseline.verdict == "depends"
    assert baseline.combinations_total == 9  # 3^2, geen aannames

    # Neem aan dat A wint van B in match 1 - nog maar 1 wedstrijd (3 combos) over.
    a_wins = simulate_position(standings, remaining, team_id=1, target_position=1, fixed_outcomes={1: "H"})
    assert a_wins.verdict == "guaranteed"
    assert a_wins.combinations_total == 0
    assert any("Aanname" in c and "A wint" in c for c in a_wins.caveats)

    # B wint van A in match 1 (standaard marge 0-1, item 1035) - dat doelsaldo
    # weegt nu ook mee in de tiebreak, dus zelfs met 1 wedstrijd nog open kan
    # A niet meer op gelijke punten winnen (B wint dan altijd de tiebreak).
    b_wins = simulate_position(standings, remaining, team_id=1, target_position=1, fixed_outcomes={1: "A"})
    assert b_wins.verdict == "impossible"
    assert b_wins.combinations_total == 0
    assert any("aangenomen 0-1" in c for c in b_wins.caveats)


def test_fixed_outcomes_ignores_unknown_match_id():
    standings = [_team(1, "A", 10), _team(2, "B", 10)]
    remaining = [MatchFixture(match_id=1, home_team_id=1, away_team_id=2)]
    summary = simulate_position(standings, remaining, team_id=1, target_position=1, fixed_outcomes={9999: "H"})
    assert summary.verdict == "depends"
    assert summary.combinations_total == 3


def test_poisson_method_produces_weighted_verdict_and_caveat():
    # A staat 1 punt achter en heeft alleen wat aan een overwinning (een
    # gelijkspel is niet genoeg om B alsnog voorbij te gaan) - bij de
    # uniforme aanname is dat exact 1 van de 3 uitslagen (1/3). A heeft een
    # veel grotere aanval/verdediging dan B, dus Poisson moet P(A wint)
    # duidelijk boven 1/3 inschatten.
    standings = [
        _team(1, "A", 10, gf=30, ga=5), _team(2, "B", 11, gf=5, ga=30),
    ]
    remaining = [MatchFixture(match_id=1, home_team_id=1, away_team_id=2)]
    uniform = simulate_position(standings, remaining, team_id=1, target_position=1)
    poisson = simulate_position(standings, remaining, team_id=1, target_position=1, method="poisson")

    assert uniform.goal_probability == pytest.approx(1 / 3)
    assert poisson.goal_probability > uniform.goal_probability
    assert any("Poisson" in c for c in poisson.caveats)
    assert poisson.method_used in ("exact", "monte_carlo")  # engine-strategie blijft gescheiden van het kansmodel


def test_poisson_pivotal_hint_still_uses_hda_labels():
    standings = [_team(1, "A", 10), _team(2, "B", 10)]
    remaining = [MatchFixture(match_id=1, home_team_id=1, away_team_id=2)]
    summary = simulate_position(standings, remaining, team_id=1, target_position=1, method="poisson")
    hint = summary.pivotal_matches[0]["hint"]
    assert hint["recommended_outcome"] in ("H", "D", "A")


def test_poisson_adds_objective_predicted_score_independent_of_the_hint():
    # item 1042: predicted_score/predicted_outcome is de eigen inschatting
    # van het model voor deze ene wedstrijd, los van het doel-gecorreleerde
    # hint-mechanisme (dat kan een heel andere uitslag aanbevelen als dat
    # nodig is om het doel te halen).
    standings = [_team(1, "A", 10, gf=30, ga=5), _team(2, "B", 10, gf=5, ga=30)]
    remaining = [MatchFixture(match_id=1, home_team_id=1, away_team_id=2)]
    summary = simulate_position(standings, remaining, team_id=1, target_position=1, method="poisson")
    m = summary.pivotal_matches[0]
    assert m["predicted_outcome"] in ("H", "D", "A")
    assert len(m["predicted_score"]) == 2
    assert all(isinstance(g, int) and g >= 0 for g in m["predicted_score"])
    # A heeft veruit de sterkste aanval/verdediging - het model voorspelt A als winnaar.
    assert m["predicted_outcome"] == "H"


def test_uniform_method_leaves_predicted_score_empty():
    standings = [_team(1, "A", 10), _team(2, "B", 10)]
    remaining = [MatchFixture(match_id=1, home_team_id=1, away_team_id=2)]
    summary = simulate_position(standings, remaining, team_id=1, target_position=1)
    m = summary.pivotal_matches[0]
    assert m["predicted_score"] is None
    assert m["predicted_outcome"] is None


def test_standings_field_reflects_current_state_without_fixed_outcomes():
    standings = [_team(1, "A", 10, gf=12, ga=8), _team(2, "B", 7, gf=6, ga=9)]
    remaining = [MatchFixture(match_id=1, home_team_id=1, away_team_id=2)]
    summary = simulate_position(standings, remaining, team_id=1, target_position=1)
    assert [s["team_id"] for s in summary.standings] == [1, 2]  # A staat 1e (meer punten)
    assert summary.standings[0]["pts"] == 10
    assert summary.standings[0]["gf"] == 12 and summary.standings[0]["ga"] == 8


def test_fixed_outcomes_without_score_assume_a_one_goal_margin():
    # item 1035: winst/verlies zonder expliciete score telt als 1-0/0-1 i.p.v.
    # helemaal geen doelsaldo-wijziging.
    standings = [_team(1, "A", 10, gf=12, ga=8), _team(2, "B", 10, gf=8, ga=8)]
    remaining = [MatchFixture(match_id=1, home_team_id=1, away_team_id=2)]
    summary = simulate_position(standings, remaining, team_id=1, target_position=1, fixed_outcomes={1: "H"})
    a_row = next(s for s in summary.standings if s["team_id"] == 1)
    b_row = next(s for s in summary.standings if s["team_id"] == 2)
    assert a_row["pts"] == 13 and a_row["gf"] == 13 and a_row["ga"] == 8
    assert b_row["pts"] == 10 and b_row["gf"] == 8 and b_row["ga"] == 9
    assert any("aangenomen 1-0" in c for c in summary.caveats)


def test_fixed_outcomes_draw_without_score_stays_zero_zero():
    standings = [_team(1, "A", 10, gf=12, ga=8), _team(2, "B", 10, gf=8, ga=8)]
    remaining = [MatchFixture(match_id=1, home_team_id=1, away_team_id=2)]
    summary = simulate_position(standings, remaining, team_id=1, target_position=1, fixed_outcomes={1: "D"})
    a_row = next(s for s in summary.standings if s["team_id"] == 1)
    assert a_row["pts"] == 11 and a_row["gf"] == 12 and a_row["ga"] == 8  # marge 0-0, dus geen wijziging
    assert any("aangenomen 0-0" in c for c in summary.caveats)


def test_fixed_scores_still_overrides_the_default_margin():
    standings = [_team(1, "A", 10, gf=12, ga=8), _team(2, "B", 10, gf=8, ga=8)]
    remaining = [MatchFixture(match_id=1, home_team_id=1, away_team_id=2)]
    summary = simulate_position(
        standings, remaining, team_id=1, target_position=1,
        fixed_outcomes={1: "H"}, fixed_scores={1: (4, 2)},
    )
    a_row = next(s for s in summary.standings if s["team_id"] == 1)
    assert a_row["gf"] == 16 and a_row["ga"] == 10
    assert any("(4-2)" in c for c in summary.caveats)
    assert not any("aangenomen" in c for c in summary.caveats)


def test_fixed_scores_updates_goal_difference_in_standings():
    standings = [_team(1, "A", 10, gf=12, ga=8), _team(2, "B", 10, gf=8, ga=8)]
    remaining = [MatchFixture(match_id=1, home_team_id=1, away_team_id=2)]
    summary = simulate_position(
        standings, remaining, team_id=1, target_position=1,
        fixed_outcomes={1: "H"}, fixed_scores={1: (3, 1)},
    )
    a_row = next(s for s in summary.standings if s["team_id"] == 1)
    b_row = next(s for s in summary.standings if s["team_id"] == 2)
    assert a_row["pts"] == 13 and a_row["gf"] == 15 and a_row["ga"] == 9
    assert b_row["pts"] == 10 and b_row["gf"] == 9 and b_row["ga"] == 11
    assert any("3-1" in c for c in summary.caveats)


def test_fixed_scores_without_matching_fixed_outcome_is_ignored():
    # fixed_scores voor een match_id die niet in fixed_outcomes zit heeft geen effect.
    standings = [_team(1, "A", 10, gf=12, ga=8), _team(2, "B", 10, gf=8, ga=8)]
    remaining = [MatchFixture(match_id=1, home_team_id=1, away_team_id=2)]
    summary = simulate_position(
        standings, remaining, team_id=1, target_position=1, fixed_scores={1: (3, 1)},
    )
    a_row = next(s for s in summary.standings if s["team_id"] == 1)
    assert a_row["pts"] == 10 and a_row["gf"] == 12  # niets gebeurd, want geen fixed_outcomes meegegeven


def test_parse_fixed_accepts_score_suffix_and_validates_consistency(client, session):
    from models.hockey_discovery import HockeyPoule, HockeyPouleMatch, HockeyPouleStanding

    session.add(HockeyPoule(poule_id=100, name="Score-test poule", competition_id=1, season="2025/2026"))
    session.add(HockeyPouleStanding(poule_id=100, team_id=1, team_name="A", points=10, goals_for=12, goals_against=8))
    session.add(HockeyPouleStanding(poule_id=100, team_id=2, team_name="B", points=10, goals_for=8, goals_against=8))
    session.add(HockeyPouleMatch(poule_id=100, match_id=1, home_team_id=1, away_team_id=2, status="scheduled"))
    session.commit()
    poule = session.exec(select(HockeyPoule).where(HockeyPoule.poule_id == 100)).first()

    res = client.get(
        f"/api/hockey/public/hockey-poules/{poule.id}/simulate",
        params={"team_id": 1, "target_position": 1, "fixed": "1:H:3:1"},
    )
    assert res.status_code == 200
    a_row = next(s for s in res.json()["standings"] if s["team_id"] == 1)
    assert a_row["gf"] == 15 and a_row["ga"] == 9

    res_inconsistent = client.get(
        f"/api/hockey/public/hockey-poules/{poule.id}/simulate",
        params={"team_id": 1, "target_position": 1, "fixed": "1:H:0:2"},  # score zegt A, label zegt H
    )
    assert res_inconsistent.status_code == 400

    res_malformed = client.get(
        f"/api/hockey/public/hockey-poules/{poule.id}/simulate",
        params={"team_id": 1, "target_position": 1, "fixed": "1:H:3"},  # ontbrekende awayGoals
    )
    assert res_malformed.status_code == 400


def test_load_poule_inputs_reads_standing_and_scheduled_matches(session):
    session.add(HockeyPouleStanding(
        poule_id=99, team_id=1, team_name="A", played=5, won=3, drawn=1, lost=1,
        goals_for=10, goals_against=5, points=10,
    ))
    session.add(HockeyPouleStanding(
        poule_id=99, team_id=2, team_name="B", played=5, won=2, drawn=1, lost=2,
        goals_for=8, goals_against=6, points=7,
    ))
    session.add(HockeyPouleMatch(
        poule_id=99, match_id=501, home_team_id=1, away_team_id=2, status="final",
        home_score=2, away_score=1,
    ))
    session.add(HockeyPouleMatch(
        poule_id=99, match_id=502, home_team_id=2, away_team_id=1, status="scheduled",
    ))
    session.commit()

    standings, remaining = load_poule_inputs(session, poule_id=99)

    assert {s.team_id for s in standings} == {1, 2}
    assert len(remaining) == 1
    assert remaining[0].match_id == 502


def test_simulate_endpoint_happy_path_and_errors(session, client):
    session.add(HockeyPoule(poule_id=99, name="Test poule", competition_id=1, season="2025/2026"))
    session.add(HockeyPouleStanding(poule_id=99, team_id=1, team_name="A", points=10))
    session.add(HockeyPouleStanding(poule_id=99, team_id=2, team_name="B", points=5))
    session.add(HockeyPouleMatch(poule_id=99, match_id=1, home_team_id=1, away_team_id=2, status="scheduled"))
    session.commit()
    poule = session.exec(select(HockeyPoule).where(HockeyPoule.poule_id == 99)).first()

    res = client.get(
        f"/api/hockey/public/hockey-poules/{poule.id}/simulate",
        params={"team_id": 1, "target_position": 1},
    )
    assert res.status_code == 200
    assert res.json()["verdict"] in ("guaranteed", "impossible", "depends")

    res_404 = client.get(
        "/api/hockey/public/hockey-poules/999999/simulate",
        params={"team_id": 1, "target_position": 1},
    )
    assert res_404.status_code == 404

    res_400 = client.get(
        f"/api/hockey/public/hockey-poules/{poule.id}/simulate",
        params={"team_id": 1, "target_position": 1, "type": "unknown"},
    )
    assert res_400.status_code == 400

    res_fixed = client.get(
        f"/api/hockey/public/hockey-poules/{poule.id}/simulate",
        params={"team_id": 1, "target_position": 1, "fixed": "1:H"},
    )
    assert res_fixed.status_code == 200
    assert res_fixed.json()["verdict"] == "guaranteed"

    res_bad_fixed = client.get(
        f"/api/hockey/public/hockey-poules/{poule.id}/simulate",
        params={"team_id": 1, "target_position": 1, "fixed": "not-a-valid-value"},
    )
    assert res_bad_fixed.status_code == 400

    res_distribution = client.get(
        f"/api/hockey/public/hockey-poules/{poule.id}/simulate",
        params={"team_id": 1, "type": "position_distribution"},
    )
    assert res_distribution.status_code == 200
    body = res_distribution.json()
    assert body["team_count"] == 2
    assert abs(sum(body["position_probabilities"].values()) - 1.0) < 1e-9

    res_missing_target = client.get(
        f"/api/hockey/public/hockey-poules/{poule.id}/simulate",
        params={"team_id": 1},  # type='position' (default) vereist target_position
    )
    assert res_missing_target.status_code == 400

    res_poisson = client.get(
        f"/api/hockey/public/hockey-poules/{poule.id}/simulate",
        params={"team_id": 1, "target_position": 1, "method": "poisson"},
    )
    assert res_poisson.status_code == 200  # deze standings zijn al 'guaranteed' via de bounds-fastpath (zie hockey_scenario_bounds.py) - dus geen method-specifieke caveat hier, alleen status/contract-check

    res_bad_method = client.get(
        f"/api/hockey/public/hockey-poules/{poule.id}/simulate",
        params={"team_id": 1, "target_position": 1, "method": "quantum"},
    )
    assert res_bad_method.status_code == 400
