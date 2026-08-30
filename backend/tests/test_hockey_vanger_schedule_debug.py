"""Tests voor de scanschema-debug-pagina (backend/routers/hockey_vanger_
schedule_debug.py) - filterbare/gepagineerde browse van ScanScheduleEntry,
los van de echte vanger-queue (VangerCmd, zie test_hockey_vanger_cmd_queue_
debug.py)."""

import json

from models.hockey import HockeyPublicationComp
from models.hockey_discovery import HockeyClub, HockeyCompetition, HockeyPoule, HockeyTeam, ScanScheduleEntry
from models.settings import AppSetting
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


def test_browse_labels_a_not_yet_discovered_poule_using_the_params_label(session):
    """new_or_empty-poules hebben per definitie nog geen HockeyPoule-rij (dat
    IS het punt van new_or_empty) - de label moet dan uit params.label
    komen i.p.v. een verwarrende 'onbekend/verwijderd'-melding te tonen."""
    from datetime import datetime
    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=999999, cmd_type="get_poule",
        params=json.dumps({"poule_id": 999999, "team_id": 1, "label": "Alkmaar JO16-1"}),
        planned_at=now, reason="new_or_empty",
    ))
    session.commit()

    result = browse_schedule(session=session, _=None)

    assert "Alkmaar JO16-1" in result["items"][0]["label"]
    assert "verwijderd" not in result["items"][0]["label"]


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


def test_browse_flags_a_cancelled_entry_that_falls_outside_the_queue_filter(session):
    """Fase C, item 1015 (Bart, 30-08-2026): filtered_out wordt dynamisch
    herberekend voor 'cancelled'-entries, net als bij de Vanger-queue-debug
    - laat zien of een gecancelde rij specifiek OMDAT hij buiten het
    queue-filter viel is overgeslagen bij promotie."""
    from datetime import datetime
    now = datetime.utcnow()
    poule = _setup_poule(session, poule_id=200)
    session.add(HockeyTeam(
        team_id=77, club_external_id="HH77ZZ0", name="Filter Test Team", short_name="H77",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=poule.poule_id,
    ))
    session.add(AppSetting(key="disc_queue_category", value="Junioren"))
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=poule.poule_id, cmd_type="get_poule",
        params=json.dumps({"poule_id": poule.poule_id, "team_id": 77, "label": "Filter Test Team"}),
        planned_at=now, reason="daily_fallback", status="cancelled",
    ))
    session.commit()

    result = browse_schedule(session=session, _=None)

    assert result["items"][0]["filtered_out"] is True


def test_browse_does_not_flag_a_planned_entry_as_filtered_out(session):
    """filtered_out is alleen relevant voor 'cancelled'-rijen - een gewone
    'planned'-rij die (nog) niet is beoordeeld mag niet als buiten-filter
    getoond worden."""
    from datetime import datetime
    now = datetime.utcnow()
    session.add(AppSetting(key="disc_queue_category", value="Junioren"))
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=1, cmd_type="get_poule",
        params=json.dumps({"poule_id": 1, "team_id": 999}), planned_at=now, reason="daily_fallback", status="planned",
    ))
    session.commit()

    result = browse_schedule(session=session, _=None)

    assert result["items"][0]["filtered_out"] is False


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
