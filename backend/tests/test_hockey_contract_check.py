"""Item 1257: dagelijkse contract-check hockey.nl (vorm van de antwoorden)."""

import json
from datetime import datetime, timedelta

import pytest
from sqlmodel import select

from models.hockey_discovery import HockeyClub, HockeyCompetition, HockeyPoule, HockeyTeam, VangerCmd
from routers.hockey_vanger_cmd_queue import CmdResultIn, post_cmd_result
from services import hockey_contract_check as cc

NOW = datetime(2026, 10, 11, 12, 0)
POULE = {"data": {"data": {"poules": [{"competition": {"name": "X", "district_name": "Zuid"},
                                       "standings": [{"team": {"id": 1, "name": "A"}, "points": 3}],
                                       "matches": [{"id": 9, "home_score": 2, "date": "2026-10-01"}]}]}}}


@pytest.fixture
def alerts(monkeypatch):
    sent = []
    monkeypatch.setattr(cc, "send_push", lambda **kw: sent.append(kw) or 1)
    return sent


@pytest.fixture
def targets(session):
    state = cc.load_state(session)
    state["targets"] = {"get_poule": {"poule_id": 100, "team_id": 1, "label": "Poule", "since": NOW.isoformat()}}
    cc.save_state(session, state)


# ── vorm vergelijken ──────────────────────────────────────────────────────────

def test_shape_ignores_values_and_merges_list_items():
    a = cc.shape_of({"x": [{"id": 1}, {"id": 2, "name": "b"}], "n": 3})
    b = cc.shape_of({"x": [{"id": 7, "name": "z"}], "n": 9})
    assert a == b
    assert a["$.x[].id"] == ["number"]


def test_compare_flags_removed_and_type_changes_only():
    base = cc.shape_of(POULE)
    changed = json.loads(json.dumps(POULE))
    poule = changed["data"]["data"]["poules"][0]
    del poule["competition"]["district_name"]
    poule["matches"][0]["id"] = "9"          # nummer -> string (zoals de comp-id-breuk, #1177)
    poule["extra"] = True                    # nieuw veld = alleen info
    diff = cc.compare_shapes(base, cc.shape_of(changed))
    assert diff["removed"] == ["$.data.data.poules[].competition.district_name"]
    assert diff["changed"] == ["$.data.data.poules[].matches[].id: number -> string"]
    assert diff["added"] == ["$.data.data.poules[].extra"]


def test_compare_tolerates_null_and_empty_lists():
    base = cc.shape_of(POULE)
    quiet = json.loads(json.dumps(POULE))
    quiet["data"]["data"]["poules"][0]["matches"] = []          # nog geen wedstrijden
    quiet["data"]["data"]["poules"][0]["matches_extra"] = None
    quiet["data"]["data"]["poules"][0]["competition"]["district_name"] = None
    diff = cc.compare_shapes(base, cc.shape_of(quiet))
    assert diff["removed"] == [] and diff["changed"] == []


# ── flow per resultaat ────────────────────────────────────────────────────────

def test_baseline_then_ok_then_breach_alerts_once_then_accept(session, targets, alerts):
    params = {"poule_id": 100, "team_id": 1}
    assert cc.on_cmd_result(session, "get_poule", params, POULE, False, NOW) == "baseline_set"
    assert cc.on_cmd_result(session, "get_poule", params, POULE, False, NOW) == "ok"
    broken = {"data": {"data": {"poule": {}}}}
    assert cc.on_cmd_result(session, "get_poule", params, broken, False, NOW) == "breach"
    assert cc.on_cmd_result(session, "get_poule", params, broken, False, NOW) == "breach"
    assert len(alerts) == 1 and "shape changed" in alerts[0]["title"]

    assert cc.accept_current_shape(session) == ["get_poule"]
    assert cc.on_cmd_result(session, "get_poule", params, broken, False, NOW) == "ok"


def test_other_targets_are_not_compared(session, targets, alerts):
    assert cc.on_cmd_result(session, "get_poule", {"poule_id": 999}, POULE, False, NOW) is None
    assert alerts == []


def test_parse_failed_alerts_for_any_cmd_throttled(session, alerts):
    for minutes in (0, 10, 400):
        cc.on_cmd_result(session, "scan_club", {"external_id": "X", "label": "Club X"}, {}, True,
                         NOW + timedelta(minutes=minutes))
    assert len(alerts) == 2 and "could not be read" in alerts[0]["title"]


# ── dagelijkse run ────────────────────────────────────────────────────────────

def _discovery_data(session):
    season = "2026-2027"
    regional = HockeyCompetition(external_id="r", name="Regio MO14", class_name="District", season=season)
    national = HockeyCompetition(external_id="n", name="Landelijk MO14", class_name="Landelijk", season=season,
                                 hl_comp_id=22)
    session.add_all([regional, national,
                     HockeyClub(external_id="ABC", name="Andere club", friendly_name="Andere", last_scanned_at=NOW),
                     HockeyClub(external_id="VIC", name="Victoria", friendly_name="Victoria",
                                last_scanned_at=NOW - timedelta(days=3))])
    session.commit()
    session.add_all([
        HockeyPoule(poule_id=100, name="Poule A", competition_id=regional.id, season=season, last_scanned_at=NOW),
        HockeyPoule(poule_id=200, name="Poule L", competition_id=national.id, season=season, last_scanned_at=NOW),
        HockeyTeam(team_id=1, club_external_id="VIC", name="Victoria MO14-1", short_name="MO14-1",
                   hockey_type="VE", category_group_name="Junioren", recent_poule_id=100),
    ])
    session.commit()


def test_daily_run_picks_fixed_targets_and_queues_three_cmds(session, alerts, monkeypatch):
    monkeypatch.setattr(cc, "get_target_season", lambda s: "2026-2027")
    _discovery_data(session)
    assert cc.maybe_run_contract_check(session, NOW) == 3
    state = cc.load_state(session)
    assert state["targets"]["get_poule"]["poule_id"] == 100          # regionaal, niet de landelijke 200
    assert state["targets"]["get_competition_detail"]["comp_id"] == 22
    assert state["targets"]["scan_club"]["external_id"] == "VIC"
    reasons = {c.reason for c in session.exec(select(VangerCmd)).all()}
    assert reasons == {"contract_check"}
    assert cc.maybe_run_contract_check(session, NOW + timedelta(hours=1)) == 0     # 24-uursdrempel

    # 2 dagen later zonder enig resultaat: melding dat de check niet draaide
    cc.maybe_run_contract_check(session, NOW + timedelta(hours=48))
    assert any("did not run" in a["title"] for a in alerts)


# ── via het echte resultaat-endpoint ──────────────────────────────────────────

def test_post_cmd_result_reports_parse_failed(session, alerts):
    cmd = VangerCmd(cmd_type="get_clubs", params=json.dumps({"label": "Alle clubs"}), status="in_progress",
                    started_at=NOW)
    session.add(cmd)
    session.commit()
    result = post_cmd_result(cmd_id=cmd.id, body=CmdResultIn(raw={"onverwacht": 1}), session=session, _=None)
    assert result["status"] == "done"
    assert len(alerts) == 1 and "get_clubs" in alerts[0]["body"]
