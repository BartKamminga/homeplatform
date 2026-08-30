"""Karakteriseringstests voor post_cmd_result (routers/hockey_vanger.py) -
refactor-plan hockey-inside Fase 1 (RFTR-B1). Nul dekking voor deze fix,
ondanks dat het de centrale ontvangst-functie is voor alle Ghost/Scout-
scanresultaten (5 cmd_type-dispatch-paden + archivering + foutafhandeling)."""

import json

import pytest
from fastapi import HTTPException
from sqlmodel import select

from models.capture import DataCapture
from models.hockey_discovery import HockeyTeam, ScanHistoryDaily, VangerCmd
from routers.hockey_vanger_cmd_queue import CmdResultIn, post_cmd_result


def _pending_cmd(cmd_type, params, **kw):
    cmd = VangerCmd(cmd_type=cmd_type, params=json.dumps(params), status="pending", **kw)
    return cmd


def test_error_result_marks_cmd_failed(session):
    cmd = _pending_cmd("get_poule", {"poule_id": 1})
    session.add(cmd)
    session.commit()
    session.refresh(cmd)

    result = post_cmd_result(cmd.id, CmdResultIn(error="timeout"), session=session, _=None)

    assert result == {"ok": True, "status": "failed"}
    session.refresh(cmd)
    assert cmd.status == "failed"
    assert cmd.error == "timeout"


def test_missing_raw_without_error_marks_cmd_skipped_and_confirms_no_new_poule(session):
    session.add(HockeyTeam(
        team_id=1, club_external_id="HH11XX0", name="Team A", short_name="JO16-1",
        hockey_type="VE", category_group_name="Junioren", recent_poule_id=42,
    ))
    cmd = _pending_cmd("get_poule", {"poule_id": 42})
    session.add(cmd)
    session.commit()
    session.refresh(cmd)

    result = post_cmd_result(cmd.id, CmdResultIn(raw=None), session=session, _=None)

    assert result["status"] == "skipped"
    team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == 1)).first()
    assert team.no_new_poule_confirmed is True


def test_error_result_records_a_failed_scan_history_entry(session):
    cmd = _pending_cmd("get_poule", {"poule_id": 1}, reason="daily_fallback")
    session.add(cmd)
    session.commit()
    session.refresh(cmd)

    post_cmd_result(cmd.id, CmdResultIn(error="timeout"), session=session, _=None)

    row = session.exec(select(ScanHistoryDaily)).first()
    assert row.reason == "daily_fallback"
    assert row.outcome == "failed"
    assert row.count == 1


def test_unknown_cmd_id_raises_404(session):
    with pytest.raises(HTTPException) as exc:
        post_cmd_result(999999, CmdResultIn(raw={}), session=session, _=None)
    assert exc.value.status_code == 404


def test_get_poule_result_captures_data_and_archives_it(session):
    raw = {"data": {"data": {"poule": {
        "id": 100, "name": "Poule A",
        "competition": {"name": "Test Comp", "subcompetition": {"class": "1e klasse"}},
        "standings": [],
        "matches": [{"id": 1, "date": "2026-03-07T09:00:00+01:00", "status": "final",
                     "home": {"id": 1, "name": "Team A"}, "away": {"id": 2, "name": "Team B"},
                     "score": {"home": 2, "away": 1}}],
    }}}}
    cmd = _pending_cmd("get_poule", {"poule_id": 100, "team_id": 1, "label": "Team A"})
    session.add(cmd)
    session.commit()
    session.refresh(cmd)

    result = post_cmd_result(cmd.id, CmdResultIn(raw=raw, session_id="sess1"), session=session, _=None)

    assert result == {"ok": True, "status": "done", "label": "Team A"}
    session.refresh(cmd)
    assert cmd.status == "done"
    summary = json.loads(cmd.result_summary)
    assert summary["matches_played"] == 1  # status="final" telt mee (roadmap: was "finished", fout)

    capture = session.exec(select(DataCapture).where(DataCapture.external_id == "poule_capture_100")).first()
    assert capture is not None
    assert json.loads(capture.meta)["competition"] == "Test Comp"


