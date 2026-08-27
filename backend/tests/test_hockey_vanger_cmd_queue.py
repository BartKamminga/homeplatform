"""Karakteriseringstests voor fill_cmd_queue (routers/hockey_vanger.py) -
refactor-plan hockey-inside Fase 1 (RFTR-B1). hockey_vanger.py had voor deze
tests nul dekking op zijn grootste/meest vermengde functies; deze tests
leggen het huidige gedrag van de 3 deelworkflows vast (poules / clubs /
poules_refresh) zodat Fase 2/3 (dedup + opsplitsen) veilig kunnen."""

import json
from datetime import datetime, timedelta

from sqlmodel import select

from models.hockey_discovery import HockeyClub, HockeyPoule, HockeyTeam, VangerCmd
from routers.hockey_vanger_cmd_queue import CmdFillIn, fill_cmd_queue


def _team(**kw):
    defaults = dict(
        club_external_id="HH11XX0", hockey_type="VE", category_group_name="Junioren",
        no_new_poule_confirmed=False, season_pending=False,
    )
    defaults.update(kw)
    return HockeyTeam(**defaults)


# ── type=poules ───────────────────────────────────────────

def test_fill_poules_queues_a_team_with_an_uncaptured_recent_poule(session):
    session.add(_team(team_id=1, name="Team A", short_name="JO16-1", recent_poule_id=100))
    session.commit()

    result = fill_cmd_queue(CmdFillIn(type="poules"), session=session, _=None)

    assert result["added"] == 1
    cmd = session.exec(select(VangerCmd)).first()
    assert cmd.cmd_type == "get_poule"
    assert json.loads(cmd.params)["poule_id"] == 100


def test_fill_poules_skips_already_captured_poule_for_target_season(session):
    session.add(HockeyPoule(poule_id=100, name="Poule A", competition_id=1, season="2026-2027"))
    session.add(_team(team_id=1, name="Team A", short_name="JO16-1", recent_poule_id=100))
    session.commit()

    result = fill_cmd_queue(CmdFillIn(type="poules"), session=session, _=None)
    assert result["added"] == 0


def test_fill_poules_skips_scoreless_youth_and_pending_teams(session):
    session.add(_team(team_id=1, name="Jong Team", short_name="JO8-1", recent_poule_id=101))  # O7-O10: scoreless
    session.add(_team(team_id=2, name="Pending Team", short_name="JO16-2", recent_poule_id=102, season_pending=True))
    session.add(_team(team_id=3, name="Confirmed-none Team", short_name="JO16-3", recent_poule_id=103, no_new_poule_confirmed=True))
    session.commit()

    result = fill_cmd_queue(CmdFillIn(type="poules"), session=session, _=None)
    assert result["added"] == 0
    assert result["stale_skip"] == 1  # alleen de season_pending-poule telt als "stale_skip"


def test_fill_poules_does_not_duplicate_an_already_pending_cmd(session):
    session.add(_team(team_id=1, name="Team A", short_name="JO16-1", recent_poule_id=100))
    session.add(VangerCmd(cmd_type="get_poule", params=json.dumps({"poule_id": 100}), status="pending"))
    session.commit()

    result = fill_cmd_queue(CmdFillIn(type="poules"), session=session, _=None)
    assert result["added"] == 0


# ── type=clubs ────────────────────────────────────────────

def test_fill_clubs_queues_clubs_with_pending_teams_sorted_by_count_desc(session):
    session.add(_team(team_id=1, name="A1", short_name="JO16-1", club_external_id="CLUB_A", season_pending=True))
    session.add(_team(team_id=2, name="B1", short_name="JO16-1", club_external_id="CLUB_B", season_pending=True))
    session.add(_team(team_id=3, name="B2", short_name="JO16-2", club_external_id="CLUB_B", season_pending=True))
    session.commit()

    result = fill_cmd_queue(CmdFillIn(type="clubs"), session=session, _=None)

    assert result["added"] == 2
    cmds = session.exec(select(VangerCmd).order_by(VangerCmd.id)).all()
    first_params = json.loads(cmds[0].params)
    assert first_params["external_id"] == "CLUB_B"  # meeste wachtende teams (2) eerst
    assert first_params["pending_teams"] == 2


def test_fill_clubs_includes_unscanned_clubs_with_zero_pending_teams(session):
    session.add(HockeyClub(external_id="CLUB_C", name="Club C", friendly_name="Club C", detail_loaded=False))
    session.commit()

    result = fill_cmd_queue(CmdFillIn(type="clubs"), session=session, _=None)
    assert result["added"] == 1
    params = json.loads(session.exec(select(VangerCmd)).first().params)
    assert params["external_id"] == "CLUB_C"
    assert params["pending_teams"] == 0


# ── type=poules_refresh ───────────────────────────────────

def test_fill_poules_refresh_requeues_stale_poule_past_cutoff(session):
    now = datetime.utcnow()
    poule = HockeyPoule(
        poule_id=200, name="Poule Oud", competition_id=1, season="2026-2027",
        last_scanned_at=now - timedelta(days=10),
    )
    session.add(poule)
    session.add(_team(team_id=1, name="Team A", short_name="JO16-1", recent_poule_id=200))
    session.commit()

    result = fill_cmd_queue(CmdFillIn(type="poules_refresh", max_age_days=7), session=session, _=None)
    assert result["added"] == 1


def test_fill_poules_refresh_skips_recently_scanned_poule(session):
    now = datetime.utcnow()
    poule = HockeyPoule(
        poule_id=201, name="Poule Vers", competition_id=1, season="2026-2027",
        last_scanned_at=now - timedelta(days=1),
    )
    session.add(poule)
    session.add(_team(team_id=1, name="Team A", short_name="JO16-1", recent_poule_id=201))
    session.commit()

    result = fill_cmd_queue(CmdFillIn(type="poules_refresh", max_age_days=7), session=session, _=None)
    assert result["added"] == 0


def test_fill_poules_refresh_skips_poule_without_a_linked_team(session):
    session.add(HockeyPoule(poule_id=202, name="Poule Zonder Team", competition_id=1, season="2026-2027"))
    session.commit()

    result = fill_cmd_queue(CmdFillIn(type="poules_refresh"), session=session, _=None)
    assert result["added"] == 0
