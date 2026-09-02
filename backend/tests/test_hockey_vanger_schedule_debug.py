"""Tests voor de scanschema-debug-pagina (backend/routers/hockey_vanger_
schedule_debug.py) - filterbare/gepagineerde browse van ScanScheduleEntry,
los van de echte vanger-queue (VangerCmd, zie test_hockey_vanger_cmd_queue_
debug.py)."""

import json

from sqlmodel import select

from models.hockey import HockeyPublicationComp
from models.hockey_discovery import HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyTeam, ScanScheduleEntry
from models.settings import AppSetting
from routers.hockey_vanger_schedule_debug import browse_schedule, promote_schedule_now, rebuild_schedule_now, schedule_summary


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


# ── item 1019: competitienaam in het label + een echte reden-uitleg ──

def test_browse_includes_the_competition_name_in_a_poule_label(session):
    from datetime import datetime
    poule = _setup_poule(session, poule_id=556, name="Poule Z")
    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=poule.poule_id, cmd_type="get_poule",
        params=json.dumps({"poule_id": poule.poule_id}), planned_at=now, reason="daily_fallback",
    ))
    session.commit()

    result = browse_schedule(session=session, _=None)

    assert "Schedule Debug Comp" in result["items"][0]["label"]
    assert "Poule Z" in result["items"][0]["label"]


def test_browse_explains_daily_fallback_with_hours_since_last_scan(session):
    from datetime import datetime, timedelta
    poule = _setup_poule(session, poule_id=557, name="Poule Z")
    poule.last_scanned_at = datetime.utcnow() - timedelta(hours=30)
    session.add(poule)
    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=poule.poule_id, cmd_type="get_poule",
        params=json.dumps({"poule_id": poule.poule_id}), planned_at=now, reason="daily_fallback",
    ))
    session.commit()

    result = browse_schedule(session=session, _=None)

    explanation = result["items"][0]["explanation"]
    assert "24u" in explanation  # default active_daily_fallback_hours
    assert "30u geleden" in explanation


def test_browse_explains_manual_weekly_with_the_assigned_weekday(session):
    from datetime import datetime
    comp = HockeyCompetition(
        external_id="test|manual-weekday-explain", name="Manual Weekday Comp", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub-manual", competition_id=comp.id, scan_profile="manual"))
    poule = HockeyPoule(poule_id=558, name="Poule M", competition_id=comp.id, season="2026-2027")
    session.add(poule)
    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=poule.poule_id, cmd_type="get_poule",
        params=json.dumps({"poule_id": poule.poule_id}), planned_at=now, reason="manual_weekly",
    ))
    session.commit()

    from services.hockey_vanger_scanplan import _manual_scan_weekday
    weekday_names = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag"]
    expected_weekday = weekday_names[_manual_scan_weekday(comp.id)]

    result = browse_schedule(session=session, _=None)

    explanation = result["items"][0]["explanation"]
    assert expected_weekday in explanation
    assert "Manual Weekday Comp" in result["items"][0]["label"]


def test_browse_explains_daily_fallback_with_the_offending_match(session):
    """Bart, 31-08-2026: 'waarom scannen we dit? is die poule niet vers meer?
    missen er wedstrijden (uitslagen of tijden)?' - de uitleg moet de
    CONCRETE wedstrijd noemen die de poule 'ongezond' maakt, niet alleen de
    cadans-instelling."""
    from datetime import datetime, timedelta
    poule = _setup_poule(session, poule_id=559, name="Poule Z")
    poule.last_scanned_at = datetime.utcnow() - timedelta(hours=30)
    session.add(poule)
    session.add(HockeyPouleMatch(
        poule_id=poule.poule_id, match_id=1, home_team_id=1, away_team_id=2,
        home_team_name="Team A", away_team_name="Team B",
        status="scheduled", round=1, match_date=(datetime.utcnow() - timedelta(hours=4)).isoformat(),
    ))
    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=poule.poule_id, cmd_type="get_poule",
        params=json.dumps({"poule_id": poule.poule_id}), planned_at=now, reason="daily_fallback",
    ))
    session.commit()

    result = browse_schedule(session=session, _=None)

    explanation = result["items"][0]["explanation"]
    assert "Team A - Team B" in explanation
    assert "zonder eindstand" in explanation


def test_browse_explains_daily_fallback_for_a_poule_without_any_known_matches(session):
    """Bart, 31-08-2026 (prod-melding): "Dagelijkse fallback-cadans (24u) -
    35u geleden." zonder verdere uitleg leek de rede niet te kloppen - de
    poule heeft namelijk 0 wedstrijden bekend (geen uitslagen, geen tijden),
    en dat moet expliciet in de uitleg staan i.p.v. stil te blijven."""
    from datetime import datetime, timedelta
    poule = _setup_poule(session, poule_id=560, name="Poule A")
    poule.last_scanned_at = datetime.utcnow() - timedelta(hours=35)
    session.add(poule)
    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=poule.poule_id, cmd_type="get_poule",
        params=json.dumps({"poule_id": poule.poule_id}), planned_at=now, reason="daily_fallback",
    ))
    session.commit()

    result = browse_schedule(session=session, _=None)

    explanation = result["items"][0]["explanation"]
    assert "geen enkele wedstrijd bekend" in explanation
    assert "uitslagen" in explanation and "tijden" in explanation


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


