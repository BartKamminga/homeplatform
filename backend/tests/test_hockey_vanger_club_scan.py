"""Tests voor de weekend-regel op club-scans (Bart, 30-08-2026: "club scans
niet in het weekend") - club-detail-scans zijn niet tijdsgevoelig, dus in
het weekend (piek voor matchday-scans) wachten ze tot maandag. Geldt voor
zowel de echte stap (_step_club_scan) als het scanschema-equivalent
(_immediate_events)."""

from datetime import datetime, timedelta

from sqlmodel import select

from models.hockey_discovery import HockeyClub, VangerCmd
from services.hockey_vanger_scanplan import _step_club_scan
from services.hockey_vanger_schedule import _immediate_events
from services.hockey_vanger_settings import get_target_season


def _next_weekday(base: datetime, weekday: int) -> datetime:
    days_ahead = (weekday - base.weekday()) % 7
    return base + timedelta(days=days_ahead)


def _make_unscanned_club(session, external_id="HH99ZZ0"):
    session.add(HockeyClub(
        external_id=external_id, name="Weekend Test Club", friendly_name="Weekend Test Club",
        detail_loaded=False,
    ))
    session.commit()


def test_step_club_scan_is_skipped_on_saturday(session):
    _make_unscanned_club(session)
    saturday = _next_weekday(datetime.utcnow(), 5).replace(hour=10, minute=0, second=0, microsecond=0)

    added = _step_club_scan(session, saturday, cap=10)

    assert added == 0
    assert session.exec(select(VangerCmd)).first() is None


def test_step_club_scan_is_skipped_on_sunday(session):
    _make_unscanned_club(session)
    sunday = _next_weekday(datetime.utcnow(), 6).replace(hour=10, minute=0, second=0, microsecond=0)

    added = _step_club_scan(session, sunday, cap=10)

    assert added == 0


def test_step_club_scan_runs_on_a_weekday(session):
    _make_unscanned_club(session)
    monday = _next_weekday(datetime.utcnow(), 0).replace(hour=10, minute=0, second=0, microsecond=0)

    added = _step_club_scan(session, monday, cap=10)

    assert added == 1
    cmd = session.exec(select(VangerCmd)).first()
    assert cmd.reason == "club_scan"


def test_immediate_events_skip_club_scan_on_the_weekend_but_keep_club_list(session):
    _make_unscanned_club(session)
    saturday = _next_weekday(datetime.utcnow(), 5).replace(hour=10, minute=0, second=0, microsecond=0)

    events = _immediate_events(session, saturday, get_target_season(session), cap=10)

    assert not any(e["reason"] == "club_scan" for e in events)
    assert any(e["reason"] == "club_list" for e in events)  # ongemoeid, geen weekend-regel


def test_immediate_events_include_club_scan_on_a_weekday(session):
    _make_unscanned_club(session)
    monday = _next_weekday(datetime.utcnow(), 0).replace(hour=10, minute=0, second=0, microsecond=0)

    events = _immediate_events(session, monday, get_target_season(session), cap=10)

    assert any(e["reason"] == "club_scan" for e in events)
