"""Tests voor het scan-calendar-endpoint (items 1009/1011/1012) - de nieuwe
Kalender-tab in hockey-inside leunt hier volledig op."""

import json
from datetime import datetime, timedelta

from models.capture import DataCapture, new_uuid
from models.hockey import HockeyPublicationComp
from models.hockey_discovery import (
    HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyTeam, ScanScheduleEntry,
)
from models.settings import AppSetting
from routers.hockey_vanger_calendar import get_scan_calendar


def _today_match_date(offset_days=0):
    return (datetime.utcnow() + timedelta(days=offset_days)).strftime("%Y-%m-%dT12:00:00+02:00")


def _setup_poule(session, poule_id, competition_id, team_id, short_name="JO16-1",
                  category="Junioren", hockey_type="VE", published=True):
    comp = HockeyCompetition(
        id=None, external_id=f"test|{competition_id}", name=f"Comp {competition_id}",
        class_name="Klasse", hockey_type=hockey_type, season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)

    if published:
        session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))

    poule = HockeyPoule(poule_id=poule_id, name="Poule A", competition_id=comp.id, season="2026-2027")
    session.add(poule)
    session.add(HockeyTeam(
        team_id=team_id, club_external_id="HH11ZZ0", name=f"Test {short_name}", short_name=short_name,
        hockey_type=hockey_type, category_group_name=category, recent_poule_id=poule_id,
    ))
    session.add(HockeyPouleMatch(
        poule_id=poule_id, match_id=poule_id * 10, home_team_id=team_id, away_team_id=team_id + 1,
        home_team_name="Home", away_team_name="Away", match_date=_today_match_date(), status="scheduled",
    ))
    session.commit()
    return comp, poule


def test_active_published_poule_appears_in_calendar(session):
    _setup_poule(session, poule_id=1, competition_id=1, team_id=100)

    result = get_scan_calendar(session=session, _=None)

    assert len(result["poules"]) == 1
    assert result["poules"][0]["poule_id"] == 1
    assert result["poules"][0]["is_landelijke"] is False


def test_schedule_entry_planned_at_is_serialized_with_an_explicit_utc_suffix(session):
    """Regressie: alle datetime-velden hier zijn naive-maar-UTC. Zonder
    expliciete 'Z' interpreteert de browser new Date('...T12:00:00') als
    LOKALE tijd (2 uur mis in CEST) i.p.v. UTC - zie _iso() in
    hockey_vanger_calendar.py."""
    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=444, cmd_type="get_poule",
        params=json.dumps({"poule_id": 444, "team_id": 9}),
        planned_at=now + timedelta(hours=3), reason="matchday_burst",
    ))
    session.commit()

    result = get_scan_calendar(session=session, _=None)

    entry = next(e for e in result["schedule_entries"] if e["target_id"] == 444)
    assert entry["planned_at"].endswith("Z")


def test_unpublished_poule_of_a_followed_team_still_appears(session):
    session.add(AppSetting(key="notify_team_ids", value="200"))
    session.commit()
    _setup_poule(session, poule_id=2, competition_id=2, team_id=200, published=False)

    result = get_scan_calendar(session=session, _=None)

    assert len(result["poules"]) == 1
    assert result["poules"][0]["poule_id"] == 2
    assert result["poules"][0]["followed"] is True


def test_landelijke_poule_is_flagged(session):
    comp, poule = _setup_poule(session, poule_id=3, competition_id=3, team_id=300)
    comp.hl_comp_id = 21
    session.add(comp)
    session.commit()

    result = get_scan_calendar(session=session, _=None)

    assert result["poules"][0]["is_landelijke"] is True


def test_senior_poule_is_marked_outside_the_default_junioren_filter(session):
    _setup_poule(session, poule_id=4, competition_id=4, team_id=400, category="Senioren")

    result = get_scan_calendar(session=session, _=None)

    assert result["poules"][0]["in_active_filter"] is False


def test_recent_captures_maps_poule_capture_to_its_poule_id(session):
    _setup_poule(session, poule_id=5, competition_id=5, team_id=500)
    session.add(DataCapture(
        id=new_uuid(), source="hockey-vanger", capture_type="poule_capture", external_id="poule_capture_5",
        session_id="s1", payload="{}", meta="{}", captured_at=datetime.utcnow(),
    ))
    session.commit()

    result = get_scan_calendar(session=session, _=None)

    assert any(c["poule_id"] == 5 for c in result["recent_captures"])


def test_recent_captures_maps_comp_detail_to_all_its_poules(session):
    comp, poule = _setup_poule(session, poule_id=6, competition_id=6, team_id=600)
    comp.hl_comp_id = 21
    session.add(comp)
    session.add(DataCapture(
        id=new_uuid(), source="hockey-vanger", capture_type="comp_detail", external_id="comp_detail_21",
        session_id="s1", payload="{}", meta=json.dumps({"comp_id": 21}), captured_at=datetime.utcnow(),
    ))
    session.commit()

    result = get_scan_calendar(session=session, _=None)

    assert any(c["poule_id"] == 6 for c in result["recent_captures"])