def test_rebuild_schedule_now_populates_the_schedule_on_demand(session):
    """Bart, 30-08-2026: 'kan er niet een button komen dan ik het zelf kan
    doen?' - handmatige rebuild-trigger voor als scan_plan_enabled=0 en de
    periodieke pass dus niet vanzelf draait. Puur de PREVIEW herberekenen,
    geen echte scan."""
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    poule = _setup_poule(session, poule_id=333)
    session.add(HockeyTeam(
        team_id=88, club_external_id="HH88ZZ0", name="Rebuild Now Team", short_name="H88",
        hockey_type="VE", category_group_name="Junioren", recent_poule_id=poule.poule_id,
    ))
    session.add(HockeyPouleMatch(
        poule_id=poule.poule_id, match_id=5001, home_team_id=88, away_team_id=89,
        status="scheduled", round=1, match_date=(now + timedelta(hours=2)).isoformat(),
    ))
    session.commit()
    assert session.exec(select(ScanScheduleEntry)).all() == []

    result = rebuild_schedule_now(session=session, _=None)

    assert result["ok"] is True
    assert result["event_count"] > 0
    rows = session.exec(select(ScanScheduleEntry).where(ScanScheduleEntry.target_id == poule.poule_id)).all()
    assert any(r.reason == "match_end_check" for r in rows)


def test_promote_schedule_now_promotes_due_entries_immediately(session):
    """item 1026 (Bart, 31-08-2026: 'handmatig versnellen van de queue moet
    mogelijk zijn') - i.t.t. rebuild_schedule_now heeft dit een ECHT effect:
    een due entry wordt direct naar VangerCmd gepromoveerd, zonder te wachten
    op de periodieke cyclus."""
    from datetime import datetime, timedelta

    from models.hockey_discovery import VangerCmd

    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=444, cmd_type="get_poule",
        params=json.dumps({"poule_id": 444, "team_id": 91, "label": "Promote Now Team"}),
        planned_at=now - timedelta(minutes=5), reason="daily_fallback", status="planned",
    ))
    session.commit()

    result = promote_schedule_now(session=session, _=None)

    assert result["ok"] is True
    assert result["promoted"] == 1
    assert session.exec(select(VangerCmd).where(VangerCmd.cmd_type == "get_poule")).first() is not None
    entry = session.exec(select(ScanScheduleEntry).where(ScanScheduleEntry.target_id == 444)).first()
    assert entry.status == "promoted"


def test_promote_schedule_now_reports_zero_when_nothing_is_due(session):
    result = promote_schedule_now(session=session, _=None)

    assert result == {"ok": True, "promoted": 0}


def test_promote_schedule_now_with_within_hours_pulls_forward_a_not_yet_due_entry(session):
    """item 1026/1032 (Bart, 1-09-2026: 'versnellen kijk niet over dagen heen?')
    - een entry die pas over 20u due is, wordt zonder within_hours NIET
    gepromoveerd, wel met within_hours=24. unknown_start_recheck (niet
    tijdgebonden aan een wedstrijd) staat op de ACCELERATABLE_REASONS-
    whitelist, dus dit mag vervroegd worden."""
    from datetime import datetime, timedelta

    from models.hockey_discovery import VangerCmd

    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=445, cmd_type="get_poule",
        params=json.dumps({"poule_id": 445, "team_id": 92, "label": "Pull Forward Team"}),
        planned_at=now + timedelta(hours=20), reason="unknown_start_recheck", status="planned",
    ))
    session.commit()

    not_yet = promote_schedule_now(within_hours=0, session=session, _=None)
    assert not_yet["promoted"] == 0

    pulled_forward = promote_schedule_now(within_hours=24, session=session, _=None)
    assert pulled_forward["promoted"] == 1
    assert session.exec(select(VangerCmd).where(VangerCmd.cmd_type == "get_poule")).first() is not None


