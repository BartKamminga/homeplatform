"""Item 1232: cache voor de kansberekening - geleegd zodra er nieuwe standen zijn."""

from sqlmodel import select

from models.hockey_discovery import HockeyPoule, HockeyPouleMatch, HockeyPouleStanding
from services import scenario_cache


def _setup(session):
    session.add(HockeyPoule(poule_id=200, name="Cache-test poule", competition_id=1, season="2025/2026"))
    session.add(HockeyPouleStanding(poule_id=200, team_id=1, team_name="A", points=10, goals_for=10, goals_against=5))
    session.add(HockeyPouleStanding(poule_id=200, team_id=2, team_name="B", points=10, goals_for=8, goals_against=8))
    session.add(HockeyPouleMatch(poule_id=200, match_id=1, home_team_id=1, away_team_id=2, status="scheduled"))
    session.commit()
    return session.exec(select(HockeyPoule).where(HockeyPoule.poule_id == 200)).first()


def _dist(client, poule):
    res = client.get(f"/api/hockey/public/hockey-poules/{poule.id}/simulate",
                     params={"team_id": 1, "type": "position_distribution"})
    assert res.status_code == 200, res.text
    return res.json()["position_probabilities"]


def test_same_standings_come_from_cache(client, session):
    scenario_cache.clear()
    poule = _setup(session)
    before = scenario_cache.stats()
    first = _dist(client, poule)
    second = _dist(client, poule)
    after = scenario_cache.stats()
    assert first == second
    assert after["misses"] - before["misses"] == 1
    assert after["hits"] - before["hits"] == 1


def test_new_standings_invalidate_cache(client, session):
    scenario_cache.clear()
    poule = _setup(session)
    first = _dist(client, poule)

    # Nieuwe uitslag binnen: wedstrijd gespeeld (A wint), stand bijgewerkt
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == 200)).first()
    match.status = "final"
    standing = session.exec(select(HockeyPouleStanding).where(HockeyPouleStanding.team_id == 1)).first()
    standing.points = 13
    session.add_all([match, standing])
    session.commit()

    misses = scenario_cache.stats()["misses"]
    second = _dist(client, poule)
    assert scenario_cache.stats()["misses"] == misses + 1  # opnieuw berekend, niet uit de cache
    assert second != first
    assert second["1"] == 1.0  # A staat nu vast bovenaan


def test_errors_are_not_cached(client, session):
    scenario_cache.clear()
    poule = _setup(session)
    for _ in range(2):
        res = client.get(f"/api/hockey/public/hockey-poules/{poule.id}/simulate",
                         params={"team_id": 999, "type": "position_distribution"})
        assert res.status_code in (400, 404)
    assert scenario_cache.stats()["entries"] == 0
