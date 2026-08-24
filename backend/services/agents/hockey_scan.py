"""Hockey scan-agent — definities voor de agent-registry (item 939).

Vult de scan-queue van hockey-inside (vanger_cmd_queue) op basis van de
huidige queue-status. Losstaand van de bestaande, altijd-actieve scan-plan-
pass (hockey_vanger_scanplan.py) - dit is de aanvullende, LLM-gedreven laag
(zie roadmap-item 888)."""

import json

from sqlmodel import col, select

from models.capture import DataCapture
from models.core import RoadmapItem
from models.hockey_discovery import HockeyClub, HockeyTeam, VangerCmd
from models.settings import AppSetting
from routers.hockey_vanger import (
    GHOST_ENABLED_KEY, SCAN_PLAN_ENABLED_KEY, VANGER_STATUS_KEYS, add_vanger_cmd,
)
from routers.roadmap import RoadmapItemCreate, create_item
from services.agents.common import NONE_POST_PROCESS

_EMPTY_STATUS = {"running": False, "mode": None, "task": None, "state": "offline", "last_seen": None}


def ds_vanger_queue_state(session, params):
    counts = {}
    for status in ("pending", "in_progress", "done", "failed", "skipped"):
        counts[status] = len(session.exec(select(VangerCmd).where(VangerCmd.status == status)).all())
    return {"vanger_cmd_queue_counts": counts}


def ds_club_scan_priority(session, params):
    """Zelfde selectie als GET /vanger/club-scan-queue (hockey_vanger.py), hier
    als platte databron: welke clubs hebben de meeste wachtende teams."""
    teams = session.exec(
        select(HockeyTeam).where((HockeyTeam.no_new_poule_confirmed == True) | (HockeyTeam.season_pending == True))  # noqa: E712
    ).all()
    counts = {}
    for t in teams:
        counts[t.club_external_id] = counts.get(t.club_external_id, 0) + 1
    clubs = session.exec(select(HockeyClub).where(col(HockeyClub.external_id).in_(counts.keys()))).all()
    by_ext_id = {c.external_id: c for c in clubs}
    rows = [
        {
            "club_external_id": ext_id,
            "name": (by_ext_id[ext_id].friendly_name or by_ext_id[ext_id].name) if ext_id in by_ext_id else None,
            "detail_loaded": by_ext_id[ext_id].detail_loaded if ext_id in by_ext_id else None,
            "pending_teams": count,
        }
        for ext_id, count in counts.items()
    ]
    rows.sort(key=lambda r: -r["pending_teams"])
    return {"clubs_by_pending_teams": rows[:20]}


def ds_vanger_health(session, params):
    result = {}
    for client, key in VANGER_STATUS_KEYS.items():
        row = session.get(AppSetting, key)
        result[client] = json.loads(row.value) if row and row.value else {**_EMPTY_STATUS, "client": client}
    ghost_row = session.get(AppSetting, GHOST_ENABLED_KEY)
    result["ghost_enabled"] = ghost_row.value != "0" if ghost_row else True
    scan_plan_row = session.get(AppSetting, SCAN_PLAN_ENABLED_KEY)
    result["scan_plan_enabled"] = scan_plan_row.value != "0" if scan_plan_row else True
    return {"vanger_status": result}


def ds_plugin_errors(session, params):
    limit = int(params.get("limit", 20))
    rows = session.exec(
        select(DataCapture)
        .where(DataCapture.source == "hockey-vanger", DataCapture.capture_type == "plugin_error")
        .order_by(col(DataCapture.captured_at).desc())
        .limit(limit)
    ).all()
    return {
        "plugin_errors": [
            {"id": r.id, "message": r.payload, "meta": json.loads(r.meta) if r.meta else None,
             "captured_at": r.captured_at.isoformat()}
            for r in rows
        ]
    }