def test_club_captures_are_reported_with_club_name(session):
    session.add(HockeyClub(external_id="HH11QW6", name="Victoria", friendly_name="Victoria"))
    session.add(DataCapture(
        id=new_uuid(), source="hockey-vanger", capture_type="club_detail", external_id="club_detail_HH11QW6",
        session_id="s1", payload="{}", meta="{}", captured_at=datetime.utcnow(),
    ))
    session.commit()

    result = get_scan_calendar(session=session, _=None)

    assert len(result["club_captures"]) == 1
    assert result["club_captures"][0]["club_name"] == "Victoria"
    assert result["club_captures"][0]["cmd_type"] == "scan_club"


def test_clubs_list_capture_is_reported(session):
    session.add(DataCapture(
        id=new_uuid(), source="hockey-vanger", capture_type="clubs_list", external_id="clubs_list_99",
        session_id="s1", payload="{}", meta="{}", captured_at=datetime.utcnow(),
    ))
    session.commit()

    result = get_scan_calendar(session=session, _=None)

    assert len(result["club_captures"]) == 1
    assert result["club_captures"][0]["cmd_type"] == "get_clubs"


def test_scheduled_cmds_reports_a_pending_get_poule_cmd(session):
    from models.hockey_discovery import VangerCmd

    _setup_poule(session, poule_id=7, competition_id=7, team_id=700)
    session.add(VangerCmd(
        cmd_type="get_poule", params=json.dumps({"poule_id": 7, "team_id": 700}), status="pending",
    ))
    session.commit()

    result = get_scan_calendar(session=session, _=None)

    assert any(c["poule_id"] == 7 and c["status"] == "pending" for c in result["scheduled_cmds"])


def test_scheduled_cmds_reports_a_get_competition_detail_cmd_for_all_its_poules(session):
    from models.hockey_discovery import VangerCmd

    comp, poule = _setup_poule(session, poule_id=8, competition_id=8, team_id=800)
    comp.hl_comp_id = 22
    session.add(comp)
    session.add(VangerCmd(
        cmd_type="get_competition_detail", params=json.dumps({"comp_id": 22, "label": "Test"}), status="pending",
    ))
    session.commit()

    result = get_scan_calendar(session=session, _=None)

    assert any(c["poule_id"] == 8 for c in result["scheduled_cmds"])


def test_manual_profile_poule_is_reported_with_its_assigned_weekday(session):
    """item 1009 (Bart, 31-08-2026): het schedule-endpoint leunt sinds de
    Fase C-cutover op ScanScheduleEntry (het ECHTE, gefilterde scanschema)
    i.p.v. een losse, ongefilterde manual_poules-telling - vandaar de
    rebuild_schedule-aanroep hier. Een overduidelijk verleden, nog niet
    finale wedstrijd maakt de poule "ongezond" (_is_healthy), zodat de
    manual_weekly-entry ontstaat ongeacht het tijdstip waarop de test draait."""
    from services.hockey_vanger_schedule import rebuild_schedule

    comp, poule = _setup_poule(session, poule_id=11, competition_id=11, team_id=1100, published=False)
    session.add(HockeyPublicationComp(publication_id="pub-manual", competition_id=comp.id, scan_profile="manual"))
    now = datetime.utcnow()
    session.add(HockeyPouleMatch(
        poule_id=11, match_id=112, home_team_id=1100, away_team_id=1101,
        home_team_name="Home", away_team_name="Away",
        match_date=(now - timedelta(days=2)).strftime("%Y-%m-%dT12:00:00+00:00"), status="scheduled",
    ))
    session.commit()

    rebuild_schedule(session, now, 14)
    result = get_scan_calendar(session=session, _=None)

    entry = next(
        (e for e in result["schedule_entries"]
         if e["target_type"] == "poule" and e["target_id"] == 11 and e["reason"] == "manual_weekly"),
        None,
    )
    assert entry is not None
    assert entry["competition_name"] == comp.name


def test_manual_profile_poule_also_appears_in_the_main_poules_list_with_its_real_matches(session):
    """Week/Maand-view moeten het ECHTE aantal wedstrijden tonen - dus ook
    manual-profile poules met hun matches, niet alleen de active-profile
    poules (anders lijkt de kalender bijna leeg terwijl er wel wedstrijden
    gepland staan)."""
    comp, poule = _setup_poule(session, poule_id=13, competition_id=13, team_id=1300, published=False)
    session.add(HockeyPublicationComp(publication_id="pub-manual", competition_id=comp.id, scan_profile="manual"))
    session.commit()

    result = get_scan_calendar(session=session, _=None)

    entry = next((p for p in result["poules"] if p["poule_id"] == 13), None)
    assert entry is not None
    assert entry["scan_profile"] == "manual"
    assert len(entry["matches"]) == 1


