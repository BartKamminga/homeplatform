"""Karakteriseringstests voor post_cmd_result (routers/hockey_vanger.py) -
refactor-plan hockey-inside Fase 1 (RFTR-B1). Nul dekking voor deze fix,
ondanks dat het de centrale ontvangst-functie is voor alle Ghost/Scout-
scanresultaten (5 cmd_type-dispatch-paden + archivering + foutafhandeling)."""

import json
from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlmodel import select

from models.capture import DataCapture
from models.hockey import HockeyPublicationComp
from models.hockey_discovery import (
    HockeyCompetition, HockeyPoule, HockeyTeam, ScanHistoryDaily, ScanScheduleEntry, VangerCmd,
)
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


def test_get_poule_result_triggers_a_reactive_schedule_rebuild(session):
    """Bart, 30-08-2026: een net binnengekomen get_poule-resultaat moet het
    scanschema meteen laten herberekenen, i.p.v. te wachten op de
    eerstvolgende periodieke scan-plan-pass - anders blijft een net
    ontdekte (live) wedstrijd tot profile_scan_interval_min onzichtbaar in
    het schema. Zonder de reactieve rebuild in post_cmd_result zou
    ScanScheduleEntry hier na afloop nog steeds leeg zijn - niets anders
    in deze test roept rebuild_schedule aan."""
    # external_id moet exact matchen met wat _call_poule_capture zelf
    # berekent (name|class_name|district|season) - anders herkent de
    # ingest deze competitie niet en maakt hij een NIEUWE (ongepubliceerde)
    # rij aan, waarna de poule alsnog buiten active_comp_ids valt.
    comp = HockeyCompetition(
        external_id="Reactive Rebuild Test|District||2026-2027", name="Reactive Rebuild Test",
        class_name="District", hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPublicationComp(publication_id="pub1", competition_id=comp.id, scan_profile="active"))
    poule = HockeyPoule(poule_id=500, name="Poule Reactive", competition_id=comp.id, season="2026-2027")
    session.add(poule)
    session.add(HockeyTeam(
        team_id=50, club_external_id="HH50ZZ0", name="Reactive Team", short_name="H50",
        hockey_type="VE", category_group_name="Senioren", recent_poule_id=500,
    ))
    session.commit()

    assert session.exec(select(ScanScheduleEntry).where(ScanScheduleEntry.target_id == 500)).first() is None

    match_start = datetime.utcnow() - timedelta(minutes=20)
    raw = {"data": {"data": {"poule": {
        "id": 500, "name": "Poule Reactive",
        "competition": {"name": "Reactive Rebuild Test", "subcompetition": {"class": "District"}},
        "standings": [],
        "matches": [{"id": 1, "date": match_start.isoformat(), "status": "live",
                     "home": {"id": 50, "name": "Reactive Team"}, "away": {"id": 51, "name": "Other Team"},
                     "score": {"home": 0, "away": 0}}],
    }}}}
    cmd = _pending_cmd("get_poule", {"poule_id": 500, "team_id": 50, "label": "Reactive Team"})
    session.add(cmd)
    session.commit()
    session.refresh(cmd)

    post_cmd_result(cmd.id, CmdResultIn(raw=raw, session_id="sess-reactive"), session=session, _=None)

    entries = session.exec(select(ScanScheduleEntry).where(ScanScheduleEntry.target_id == 500)).all()
    assert entries


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
