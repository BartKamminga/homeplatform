"""Tests voor _step_landelijke_competitions als "grote poule" (Bart,
30-08-2026): de vroegere vaste landelijke_comp_scan_hours-cadans is vervangen
door dezelfde matchday-burst/live-check/dagelijkse-fallback-regels als
_step_active_profiles, toegepast op de VERENIGING van alle wedstrijden in
alle poules van de competitie (1 get_competition_detail-call ververst ze
toch in 1x)."""

import json
from datetime import datetime, timedelta

from sqlmodel import select

from models.hockey_discovery import HockeyCompetition, HockeyPoule, HockeyPouleMatch, VangerCmd
from services.hockey_vanger_scanplan import _step_landelijke_competitions


def _make_hl_competition(session, comp_id_hint=1):
    comp = HockeyCompetition(
        external_id=f"test|hl-comp-{comp_id_hint}", name="Landelijke Testklasse", class_name="Landelijk",
        hockey_type="VE", season="2026-2027", hl_comp_id=900 + comp_id_hint,
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    return comp


def _make_poule(session, comp, poule_id, last_scanned_at):
    poule = HockeyPoule(poule_id=poule_id, name=f"Poule {poule_id}", competition_id=comp.id,
                         season="2026-2027", last_scanned_at=last_scanned_at)
    session.add(poule)
    session.commit()
    return poule


def _make_match(session, poule_id, match_id, match_date, status="scheduled"):
    session.add(HockeyPouleMatch(
        poule_id=poule_id, match_id=match_id, home_team_id=1, away_team_id=2,
        status=status, round=1, match_date=match_date.isoformat(),
    ))
    session.commit()


def _added_reason(session):
    cmd = session.exec(select(VangerCmd)).first()
    return json.loads(cmd.params), cmd.reason


def test_queues_immediately_when_the_competition_has_no_poules_yet(session):
    _make_hl_competition(session)
    now = datetime.utcnow()

    added = _step_landelijke_competitions(session, now, cap=10)

    assert added == 1
    _, reason = _added_reason(session)
    assert reason == "new_or_empty"


def test_not_due_when_recently_scanned_and_no_match_today(session):
    comp = _make_hl_competition(session)
    now = datetime.utcnow()
    _make_poule(session, comp, poule_id=1, last_scanned_at=now - timedelta(hours=2))
    _make_poule(session, comp, poule_id=2, last_scanned_at=now - timedelta(hours=2))

    added = _step_landelijke_competitions(session, now, cap=10)

    assert added == 0


def test_daily_fallback_triggers_after_24h_with_no_match_today(session):
    comp = _make_hl_competition(session)
    now = datetime.utcnow()
    _make_poule(session, comp, poule_id=1, last_scanned_at=now - timedelta(hours=25))
    _make_poule(session, comp, poule_id=2, last_scanned_at=now - timedelta(hours=25))

    added = _step_landelijke_competitions(session, now, cap=10)

    assert added == 1
    _, reason = _added_reason(session)
    assert reason == "daily_fallback"


def test_matchday_burst_triggers_from_a_match_in_any_member_poule(session):
    """De burst-berekening moet over ALLE poules van de competitie samen
    kijken - hier heeft alleen poule 2 een (al afgelopen) wedstrijd van
    vandaag, poule 1 heeft er geen. De competitie als geheel moet toch in
    burst-modus komen."""
    comp = _make_hl_competition(session)
    now = datetime.utcnow()
    _make_poule(session, comp, poule_id=1, last_scanned_at=now - timedelta(hours=2))
    _make_poule(session, comp, poule_id=2, last_scanned_at=now - timedelta(hours=2))
    _make_match(session, poule_id=2, match_id=1, match_date=now - timedelta(hours=3), status="finished")

    added = _step_landelijke_competitions(session, now, cap=10)

    assert added == 1
    _, reason = _added_reason(session)
    assert reason == "match_end_check"


def test_match_start_check_triggers_shortly_after_a_match_starts_in_one_poule(session):
    comp = _make_hl_competition(session)
    now = datetime.utcnow()
    _make_poule(session, comp, poule_id=1, last_scanned_at=now - timedelta(hours=2))
    _make_poule(session, comp, poule_id=2, last_scanned_at=now - timedelta(hours=2))
    # Wedstrijd 20 min geleden gestart, standaardduur 90 min -> nog niet
    # afgelopen (dus geen match_end_check-trigger), wel binnen het
    # match_start_check-venster (live_check_delay_min=15 na start).
    _make_match(session, poule_id=1, match_id=2, match_date=now - timedelta(minutes=20), status="live")

    added = _step_landelijke_competitions(session, now, cap=10)

    assert added == 1
    _, reason = _added_reason(session)
    assert reason == "match_start_check"


def test_daily_fallback_is_skipped_once_all_poules_are_done_for_the_season(session):
    """Item 1016 (Bart, 30-08-2026): als ALLE bekende wedstrijden in ALLE
    poules van de competitie al geweest zijn, is er niets meer te
    ontdekken - geen daily_fallback meer nodig."""
    comp = _make_hl_competition(session)
    now = datetime.utcnow()
    _make_poule(session, comp, poule_id=1, last_scanned_at=now - timedelta(hours=25))
    _make_match(session, poule_id=1, match_id=99, match_date=now - timedelta(days=3), status="final")

    added = _step_landelijke_competitions(session, now, cap=10)

    assert added == 0


def test_already_pending_get_competition_detail_is_not_duplicated(session):
    comp = _make_hl_competition(session)
    now = datetime.utcnow()
    _make_poule(session, comp, poule_id=1, last_scanned_at=now - timedelta(hours=25))
    session.add(VangerCmd(
        cmd_type="get_competition_detail",
        params=json.dumps({"comp_id": comp.hl_comp_id, "label": comp.name}),
        status="pending",
    ))
    session.commit()

    added = _step_landelijke_competitions(session, now, cap=10)

    assert added == 0
