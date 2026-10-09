"""Item 1254: volglijst 'wacht op nieuwe fase' / 'wacht op zaal-indeling'."""

import json
from datetime import datetime, timedelta
from unittest.mock import patch

from sqlmodel import select

from models.hockey import HockeyPublication, HockeyPublicationComp
from models.hockey_discovery import (
    HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyPouleStanding, HockeyTeam,
    ScanScheduleEntry, VangerCmd,
)
from models.settings import AppSetting
from services.hockey_phase_watch import (
    notify_phase_watch, phase_watch_events, scope_status, set_watch, watched_scopes,
)
from services.hockey_vanger_schedule import promote_due_schedule_entries

NOW = datetime(2026, 10, 9, 10, 0)


def _setup(session, *, comp_name="Landelijk Meisjes O18", hl_comp_id=20, match_date="2026-10-03T12:00:00+02:00"):
    session.add(HockeyPublication(id="pub", name="O18"))
    comp = HockeyCompetition(
        external_id=comp_name + "|Landelijke Topklasse|Landelijk|2026-2027", name=comp_name,
        class_name="Landelijke Topklasse", district="Landelijk", hockey_type="VE", season="2026-2027",
        hl_comp_id=hl_comp_id,
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPoule(
        poule_id=100, name="Poule A", competition_id=comp.id, season="2026-2027",
        discovered_at=NOW - timedelta(days=40), last_scanned_at=NOW - timedelta(days=4),
    ))
    session.add(HockeyPouleMatch(poule_id=100, match_id=1, match_date=match_date, status="final"))
    for club_id, team_id, name in (("HH01", 1, "HIC MO18-1"), ("HH02", 2, "Kampong MO18-1")):
        session.add(HockeyClub(external_id=club_id, name=club_id, friendly_name=club_id))
        session.add(HockeyTeam(
            team_id=team_id, club_external_id=club_id, name=name, short_name=name.split(" ")[-1],
            hockey_type="VE", category_group_name="Junioren", recent_poule_id=100, no_new_poule_confirmed=True,
        ))
        session.add(HockeyPouleStanding(poule_id=100, team_id=team_id, team_name=name))
    link = HockeyPublicationComp(id="lnk", publication_id="pub", competition_id=comp.id, scan_profile="active")
    session.add(link)
    session.commit()
    return comp, link


def test_no_events_without_a_watched_competition(session):
    _setup(session)
    assert phase_watch_events(session, NOW) == []


def test_next_phase_plans_a_competition_detail_and_club_scans(session):
    comp, link = _setup(session)
    set_watch(session, link, "next_phase", True, NOW)
    session.commit()

    events = phase_watch_events(session, NOW)

    kinds = sorted((e["cmd_type"], e["reason"]) for e in events)
    assert kinds == [
        ("get_competition_detail", "phase_watch"), ("scan_club", "phase_watch"), ("scan_club", "phase_watch"),
    ]
    detail = next(e for e in events if e["cmd_type"] == "get_competition_detail")
    assert json.loads(detail["params"])["comp_id"] == 20


def test_set_watch_unparks_the_teams_of_the_competition(session):
    _, link = _setup(session)
    set_watch(session, link, "next_phase", True, NOW)
    session.commit()

    assert all(not t.no_new_poule_confirmed for t in session.exec(select(HockeyTeam)).all())


def test_next_phase_waits_while_the_current_phase_still_has_matches(session):
    _, link = _setup(session, match_date="2026-10-20T12:00:00+02:00")
    set_watch(session, link, "next_phase", True, NOW)
    session.commit()

    assert phase_watch_events(session, NOW) == []


def test_recently_scanned_clubs_are_skipped(session):
    _, link = _setup(session)
    set_watch(session, link, "next_phase", True, NOW)
    for club in session.exec(select(HockeyClub)).all():
        club.last_scanned_at = NOW - timedelta(hours=2)
        session.add(club)
    session.commit()

    assert [e["cmd_type"] for e in phase_watch_events(session, NOW)] == ["get_competition_detail"]


def test_a_new_poule_from_a_club_scan_is_queued(session):
    _, link = _setup(session, hl_comp_id=None)
    set_watch(session, link, "next_phase", True, NOW)
    team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == 1)).one()
    team.recent_poule_id = 200
    session.add(team)
    session.commit()

    events = [e for e in phase_watch_events(session, NOW) if e["cmd_type"] == "get_poule"]

    assert [json.loads(e["params"])["poule_id"] for e in events] == [200]


