"""Tests voor de scanschema-debug-pagina (backend/routers/hockey_vanger_
schedule_debug.py) - filterbare/gepagineerde browse van ScanScheduleEntry,
los van de echte vanger-queue (VangerCmd, zie test_hockey_vanger_cmd_queue_
debug.py)."""

import json

from models.hockey import HockeyPublicationComp
from models.hockey_discovery import HockeyClub, HockeyCompetition, HockeyPoule, ScanScheduleEntry
from routers.hockey_vanger_schedule_debug import browse_schedule, schedule_summary


def _setup_poule(session, poule_id, name="Poule A"):
    comp = HockeyCompetition(
        external_id=f"test|schedule-debug-{poule_id}", name="Schedule Debug Comp", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))
    poule = HockeyPoule(poule_id=poule_id, name=name, competition_id=comp.id, season="2026-2027")
    session.add(poule)
    session.commit()
    return poule


def test_browse_returns_all_entries_when_no_filters(session):
    from datetime import datetime
    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=1, cmd_type="get_poule",
        params=json.dumps({"poule_id": 1}), planned_at=now, reason="daily_fallback",
    ))
    session.add(ScanScheduleEntry(
        target_type="club", target_id=2, cmd_type="scan_club",
        params=json.dumps({"external_id": "X"}), planned_at=now, reason="club_scan",
    ))
    session.commit()

    result = browse_schedule(session=session, _=None)

    assert result["total"] == 2


def test_browse_filters_by_status_reason_and_target_type(session):
    from datetime import datetime
    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=1, cmd_type="get_poule",
        params=json.dumps({"poule_id": 1}), planned_at=now, reason="daily_fallback", status="planned",
    ))
    session.add(ScanScheduleEntry(
        target_type="club", target_id=2, cmd_type="scan_club",
        params=json.dumps({"external_id": "X"}), planned_at=now, reason="club_scan", status="promoted",
    ))
    session.commit()

    only_planned = browse_schedule(status="planned", session=session, _=None)
    only_club_scan = browse_schedule(reason="club_scan", session=session, _=None)
    only_poule = browse_schedule(target_type="poule", session=session, _=None)

    assert only_planned["total"] == 1
    assert only_club_scan["total"] == 1 and only_club_scan["items"][0]["reason"] == "club_scan"
    assert only_poule["total"] == 1 and only_poule["items"][0]["target_type"] == "poule"


def test_browse_enriches_a_poule_entry_with_its_real_name(session):
    from datetime import datetime
    poule = _setup_poule(session, poule_id=555, name="Poule Z")
    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=poule.poule_id, cmd_type="get_poule",
        params=json.dumps({"poule_id": poule.poule_id}), planned_at=now, reason="daily_fallback",
    ))
    session.commit()

    result = browse_schedule(session=session, _=None)

    assert "Poule Z" in result["items"][0]["label"]


def test_browse_orders_by_planned_at_ascending(session):
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=1, cmd_type="get_poule",
        params=json.dumps({"poule_id": 1}), planned_at=now + timedelta(hours=5), reason="daily_fallback",
    ))
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=2, cmd_type="get_poule",
        params=json.dumps({"poule_id": 2}), planned_at=now + timedelta(hours=1), reason="daily_fallback",
    ))
    session.commit()

    result = browse_schedule(session=session, _=None)

    assert result["items"][0]["target_id"] == 2  # eerder gepland komt eerst


def test_browse_pagination(session):
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    for i in range(5):
        session.add(ScanScheduleEntry(
            target_type="poule", target_id=i, cmd_type="get_poule",
            params=json.dumps({"poule_id": i}), planned_at=now + timedelta(hours=i), reason="daily_fallback",
        ))
    session.commit()

    page1 = browse_schedule(limit=2, offset=0, session=session, _=None)
    page2 = browse_schedule(limit=2, offset=2, session=session, _=None)

    assert page1["total"] == 5
    assert len(page1["items"]) == 2
    assert page1["items"][0]["target_id"] != page2["items"][0]["target_id"]


def test_browse_filters_by_target_id(session):
    from datetime import datetime
    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=444, cmd_type="get_poule",
        params=json.dumps({"poule_id": 444}), planned_at=now, reason="daily_fallback",
    ))
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=555, cmd_type="get_poule",
        params=json.dumps({"poule_id": 555}), planned_at=now, reason="daily_fallback",
    ))
    session.commit()

    result = browse_schedule(target_id=444, session=session, _=None)

    assert result["total"] == 1
    assert result["items"][0]["target_id"] == 444


def test_browse_filters_by_date(session):
    from datetime import datetime, timedelta
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=1, cmd_type="get_poule",
        params=json.dumps({"poule_id": 1}), planned_at=datetime(2026, 9, 5, 10, 0, 0), reason="daily_fallback",
    ))
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=2, cmd_type="get_poule",
        params=json.dumps({"poule_id": 2}), planned_at=datetime(2026, 9, 6, 10, 0, 0), reason="daily_fallback",
    ))
    session.commit()

    result = browse_schedule(date="2026-09-05", session=session, _=None)

    assert result["total"] == 1
    assert result["items"][0]["target_id"] == 1


def test_summary_counts_by_status_and_reason(session):
    from datetime import datetime
    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=1, cmd_type="get_poule",
        params=json.dumps({"poule_id": 1}), planned_at=now, reason="daily_fallback", status="planned",
    ))
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=2, cmd_type="get_poule",
        params=json.dumps({"poule_id": 2}), planned_at=now, reason="daily_fallback", status="planned",
    ))
    session.add(ScanScheduleEntry(
        target_type="club", target_id=3, cmd_type="scan_club",
        params=json.dumps({"external_id": "X"}), planned_at=now, reason="club_scan", status="promoted",
    ))
    session.commit()

    result = schedule_summary(session=session, _=None)

    assert result["total"] == 3
    assert result["by_status"]["planned"] == 2
    assert result["by_status"]["promoted"] == 1
    assert result["by_reason_planned"]["daily_fallback"] == 2
    assert "club_scan" not in result["by_reason_planned"]  # die rij is al gepromoveerd
