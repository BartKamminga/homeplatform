"""Tests voor het Scanschema (Fase A, schaduw-modus) - services/
hockey_vanger_schedule.py. Elk event-type wordt getoetst tegen hetzelfde
scenario dat de bestaande _step_*-tests (test_hockey_vanger_scanplan_
matchday.py) als 'due' beoordelen, zodat de refactor de logica niet
stilzwijgend verandert."""

import json
from datetime import datetime, timedelta

from sqlmodel import select

from models.hockey import HockeyPublicationComp
from models.hockey_discovery import (
    HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyTeam, ScanScheduleEntry, VangerCmd,
)
from models.settings import AppSetting
from services.hockey_vanger_schedule import build_schedule_events, promote_due_schedule_entries, rebuild_schedule


def _setup_active_competition(session, now, last_scanned_at, match_offset_hours=-3, status="finished"):
    comp = HockeyCompetition(
        external_id="test|schedule-comp", name="Schedule Test", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)

    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))
    poule = HockeyPoule(
        poule_id=444, name="Poule Z", competition_id=comp.id, season="2026-2027",
        last_scanned_at=last_scanned_at,
    )
    session.add(poule)
    session.add(HockeyTeam(
        team_id=9, club_external_id="HH11ZZ0", name="Schedule Team", short_name="H9",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=444,
    ))
    match_start = now + timedelta(hours=match_offset_hours)
    session.add(HockeyPouleMatch(
        poule_id=444, match_id=7001, home_team_id=9, away_team_id=10,
        status=status, round=1, match_date=match_start.isoformat(),
    ))
    session.commit()
    return poule


def test_matchday_burst_event_is_generated_for_an_ended_match(session):
    now = datetime.utcnow()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))

    events = build_schedule_events(session, now, horizon_days=14)

    assert any(e["reason"] == "matchday_burst" and e["target_id"] == 444 for e in events)


def test_matchday_burst_stops_once_all_of_the_days_matches_are_final(session):
    now = datetime.utcnow()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(minutes=50), status="final")

    events = build_schedule_events(session, now, horizon_days=14)

    assert not any(e["reason"] == "matchday_burst" and e["target_id"] == 444 for e in events)


def test_live_check_event_is_generated_shortly_after_kickoff(session):
    now = datetime.utcnow()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2), match_offset_hours=-0.25, status="scheduled")

    events = build_schedule_events(session, now, horizon_days=14)

    live_checks = [e for e in events if e["reason"] == "live_check" and e["target_id"] == 444]
    assert live_checks
    assert live_checks[0]["planned_at"] >= now


def test_daily_fallback_event_is_generated_within_horizon(session):
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    match.status = "final"  # burst uitgeschakeld, puur de dagelijkse fallback testen
    session.add(match)
    session.commit()

    events = build_schedule_events(session, now, horizon_days=2)

    fallback = [e for e in events if e["reason"] == "daily_fallback" and e["target_id"] == 444]
    assert fallback
    expected = poule.last_scanned_at + timedelta(hours=24)
    assert fallback[0]["planned_at"] == expected


def test_hl_linked_poule_is_excluded_from_poule_events(session):
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=25))
    comp = session.get(HockeyCompetition, poule.competition_id)
    comp.hl_comp_id = 21
    session.add(comp)
    session.commit()

    events = build_schedule_events(session, now, horizon_days=14)

    assert not any(e["target_type"] == "poule" and e["target_id"] == 444 for e in events)


def test_landelijke_competitions_produce_no_schedule_events(session):
    """Landelijke competities worden niet meer los in het scanschema getoond -
    de 12u-cadans staat al in de beschrijving van de landelijke-groep-rij in
    DagView ('ververst ze allemaal · elke 12u'), een apart landelijke_cadence-
    reason was dubbelop."""
    now = datetime.utcnow()
    comp = HockeyCompetition(
        external_id="test|hl-schedule", name="Landelijk Test", class_name="Topklasse",
        hockey_type="VE", season="2026-2027", hl_comp_id=77,
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    poule = HockeyPoule(poule_id=888, name="Poule Y", competition_id=comp.id, season="2026-2027",
                         last_scanned_at=now - timedelta(hours=13))
    session.add(poule)
    session.commit()

    events = build_schedule_events(session, now, horizon_days=1)

    assert not any(e["target_id"] == 77 for e in events)
    assert not any(e["reason"] == "landelijke_cadence" for e in events)


def test_manual_weekly_event_is_generated_on_the_assigned_weekday(session):
    now = datetime.utcnow()
    comp = HockeyCompetition(
        external_id="test|manual-schedule", name="Manual Schedule Test", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub-manual", competition_id=comp.id, scan_profile="manual"))
    poule = HockeyPoule(poule_id=999, name="Poule M", competition_id=comp.id, season="2026-2027")
    session.add(poule)
    session.add(HockeyTeam(
        team_id=99, club_external_id="HH11ZZ0", name="Manual Team", short_name="M1",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=999,
    ))
    session.commit()

    events = build_schedule_events(session, now, horizon_days=7)

    assert any(e["reason"] == "manual_weekly" and e["target_id"] == 999 for e in events)


def test_unknown_start_recheck_event_is_generated_within_lookahead(session):
    now = datetime.utcnow()
    poule = _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=10))
    match = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).first()
    future_date = (now + timedelta(days=3)).replace(hour=0, minute=0, second=0, microsecond=0)
    match.match_date = future_date.isoformat()
    match.status = "scheduled"
    session.add(match)
    session.commit()

    events = build_schedule_events(session, now, horizon_days=14)

    assert any(e["reason"] == "unknown_start_recheck" and e["target_id"] == 444 for e in events)