def test_zaal_watch_picks_the_zaal_teams_of_the_same_age_and_gender(session):
    _, link = _setup(session)
    session.add(HockeyTeam(
        team_id=11, club_external_id="HH01", name="HIC zMO18-1", short_name="zMO18-1",
        hockey_type="ZA", category_group_name="Junioren", recent_poule_id=300,
    ))
    session.add(HockeyTeam(
        team_id=12, club_external_id="HH01", name="HIC zJO18-1", short_name="zJO18-1",
        hockey_type="ZA", category_group_name="Junioren", recent_poule_id=301,
    ))
    set_watch(session, link, "zaal", True, NOW)
    session.commit()

    poule_events = [json.loads(e["params"])["poule_id"] for e in phase_watch_events(session, NOW) if e["cmd_type"] == "get_poule"]

    assert poule_events == [300]


def test_phase_watch_get_poule_passes_the_queue_filter_before_the_zaal_phase(session):
    session.add(AppSetting(key="disc_queue_hockey_type", value="VE"))
    session.add(HockeyTeam(
        team_id=11, club_external_id="HH01", name="HIC zMO18-1", short_name="zMO18-1",
        hockey_type="ZA", category_group_name="Junioren", recent_poule_id=300,
    ))
    session.add(ScanScheduleEntry(
        target_type="poule", target_id=300, cmd_type="get_poule",
        params=json.dumps({"poule_id": 300, "team_id": 11, "label": "HIC zMO18-1"}),
        planned_at=NOW - timedelta(minutes=1), reason="phase_watch",
    ))
    session.commit()

    promote_due_schedule_entries(session, NOW)

    cmd = session.exec(select(VangerCmd).where(VangerCmd.cmd_type == "get_poule")).one()
    assert cmd.reason == "phase_watch"


def test_status_and_push_once_new_poules_are_captured(session):
    _, link = _setup(session, hl_comp_id=None)
    set_watch(session, link, "next_phase", True, NOW)
    other = HockeyCompetition(
        external_id="Meisjes O18 Herfst|Landelijke Subtopklasse|Landelijk|2026-2027", name="Meisjes O18 Herfst",
        class_name="Landelijke Subtopklasse", district="Landelijk", hockey_type="VE", season="2026-2027",
    )
    session.add(other)
    session.commit()
    session.refresh(other)
    session.add(HockeyPoule(poule_id=200, name="Poule B", competition_id=other.id, season="2026-2027"))
    team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == 1)).one()
    team.recent_poule_id = 200
    session.add(team)
    session.commit()

    status = scope_status(session, watched_scopes(session)[0], NOW)
    assert (status["teams_total"], status["teams_captured"]) == (2, 1)
    assert status["found_competitions"][0]["name"] == "Meisjes O18 Herfst"
    assert status["found_competitions"][0]["linked"] is False

    with patch("services.push.send_push", return_value=1) as push:
        assert notify_phase_watch(session, NOW) == 1
    assert "Meisjes O18 Herfst" in push.call_args.kwargs["body"]
    session.refresh(link)
    assert link.watch_notified == 1
    assert link.watch_next_phase_since is not None


def test_watch_switches_itself_off_when_all_teams_have_a_new_poule(session):
    _, link = _setup(session, hl_comp_id=None)
    set_watch(session, link, "next_phase", True, NOW)
    session.add(HockeyPoule(poule_id=200, name="Poule B", competition_id=999, season="2026-2027"))
    for team in session.exec(select(HockeyTeam)).all():
        team.recent_poule_id = 200
        session.add(team)
    session.commit()

    with patch("services.push.send_push", return_value=1):
        notify_phase_watch(session, NOW)

    session.refresh(link)
    assert link.watch_next_phase_since is None


def test_toggle_endpoint_and_status_list(client, admin_token, session):
    _setup(session)
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.put("/api/hockey/publications/pub/competitions/lnk/watch", json={"kind": "zaal", "on": True}, headers=headers)
    assert res.status_code == 200
    assert res.json() == {"watch_next_phase": False, "watch_zaal": True}

    rows = client.get("/api/hockey/vanger/phase-watch", headers=headers).json()
    assert [(r["kind"], r["competition_name"]) for r in rows] == [("zaal", "Landelijk Meisjes O18")]

    links = client.get("/api/hockey/publications/pub/competitions", headers=headers).json()
    assert links[0]["watch_zaal"] is True and links[0]["phase_done"] is True
