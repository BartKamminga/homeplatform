"""Tests voor het scan-calendar-endpoint (items 1009/1011/1012) - de nieuwe
Kalender-tab in hockey-inside leunt hier volledig op."""

import json
from datetime import datetime, timedelta

from models.capture import DataCapture, new_uuid
from models.hockey import HockeyPublicationComp
from models.hockey_discovery import HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyTeam
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
