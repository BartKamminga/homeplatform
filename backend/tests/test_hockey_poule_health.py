"""Tests voor de poule-health-badges op GET /api/hockey/poules (Bart,
30-08-2026: 'is er nog onbekende wedstrijdtijd binnen een week, of een
gespeelde wedstrijd zonder uitslag - dat is een scan waard' + 'wedstrijden
zijn bezig, hoeven niet perse live te zijn'). Puur uit match-data afgeleid,
los van scan-geschiedenis/cadans - zie routers/hockey_capture.py::
_poule_health.

unknown_start en overdue_result zijn bewust 2 losse velden (niet 1
gecombineerde 'needs_scan') - bij een eerste acc-check stond 927 van de
1023 poules op 'needs_scan' aan het begin van een nieuw seizoen, puur
omdat hockey.nl starttijden vaak pas 1-2 weken van tevoren publiceert.
overdue_result blijft dan het enige echt selectieve signaal (199
wedstrijden op hetzelfde moment)."""

from datetime import datetime, timedelta

from models.hockey_discovery import HockeyCompetition, HockeyPoule, HockeyPouleMatch
from routers.hockey_capture import list_poules

SEASON = "2026-2027"


def _setup_poule(session, poule_id, name="Poule Health"):
    comp = HockeyCompetition(
        external_id=f"test|poule-health-{poule_id}", name="Poule Health Comp", class_name="District",
        hockey_type="VE", season=SEASON,
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    poule = HockeyPoule(poule_id=poule_id, name=name, competition_id=comp.id, season=SEASON)
    session.add(poule)
    session.commit()
    return poule


def _result_for(result, poule_id):
    return next(p for p in result["poules"] if p["poule_id"] == poule_id)


def test_poule_with_a_match_in_progress_is_flagged_busy(session):
    now = datetime.utcnow()
    poule = _setup_poule(session, 700)
    session.add(HockeyPouleMatch(
        poule_id=poule.poule_id, match_id=1, home_team_id=1, away_team_id=2,
        status="scheduled", round=1, match_date=(now - timedelta(minutes=30)).isoformat(),
    ))
    session.commit()

    result = list_poules(season=SEASON, session=session, _=None)

    row = _result_for(result, 700)
    assert row["busy"] is True
    assert row["unknown_start"] is False
    assert row["overdue_result"] is False


def test_poule_with_an_overdue_unresolved_match_is_flagged(session):
    """Gespeeld (voorspeld einde al voorbij) maar nog geen 'final' status."""
    now = datetime.utcnow()
    poule = _setup_poule(session, 701)
    session.add(HockeyPouleMatch(
        poule_id=poule.poule_id, match_id=2, home_team_id=1, away_team_id=2,
        status="scheduled", round=1, match_date=(now - timedelta(hours=3)).isoformat(),
    ))
    session.commit()

    result = list_poules(season=SEASON, session=session, _=None)

    row = _result_for(result, 701)
    assert row["overdue_result"] is True
    assert row["busy"] is False
    assert row["unknown_start"] is False


def test_poule_with_a_finished_match_is_not_flagged(session):
    now = datetime.utcnow()
    poule = _setup_poule(session, 702)
    session.add(HockeyPouleMatch(
        poule_id=poule.poule_id, match_id=3, home_team_id=1, away_team_id=2,
        status="final", round=1, match_date=(now - timedelta(hours=3)).isoformat(),
    ))
    session.commit()

    result = list_poules(season=SEASON, session=session, _=None)

    row = _result_for(result, 702)
    assert row["overdue_result"] is False
    assert row["busy"] is False


def test_poule_with_an_unknown_start_time_within_a_week_is_flagged(session):
    now = datetime.utcnow()
    poule = _setup_poule(session, 703)
    placeholder = (now + timedelta(days=3)).replace(hour=0, minute=0, second=0, microsecond=0)
    session.add(HockeyPouleMatch(
        poule_id=poule.poule_id, match_id=4, home_team_id=1, away_team_id=2,
        status="announced", round=1, match_date=placeholder.isoformat(),
    ))
    session.commit()

    result = list_poules(season=SEASON, session=session, _=None)

    row = _result_for(result, 703)
    assert row["unknown_start"] is True
    assert row["overdue_result"] is False


def test_poule_with_an_unknown_start_time_beyond_a_week_is_not_flagged_yet(session):
    now = datetime.utcnow()
    poule = _setup_poule(session, 704)
    placeholder = (now + timedelta(days=20)).replace(hour=0, minute=0, second=0, microsecond=0)
    session.add(HockeyPouleMatch(
        poule_id=poule.poule_id, match_id=5, home_team_id=1, away_team_id=2,
        status="announced", round=1, match_date=placeholder.isoformat(),
    ))
    session.commit()

    result = list_poules(season=SEASON, session=session, _=None)

    row = _result_for(result, 704)
    assert row["unknown_start"] is False


def test_quiet_poule_with_only_future_known_matches_is_not_flagged(session):
    now = datetime.utcnow()
    poule = _setup_poule(session, 705)
    session.add(HockeyPouleMatch(
        poule_id=poule.poule_id, match_id=6, home_team_id=1, away_team_id=2,
        status="scheduled", round=1, match_date=(now + timedelta(days=10)).isoformat(),
    ))
    session.commit()

    result = list_poules(season=SEASON, session=session, _=None)

    row = _result_for(result, 705)
    assert row["unknown_start"] is False
    assert row["overdue_result"] is False
    assert row["busy"] is False
