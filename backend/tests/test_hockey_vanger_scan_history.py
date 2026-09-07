"""Tests voor services/hockey_vanger_scan_history.py - permanente scan-
totalen, bijgewerkt bij een echt resultaat (post_cmd_result), onafhankelijk
van of VangerCmd/DataCapture later worden opgeruimd."""

from datetime import datetime

from sqlmodel import select

from models.hockey_discovery import ScanHistoryDaily
from services.hockey_vanger_scan_history import record_scan_outcome


def test_record_scan_outcome_creates_a_new_row(session):
    now = datetime(2026, 9, 1, 12, 0, 0)
    record_scan_outcome(session, "matchday_burst", success=True, when=now)
    session.commit()

    row = session.exec(select(ScanHistoryDaily)).first()
    assert row.date == "2026-09-01"
    assert row.reason == "matchday_burst"
    assert row.outcome == "success"
    assert row.count == 1


def test_record_scan_outcome_increments_an_existing_row(session):
    now = datetime(2026, 9, 1, 12, 0, 0)
    record_scan_outcome(session, "club_scan", success=True, when=now)
    record_scan_outcome(session, "club_scan", success=True, when=now)
    session.commit()

    rows = session.exec(select(ScanHistoryDaily)).all()
    assert len(rows) == 1
    assert rows[0].count == 2


def test_record_scan_outcome_keeps_success_and_failed_separate(session):
    now = datetime(2026, 9, 1, 12, 0, 0)
    record_scan_outcome(session, "club_scan", success=True, when=now)
    record_scan_outcome(session, "club_scan", success=False, when=now)
    session.commit()

    rows = {r.outcome: r.count for r in session.exec(select(ScanHistoryDaily)).all()}
    assert rows == {"success": 1, "failed": 1}


def test_record_scan_outcome_defaults_a_missing_reason_to_onbekend(session):
    now = datetime(2026, 9, 1, 12, 0, 0)
    record_scan_outcome(session, None, success=True, when=now)
    session.commit()

    row = session.exec(select(ScanHistoryDaily)).first()
    assert row.reason == "onbekend"


def test_record_scan_outcome_keeps_different_days_separate(session):
    record_scan_outcome(session, "club_scan", success=True, when=datetime(2026, 9, 1, 12, 0, 0))
    record_scan_outcome(session, "club_scan", success=True, when=datetime(2026, 9, 2, 12, 0, 0))
    session.commit()

    rows = {r.date: r.count for r in session.exec(select(ScanHistoryDaily)).all()}
    assert rows == {"2026-09-01": 1, "2026-09-02": 1}


def test_record_scan_outcome_keeps_different_targets_separate(session):
    """item 07-09-2026 ('als de scan-queue is opgeruimd dan mist deze
    info?'): target_type/target_id maken de uitkomst per-poule/competitie
    optelbaar, permanent - 2 verschillende poules op dezelfde dag/reason/
    outcome mogen niet in elkaar over lopen."""
    now = datetime(2026, 9, 1, 12, 0, 0)
    record_scan_outcome(session, "daily_fallback", success=True, when=now, target_type="poule", target_id=100)
    record_scan_outcome(session, "daily_fallback", success=True, when=now, target_type="poule", target_id=200)
    record_scan_outcome(session, "daily_fallback", success=True, when=now, target_type="poule", target_id=100)
    session.commit()

    rows = {r.target_id: r.count for r in session.exec(select(ScanHistoryDaily)).all()}
    assert rows == {100: 2, 200: 1}


def test_record_scan_outcome_without_target_stays_untargeted(session):
    """club_scan/get_clubs hebben geen los te tellen doel - target_type/
    target_id blijven None, en botsen niet met een wél-getarget rij op
    dezelfde dag/reason/outcome."""
    now = datetime(2026, 9, 1, 12, 0, 0)
    record_scan_outcome(session, "daily_fallback", success=True, when=now, target_type="poule", target_id=100)
    record_scan_outcome(session, "daily_fallback", success=True, when=now)
    session.commit()

    rows = session.exec(select(ScanHistoryDaily)).all()
    assert len(rows) == 2
    untargeted = next(r for r in rows if r.target_type is None)
    assert untargeted.count == 1