def test_active_profile_poule_is_tagged_with_its_scan_profile(session):
    _setup_poule(session, poule_id=14, competition_id=14, team_id=1400)

    result = get_scan_calendar(session=session, _=None)

    entry = next(p for p in result["poules"] if p["poule_id"] == 14)
    assert entry["scan_profile"] == "active"


def test_two_competitions_with_the_same_name_are_reported_with_different_competition_ids(session):
    """Regressie: DagView groepeerde regelmatige poules eerst op
    competition_name, maar meerdere losse competities (verschillende
    klasses/seizoenen) delen vaak dezelfde generieke naam - de front-end
    moet op competition_id kunnen groeperen om ze niet op 1 hoop te gooien."""
    _setup_poule(session, poule_id=15, competition_id=15, team_id=1500)
    comp16, _poule16 = _setup_poule(session, poule_id=16, competition_id=16, team_id=1600)
    comp16.name = "Comp 15"  # zelfde naam als competitie 15, maar een andere rij
    session.add(comp16)
    session.commit()

    result = get_scan_calendar(session=session, _=None)

    p15 = next(p for p in result["poules"] if p["poule_id"] == 15)
    p16 = next(p for p in result["poules"] if p["poule_id"] == 16)
    assert p15["competition_name"] == p16["competition_name"]
    assert p15["competition_id"] != p16["competition_id"]


def test_manual_profile_poule_with_hl_comp_id_is_excluded(session):
    from services.hockey_vanger_schedule import rebuild_schedule

    comp, poule = _setup_poule(session, poule_id=12, competition_id=12, team_id=1200, published=False)
    comp.hl_comp_id = 33
    session.add(comp)
    session.add(HockeyPublicationComp(publication_id="pub-manual", competition_id=comp.id, scan_profile="manual"))
    now = datetime.utcnow()
    session.commit()

    rebuild_schedule(session, now, 14)
    result = get_scan_calendar(session=session, _=None)

    assert not any(
        e["target_type"] == "poule" and e["target_id"] == 12 and e["reason"] == "manual_weekly"
        for e in result["schedule_entries"]
    )


def test_scheduled_cmds_marks_a_pending_cmd_as_not_executed(session):
    from models.hockey_discovery import VangerCmd

    _setup_poule(session, poule_id=9, competition_id=9, team_id=900)
    session.add(VangerCmd(
        cmd_type="get_poule", params=json.dumps({"poule_id": 9, "team_id": 900}), status="pending",
    ))
    session.commit()

    result = get_scan_calendar(session=session, _=None)

    entry = next(c for c in result["scheduled_cmds"] if c["poule_id"] == 9)
    assert entry["executed"] is False


def test_scheduled_cmds_finds_a_done_cmd_via_finished_at_even_if_created_far_outside_range(session):
    """Een cmd kan lang geleden zijn aangemaakt (created_at) maar pas kortgeleden
    zijn uitgevoerd (finished_at) - filteren op created_at alleen zou de 'echt
    uitgevoerd'-marker op oudere dagen laten verdwijnen zodra je terugbladert."""
    from models.hockey_discovery import VangerCmd

    _setup_poule(session, poule_id=10, competition_id=10, team_id=1000)
    now = datetime.utcnow()
    session.add(VangerCmd(
        cmd_type="get_poule", params=json.dumps({"poule_id": 10, "team_id": 1000}), status="done",
        created_at=now - timedelta(days=60), finished_at=now - timedelta(hours=1),
    ))
    session.commit()

    result = get_scan_calendar(session=session, _=None)  # default bereik: nu +/- 45 dagen

    entry = next((c for c in result["scheduled_cmds"] if c["poule_id"] == 10), None)
    assert entry is not None
    assert entry["executed"] is True
    assert entry["event_at"] == (now - timedelta(hours=1)).isoformat() + "Z"


def test_schedule_entries_within_range_are_reported(session):
    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=444, cmd_type="get_poule",
        params=json.dumps({"poule_id": 444, "team_id": 9}),
        planned_at=now + timedelta(hours=3), reason="matchday_burst",
    ))
    session.commit()

    result = get_scan_calendar(session=session, _=None)

    entry = next((e for e in result["schedule_entries"] if e["target_id"] == 444), None)
    assert entry is not None
    assert entry["reason"] == "matchday_burst"
    assert entry["status"] == "planned"


def test_schedule_entries_outside_range_are_excluded(session):
    now = datetime.utcnow()
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=555, cmd_type="get_poule",
        params=json.dumps({"poule_id": 555, "team_id": 9}),
        planned_at=now + timedelta(days=60), reason="daily_fallback",
    ))
    session.commit()

    result = get_scan_calendar(session=session, _=None)  # default bereik: nu +/- 45 dagen

    assert not any(e["target_id"] == 555 for e in result["schedule_entries"])
