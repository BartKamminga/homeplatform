"""Karakteriseringstests voor _smart_scan_discovery_next
(services/hockey_vanger_smartscan.py) - refactor-plan hockey-inside Fase 1
(RFTR-B1). Twee beslisbomen in een functie, voorheen nul dekking."""

from datetime import datetime, timedelta

from sqlmodel import select

from models.hockey_discovery import HockeyClub, HockeyTeam, VangerCmd
from services.hockey_vanger_smartscan import SMART_SCAN_MAX_CMDS, _smart_scan_discovery_next


def _team(**kw):
    defaults = dict(
        club_external_id="HH11XX0", hockey_type="VE", category_group_name="Junioren",
        no_new_poule_confirmed=False, season_pending=False,
    )
    defaults.update(kw)
    return HockeyTeam(**defaults)


def test_returns_max_cmds_when_cmd_count_reached(session):
    started = datetime.utcnow()
    result = _smart_scan_discovery_next(session, started, SMART_SCAN_MAX_CMDS)
    assert result == {"added": 0, "reason": "max_cmds"}


def test_queues_poules_for_teams_of_a_club_scanned_this_session(session):
    started = datetime.utcnow() - timedelta(minutes=5)
    session.add(HockeyClub(
        external_id="HH11XX0", name="Club X", friendly_name="Club X",
        last_scanned_at=started + timedelta(minutes=1),
    ))
    session.add(_team(team_id=1, name="Team A", short_name="JO16-1", recent_poule_id=100))
    session.commit()

    result = _smart_scan_discovery_next(session, started, 0)

    assert result["added"] == 1
    assert result["type"] == "get_poule"
    cmd = session.exec(select_all_cmds(session)).first()
    assert cmd.cmd_type == "get_poule"


def test_falls_back_to_club_priority_when_no_recently_scanned_club_has_pending_teams(session):
    started = datetime.utcnow()
    session.add(_team(team_id=1, name="A1", short_name="JO16-1", club_external_id="CLUB_A"))
    session.add(_team(team_id=2, name="B1", short_name="JO16-1", club_external_id="CLUB_B"))
    session.add(_team(team_id=3, name="B2", short_name="JO16-2", club_external_id="CLUB_B"))
    session.commit()

    result = _smart_scan_discovery_next(session, started, 0)

    assert result["added"] == 1
    assert result["type"] == "scan_club"
    assert result["club"] == "CLUB_B"  # meeste wachtende teams (2)
    assert result["pending_teams"] == 2


def test_returns_idle_when_no_candidates_at_all(session):
    started = datetime.utcnow()
    result = _smart_scan_discovery_next(session, started, 0)
    assert result == {"added": 0, "reason": "idle"}


def test_skips_a_club_priority_pick_that_is_already_queued(session):
    started = datetime.utcnow()
    session.add(_team(team_id=1, name="A1", short_name="JO16-1", club_external_id="CLUB_A"))
    session.add(VangerCmd(cmd_type="scan_club", params='{"external_id": "CLUB_A"}', status="pending"))
    session.commit()

    result = _smart_scan_discovery_next(session, started, 0)
    assert result == {"added": 0, "reason": "already_queued"}


def select_all_cmds(session):
    from sqlmodel import select
    return select(VangerCmd)