def test_rebuild_schedule_persists_planned_entries_and_replaces_stale_ones(session):
    now = datetime.utcnow()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2))

    added_first = rebuild_schedule(session, now, horizon_days=14)
    assert added_first > 0
    first_count = len(session.exec(select(ScanScheduleEntry).where(ScanScheduleEntry.status == "planned")).all())
    assert first_count == added_first

    # Nogmaals herbouwen (bv. na een instellingswijziging) mag niet stapelen -
    # de oude 'planned'-rijen worden vervangen, niet aangevuld.
    added_second = rebuild_schedule(session, now, horizon_days=14)
    second_count = len(session.exec(select(ScanScheduleEntry).where(ScanScheduleEntry.status == "planned")).all())
    assert second_count == added_second


def test_promote_due_schedule_entries_creates_a_vanger_cmd(session):
    now = datetime.utcnow()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=30))
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=444, cmd_type="get_poule",
        params=json.dumps({"poule_id": 444, "team_id": 9, "label": "Test"}),
        planned_at=now - timedelta(minutes=1), reason="daily_fallback",
    ))
    session.commit()

    promoted = promote_due_schedule_entries(session, now)

    assert promoted == 1
    entry = session.exec(select(ScanScheduleEntry)).first()
    assert entry.status == "promoted"
    assert entry.vanger_cmd_id is not None
    cmd = session.exec(select(VangerCmd).where(VangerCmd.id == entry.vanger_cmd_id)).first()
    assert cmd is not None
    assert cmd.cmd_type == "get_poule"


def test_promote_due_schedule_entries_does_not_duplicate_an_already_queued_cmd(session):
    now = datetime.utcnow()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=30))
    session.add(VangerCmd(
        cmd_type="get_poule", params=json.dumps({"poule_id": 444, "team_id": 9}), status="pending",
    ))
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=444, cmd_type="get_poule",
        params=json.dumps({"poule_id": 444, "team_id": 9, "label": "Test"}),
        planned_at=now - timedelta(minutes=1), reason="daily_fallback",
    ))
    session.commit()

    promote_due_schedule_entries(session, now)

    all_cmds = session.exec(select(VangerCmd)).all()
    assert len(all_cmds) == 1  # geen dubbele rij - add_vanger_cmd's dedup blijft van kracht
    entry = session.exec(select(ScanScheduleEntry)).first()
    assert entry.status == "promoted"


def test_immediate_events_are_capped_like_the_real_steps(session):
    """Roadmap-melding (30-08-2026): op acc leverde een eerste rebuild+promote
    in 1x 900 nieuwe VangerCmd-rijen op omdat new_or_empty/club_scan geen cap
    hadden (in tegenstelling tot de echte _step_new_or_empty_poules/
    _step_club_scan, die altijd STEP_MAX_CMDS hanteren)."""
    now = datetime.utcnow()
    comp = HockeyCompetition(
        external_id="test|cap-comp", name="Cap Test", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))
    for i in range(20):
        poule_id = 5000 + i
        session.add(HockeyTeam(
            team_id=6000 + i, club_external_id="HH11ZZ0", name=f"Cap Team {i}", short_name=f"H{i}",
            hockey_type="VE", category_group_name="Senioren", recent_poule_id=poule_id,
        ))
    session.commit()

    events = build_schedule_events(session, now, horizon_days=14)

    new_or_empty = [e for e in events if e["reason"] == "new_or_empty"]
    assert len(new_or_empty) <= 10


def test_promote_due_schedule_entries_is_capped_per_call(session):
    now = datetime.utcnow()
    for i in range(20):
        session.add(ScanScheduleEntry(
            target_type="poule", target_id=5000 + i, cmd_type="get_poule",
            params=json.dumps({"poule_id": 5000 + i, "team_id": 6000 + i, "label": "Test"}),
            planned_at=now - timedelta(minutes=1), reason="daily_fallback",
        ))
    session.commit()

    promoted = promote_due_schedule_entries(session, now)

    assert promoted <= 10
    remaining_planned = session.exec(
        select(ScanScheduleEntry).where(ScanScheduleEntry.status == "planned")
    ).all()
    assert len(remaining_planned) >= 10