def test_promote_schedule_now_never_pulls_forward_a_match_bound_or_result_check_reason(session):
    """item 1032 (Bart, 1-09-2026): 'echt tijdgebonden items (start/end/live)
    niet noodzakelijkerwijs EERDER uitgevoerd... alleen poules met missende
    starttijden, clubs/club zaken' - daily_fallback/manual_weekly (in de kern
    ook een resultaat-check) en de matchday-reasons mogen NOOIT vroeger dan
    hun natuurlijke planned_at gepromoveerd worden, ook niet met een ruim
    within_hours-venster. Voorkomt ook het duplicatie-risico uit item 1031
    (bevinding 3: add_vanger_cmd dedupt niet tegen een al-done cmd)."""
    from datetime import datetime, timedelta

    now = datetime.utcnow()
    for i, reason in enumerate(["daily_fallback", "manual_weekly", "match_start_check", "match_end_check"]):
        session.add(ScanScheduleEntry(
            target_type="poule", target_id=500 + i, cmd_type="get_poule",
            params=json.dumps({"poule_id": 500 + i, "team_id": 900 + i, "label": f"Not Whitelisted {i}"}),
            planned_at=now + timedelta(hours=20), reason=reason, status="planned",
        ))
    session.commit()

    result = promote_schedule_now(within_hours=24, session=session, _=None)

    assert result["promoted"] == 0
    still_planned = session.exec(select(ScanScheduleEntry).where(ScanScheduleEntry.status == "planned")).all()
    assert len(still_planned) == 4


def test_promote_schedule_now_tomorrow_mode_uses_end_of_calendar_day(session):
    """item 1032: 'tomorrow'-mode moet een kalenderdag-grens gebruiken
    (23:59:59 van morgen), niet een rollend 24u-venster."""
    from datetime import datetime, timedelta

    now = datetime.utcnow()
    just_within_tomorrow = (now + timedelta(days=1)).replace(hour=22, minute=0, second=0, microsecond=0)
    session.add(ScanScheduleEntry(
        target_type="club", target_id=1, cmd_type="scan_club",
        params=json.dumps({"external_id": "TOM_CLUB", "label": "Tomorrow Club"}),
        planned_at=just_within_tomorrow, reason="club_scan", status="planned",
    ))
    session.commit()

    result = promote_schedule_now(mode="tomorrow", session=session, _=None)

    assert result["promoted"] == 1


def test_promote_schedule_now_until_next_start_check_mode(session):
    """item 1032 (Bart: 'of alles tot de eerste wedstrijd start check') -
    cutoff = het eerstvolgende geplande match_start_check-moment."""
    from datetime import datetime, timedelta

    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=1, cmd_type="get_poule",
        params=json.dumps({"poule_id": 1, "team_id": 1, "label": "Before Start Check"}),
        planned_at=now + timedelta(hours=2), reason="unknown_start_recheck", status="planned",
    ))
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=2, cmd_type="get_poule",
        params=json.dumps({"poule_id": 2, "team_id": 2, "label": "The Start Check Itself"}),
        planned_at=now + timedelta(hours=3), reason="match_start_check", status="planned",
    ))
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=3, cmd_type="get_poule",
        params=json.dumps({"poule_id": 3, "team_id": 3, "label": "After Start Check"}),
        planned_at=now + timedelta(hours=4), reason="unknown_start_recheck", status="planned",
    ))
    session.commit()

    result = promote_schedule_now(mode="until_next_start_check", session=session, _=None)

    # De match_start_check zelf mag niet vervroegd worden (niet whitelisted),
    # dus alleen target_id=1 (voor de cutoff) wordt gepromoveerd - target_id=3
    # (na de cutoff) blijft ook liggen.
    assert result["promoted"] == 1
    still_planned_ids = {e.target_id for e in session.exec(
        select(ScanScheduleEntry).where(ScanScheduleEntry.status == "planned")
    ).all()}
    assert still_planned_ids == {2, 3}


def test_promote_schedule_now_count_mode_promotes_the_next_n_accelerable_items(session):
    """item 1032 (Bart: 'misschien is het eenvoudiger promoot de volgende x
    items') - telt alleen daadwerkelijk gepromoveerde (whitelisted) items
    mee, een niet-whitelisted item ertussen wordt overgeslagen en telt niet."""
    from datetime import datetime, timedelta

    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="club", target_id=1, cmd_type="scan_club",
        params=json.dumps({"external_id": "COUNT_CLUB_1", "label": "Count Club 1"}),
        planned_at=now + timedelta(hours=1), reason="club_scan", status="planned",
    ))
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=2, cmd_type="get_poule",
        params=json.dumps({"poule_id": 2, "team_id": 2, "label": "Not whitelisted"}),
        planned_at=now + timedelta(hours=2), reason="daily_fallback", status="planned",
    ))
    session.add(ScanScheduleEntry(
        target_type="club", target_id=3, cmd_type="scan_club",
        params=json.dumps({"external_id": "COUNT_CLUB_3", "label": "Count Club 3"}),
        planned_at=now + timedelta(hours=3), reason="club_scan", status="planned",
    ))
    session.commit()

    result = promote_schedule_now(mode="count", limit=2, session=session, _=None)

    assert result["promoted"] == 2
    still_planned = session.exec(select(ScanScheduleEntry).where(ScanScheduleEntry.status == "planned")).all()
    assert len(still_planned) == 1
    assert still_planned[0].reason == "daily_fallback"