def pp_hockey_cmds(session, body, current_user):
    cmd_results = []
    for cmd in body.cmds:
        result = add_vanger_cmd(session, cmd.cmd_type, cmd.params)
        cmd_results.append({"cmd_type": cmd.cmd_type, "params": cmd.params, **result})
    return {"action": "hockey_cmds", "cmds": cmd_results}


def pp_roadmap_draft_item(session, body, current_user):
    """Maakt een nieuw roadmap-item aan voor een structureel probleem (bv. een
    terugkerend plugin-foutpatroon) - met dedup: geen tweede item als er al een
    open item met exact dezelfde titel bestaat, zodat een herhaald patroon niet
    elke run een nieuw item spawnt."""
    title = (body.notification or body.notes or "").strip()[:200]
    if not title:
        return {"action": "roadmap_draft_item", "ok": False, "reason": "geen titel (notification/notes leeg)"}
    existing = session.exec(
        select(RoadmapItem).where(RoadmapItem.title == title, col(RoadmapItem.status) != "done")
    ).first()
    if existing:
        return {"action": "roadmap_draft_item", "ok": False, "reason": "al een open item met deze titel", "roadmap_item_id": existing.id}
    item = create_item(
        RoadmapItemCreate(
            title=title, description=body.reasoning, site="hockey-inside", priority="medium",
            status="idea", notes="[AI-signalering] automatisch aangemaakt door de hockey scan-agent",
        ),
        session, current_user,
    )
    return {"action": "roadmap_draft_item", "ok": True, "roadmap_item_id": item.id}


AGENT = {
    "label": "Hockey scan-agent",
    # Zonder gekozen context (routinematige cyclus, geen specifieke taak)
    # valt de agent op deze combinatie terug - bewaart het bestaande gedrag
    # van vóór item 939 (periodiek de scan-queue checken).
    "default_data_source":  "vanger_queue_state",
    "default_post_process": "hockey_cmds",
    "data_sources": {
        "vanger_queue_state": {
            "label": "Scan-queue status",
            "params": [],
            "desc": "Aantallen pending/in_progress/done/failed/skipped in de vanger_cmd_queue.",
            "fn": ds_vanger_queue_state,
        },
        "club_scan_priority": {
            "label": "Clubs met de meeste wachtende teams",
            "params": [],
            "desc": "Top 20 clubs (external_id, naam, detail_loaded) gesorteerd op aantal teams met "
                    "no_new_poule_confirmed/season_pending - voor gerichte scanprioriteit i.p.v. sortering.",
            "fn": ds_club_scan_priority,
        },
        "vanger_health": {
            "label": "Scout/Ghost-status + queue-gezondheid",
            "params": [],
            "desc": "Heartbeat-status van Scout/Ghost, ghost_enabled/scan_plan_enabled.",
            "fn": ds_vanger_health,
        },
        "plugin_errors": {
            "label": "Recente vanger-plugin-fouten",
            "params": [{"name": "limit", "type": "integer", "required": False, "desc": "Max. aantal (default 20)"}],
            "desc": "Laatste plugin-foutmeldingen (message/context/url/session_id) van Scout/Ghost.",
            "fn": ds_plugin_errors,
        },
    },
    "post_processes": {
        "hockey_cmds": {
            "label": "Hockey: cmd's naar de scan-queue",
            "result_fields": [
                {"name": "cmds", "type": "lijst van {cmd_type, params}", "required": False,
                 "desc": "Wordt na dedup in vanger_cmd_queue gezet (get_poule/scan_club/get_clubs/"
                         "get_competition_detail/get_competitions)"},
            ],
            "fn": pp_hockey_cmds,
        },
        "roadmap_draft_item": {
            "label": "Roadmap: nieuw item aanmaken bij structureel probleem",
            "result_fields": [
                {"name": "notification", "type": "string", "required": True,
                 "desc": "Wordt de titel van het nieuwe roadmap-item (dus kort en dekkend houden)"},
            ],
            "fn": pp_roadmap_draft_item,
        },
        "none": NONE_POST_PROCESS,
    },
}