def test_promote_ignores_entries_not_yet_due(session):
    now = datetime.utcnow()
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=30))
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=444, cmd_type="get_poule",
        params=json.dumps({"poule_id": 444, "team_id": 9, "label": "Test"}),
        planned_at=now + timedelta(hours=1), reason="daily_fallback",
    ))
    session.commit()

    promoted = promote_due_schedule_entries(session, now)

    assert promoted == 0
    entry = session.exec(select(ScanScheduleEntry)).first()
    assert entry.status == "planned"


# ── scan-venster (niet-wedstrijd-gebonden momenten binnen 09:00-18:00) ────

def test_daily_fallback_is_clamped_into_the_scan_window(session):
    # now = 03:00 zodat de fallback-tick (24u na last_scanned_at, dus ook
    # 03:00) ruim buiten het standaard venster (09:00-18:00) valt.
    now = datetime(2026, 9, 1, 3, 0, 0)
    poule = _setup_active_competition(
        session, now, last_scanned_at=now - timedelta(hours=24), match_offset_hours=-28, status="final",
    )

    events = build_schedule_events(session, now, horizon_days=2)

    fallback = next(e for e in events if e["reason"] == "daily_fallback" and e["target_id"] == poule.poule_id)
    assert fallback["planned_at"].hour == 9
    assert fallback["planned_at"].date() == now.date()


def test_daily_fallback_within_the_window_is_unchanged(session):
    now = datetime(2026, 9, 1, 3, 0, 0)
    poule = _setup_active_competition(
        session, now, last_scanned_at=now - timedelta(hours=17), match_offset_hours=-28, status="final",
    )  # tick = now - 17u + 24u = 10:00, al binnen het venster

    events = build_schedule_events(session, now, horizon_days=2)

    fallback = next(e for e in events if e["reason"] == "daily_fallback" and e["target_id"] == poule.poule_id)
    assert fallback["planned_at"].hour == 10


def test_daily_fallback_past_the_window_rolls_to_the_next_day(session):
    now = datetime(2026, 9, 1, 3, 0, 0)
    poule = _setup_active_competition(
        session, now, last_scanned_at=now - timedelta(hours=3), match_offset_hours=-28, status="final",
    )  # tick = now - 3u + 24u = 2026-09-02 00:00 -> na 18:00 het venster ervoor

    events = build_schedule_events(session, now, horizon_days=3)

    fallback = next(e for e in events if e["reason"] == "daily_fallback" and e["target_id"] == poule.poule_id)
    assert fallback["planned_at"].hour == 9
    assert fallback["planned_at"].date() == (now + timedelta(days=1)).date()


def test_scan_window_is_configurable(session):
    now = datetime(2026, 9, 1, 3, 0, 0)
    session.add(AppSetting(key="scan_window_start_hour", value="7"))
    session.add(AppSetting(key="scan_window_end_hour", value="20"))
    poule = _setup_active_competition(
        session, now, last_scanned_at=now - timedelta(hours=24), match_offset_hours=-28, status="final",
    )
    session.commit()

    events = build_schedule_events(session, now, horizon_days=2)

    fallback = next(e for e in events if e["reason"] == "daily_fallback" and e["target_id"] == poule.poule_id)
    assert fallback["planned_at"].hour == 7


def test_matchday_burst_and_live_check_are_not_clamped_to_the_scan_window(session):
    """Wedstrijd-gebonden momenten (burst/live-check) hangen aan de echte
    wedstrijdtijd (kan 's avonds zijn) en mogen NIET verschoven worden naar
    het scan-venster - alleen niet-wedstrijd-gebonden momenten wel."""
    now = datetime(2026, 9, 1, 20, 30, 0)  # ruim buiten het standaard venster
    _setup_active_competition(session, now, last_scanned_at=now - timedelta(hours=2), match_offset_hours=-0.5, status="scheduled")

    events = build_schedule_events(session, now, horizon_days=1)

    burst = [e for e in events if e["reason"] == "matchday_burst" and e["target_id"] == 444]
    assert burst
    assert burst[0]["planned_at"].hour >= 20  # niet verplaatst naar 09:00-18:00


def test_manual_weekly_uses_the_configurable_window_start_hour(session):
    now = datetime(2026, 9, 1, 3, 0, 0)  # dinsdag
    session.add(AppSetting(key="scan_window_start_hour", value="11"))
    comp = HockeyCompetition(
        external_id="test|manual-window", name="Manual Window Test", class_name="District",
        hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub-manual", competition_id=comp.id, scan_profile="manual"))
    poule = HockeyPoule(poule_id=999, name="Poule M", competition_id=comp.id, season="2026-2027")
    session.add(poule)
    session.add(HockeyTeam(
        team_id=99, club_external_id="HH11ZZ0", name="Manual Team", short_name="M1",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=999,
    ))
    session.commit()

    events = build_schedule_events(session, now, horizon_days=7)

    manual = next(e for e in events if e["reason"] == "manual_weekly" and e["target_id"] == 999)
    assert manual["planned_at"].hour == 11
