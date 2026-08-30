"""Tests voor de queue-debug-pagina (backend/routers/hockey_vanger_cmd_queue_
debug.py) - filterbare/gepagineerde browse + niet-muterende 'preview-next'
simulatie van GET /vanger/cmd-queue/next."""

import json

from sqlmodel import select

from models.hockey_discovery import HockeyTeam, VangerCmd
from routers.hockey_vanger_cmd_queue_debug import browse_cmd_queue, preview_next_cmd


def _team(team_id, category="Junioren", hockey_type="VE", short_name="JO16-1"):
    return HockeyTeam(
        team_id=team_id, club_external_id="HH11ZZ0", name=f"Test {team_id}", short_name=short_name,
        hockey_type=hockey_type, category_group_name=category,
    )


def test_browse_returns_all_cmds_when_no_filters(session):
    session.add(VangerCmd(cmd_type="get_poule", params=json.dumps({"poule_id": 1}), status="pending"))
    session.add(VangerCmd(cmd_type="scan_club", params=json.dumps({"external_id": "X"}), status="done"))
    session.commit()

    result = browse_cmd_queue(session=session, _=None)

    assert result["total"] == 2
    assert len(result["items"]) == 2


def test_browse_filters_by_status(session):
    session.add(VangerCmd(cmd_type="get_poule", params=json.dumps({"poule_id": 1}), status="pending"))
    session.add(VangerCmd(cmd_type="get_poule", params=json.dumps({"poule_id": 2}), status="done"))
    session.commit()

    result = browse_cmd_queue(status="pending", session=session, _=None)

    assert result["total"] == 1
    assert result["items"][0]["status"] == "pending"


def test_browse_filters_by_cmd_type(session):
    session.add(VangerCmd(cmd_type="get_poule", params=json.dumps({"poule_id": 1}), status="pending"))
    session.add(VangerCmd(cmd_type="scan_club", params=json.dumps({"external_id": "X"}), status="pending"))
    session.commit()

    result = browse_cmd_queue(cmd_type="scan_club", session=session, _=None)

    assert result["total"] == 1
    assert result["items"][0]["cmd_type"] == "scan_club"


def test_browse_filters_by_search_text(session):
    session.add(VangerCmd(cmd_type="get_poule", params=json.dumps({"poule_id": 1, "label": "Alkmaar JO16-1"}), status="pending"))
    session.add(VangerCmd(cmd_type="get_poule", params=json.dumps({"poule_id": 2, "label": "Bloemendaal H1"}), status="pending"))
    session.commit()

    result = browse_cmd_queue(search="alkmaar", session=session, _=None)

    assert result["total"] == 1
    assert result["items"][0]["params"]["label"] == "Alkmaar JO16-1"


def test_browse_pagination(session):
    for i in range(5):
        session.add(VangerCmd(cmd_type="get_poule", params=json.dumps({"poule_id": i}), status="pending"))
    session.commit()

    page1 = browse_cmd_queue(limit=2, offset=0, session=session, _=None)
    page2 = browse_cmd_queue(limit=2, offset=2, session=session, _=None)

    assert page1["total"] == 5
    assert len(page1["items"]) == 2
    assert len(page2["items"]) == 2
    assert page1["items"][0]["id"] != page2["items"][0]["id"]


def test_browse_marks_a_cmd_outside_the_active_filter(session):
    # Default queue-filter: categorie=Junioren - een Senioren-team valt erbuiten.
    session.add(_team(team_id=1, category="Senioren"))
    session.add(VangerCmd(cmd_type="get_poule", params=json.dumps({"poule_id": 1, "team_id": 1}), status="pending"))
    session.commit()

    result = browse_cmd_queue(session=session, _=None)

    assert result["items"][0]["in_active_filter"] is False


def test_preview_next_returns_the_first_matching_pending_cmd(session):
    session.add(_team(team_id=1, category="Senioren"))  # buiten filter
    session.add(_team(team_id=2, category="Junioren"))  # binnen filter
    session.add(VangerCmd(cmd_type="get_poule", params=json.dumps({"poule_id": 1, "team_id": 1}), status="pending"))
    session.add(VangerCmd(cmd_type="get_poule", params=json.dumps({"poule_id": 2, "team_id": 2}), status="pending"))
    session.commit()

    result = preview_next_cmd(session=session, _=None)

    assert result["found"] is True
    assert result["params"]["poule_id"] == 2
    assert result["skipped_count"] == 1  # de Senioren-cmd werd overgeslagen


def test_preview_next_reports_not_found_when_nothing_matches(session):
    session.add(_team(team_id=1, category="Senioren"))
    session.add(VangerCmd(cmd_type="get_poule", params=json.dumps({"poule_id": 1, "team_id": 1}), status="pending"))
    session.commit()

    result = preview_next_cmd(session=session, _=None)

    assert result["found"] is False
    assert result["skipped_count"] == 1


def test_preview_next_does_not_mutate_the_queue(session):
    session.add(_team(team_id=2, category="Junioren"))
    session.add(VangerCmd(cmd_type="get_poule", params=json.dumps({"poule_id": 2, "team_id": 2}), status="pending"))
    session.commit()

    preview_next_cmd(session=session, _=None)

    cmd = session.exec(select(VangerCmd)).first()
    assert cmd.status == "pending"  # niet naar in_progress gezet, i.t.t. de echte /next