def test_get_poule_result_records_a_successful_scan_history_entry(session):
    raw = {"data": {"data": {"poule": {
        "id": 102, "name": "Poule C",
        "competition": {"name": "Test Comp 3", "subcompetition": {"class": "1e klasse"}},
        "standings": [], "matches": [],
    }}}}
    cmd = _pending_cmd("get_poule", {"poule_id": 102, "team_id": 1, "label": "Team A"}, reason="matchday_burst")
    session.add(cmd)
    session.commit()
    session.refresh(cmd)

    post_cmd_result(cmd.id, CmdResultIn(raw=raw, session_id="sess-history"), session=session, _=None)

    row = session.exec(select(ScanHistoryDaily)).first()
    assert row.reason == "matchday_burst"
    assert row.outcome == "success"
    assert row.count == 1


def test_get_poule_result_does_not_duplicate_archive_for_same_session(session):
    raw = {"data": {"data": {"poule": {
        "id": 101, "name": "Poule B",
        "competition": {"name": "Test Comp 2", "subcompetition": {"class": "1e klasse"}},
        "standings": [], "matches": [],
    }}}}
    cmd1 = _pending_cmd("get_poule", {"poule_id": 101, "team_id": 1, "label": "Team A"})
    session.add(cmd1)
    session.commit()
    session.refresh(cmd1)
    post_cmd_result(cmd1.id, CmdResultIn(raw=raw, session_id="sess-dup"), session=session, _=None)

    cmd2 = _pending_cmd("get_poule", {"poule_id": 101, "team_id": 1, "label": "Team A"})
    session.add(cmd2)
    session.commit()
    session.refresh(cmd2)
    post_cmd_result(cmd2.id, CmdResultIn(raw=raw, session_id="sess-dup"), session=session, _=None)

    captures = session.exec(select(DataCapture).where(DataCapture.external_id == "poule_capture_101")).all()
    assert len(captures) == 1


def test_malformed_raw_marks_cmd_failed_via_exception_path(session):
    # get_competition_detail met een niet-dict item in poules laat
    # _call_competition_detail crashen (AttributeError op poule_data.get(...),
    # buiten het try/except dat alleen de initiele raw-vorm afvangt) - de
    # except-tak in post_cmd_result moet dit netjes als "failed" afhandelen
    # i.p.v. de hele request te laten stuklopen (partial-commit-pad).
    # (get_clubs zelf crasht hier niet meer op een None-item sinds RFTR-B2:
    # apply_clubs_list slaat niet-dict items over i.p.v. te crashen.)
    cmd = _pending_cmd("get_competition_detail", {"comp_id": 21, "label": "Jongens O16"})
    session.add(cmd)
    session.commit()
    session.refresh(cmd)

    raw = {"data": {"data": {"name": "Jongens O16", "poules": [None]}}}
    result = post_cmd_result(cmd.id, CmdResultIn(raw=raw), session=session, _=None)

    assert result["ok"] is False
    assert result["status"] == "failed"
    session.refresh(cmd)
    assert cmd.status == "failed"


def test_a_db_integrity_error_in_the_handler_still_marks_cmd_failed_cleanly(session):
    # Bijvangst 29-08-2026: een IntegrityError midden in een dispatch-handler
    # (bv. de hl_comp_id-race) liet de sessie in een PendingRollbackError-
    # staat achter - de except-tak probeerde toen zelf ook nog te schrijven
    # en crashte daardoor OOK, met een 500 als gevolg (geen archief, geen
    # zichtbare fout, cmd bleef voor altijd in_progress). session.rollback()
    # vóór de recovery-write lost dit op.
    import routers.hockey_vanger_cmd_queue as cmd_queue_module

    def _boom(session, body, params):
        session.add(HockeyTeam(team_id=999, club_external_id="X", name="A", short_name="A", hockey_type="VE"))
        session.add(HockeyTeam(team_id=999, club_external_id="X", name="B", short_name="B", hockey_type="VE"))
        session.flush()  # UNIQUE constraint failed: hockey_teams.team_id
        return {}, {}

    original = cmd_queue_module._CMD_RESULT_DISPATCH["get_poule"]
    cmd_queue_module._CMD_RESULT_DISPATCH["get_poule"] = _boom
    try:
        cmd = _pending_cmd("get_poule", {"poule_id": 1})
        session.add(cmd)
        session.commit()
        session.refresh(cmd)

        result = post_cmd_result(cmd.id, CmdResultIn(raw={"ok": True}), session=session, _=None)

        assert result["ok"] is False
        assert result["status"] == "failed"
        session.refresh(cmd)
        assert cmd.status == "failed"
        assert "IntegrityError" in cmd.error
    finally:
        cmd_queue_module._CMD_RESULT_DISPATCH["get_poule"] = original
