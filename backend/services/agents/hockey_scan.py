"""Hockey scan-agent — definities voor de agent-registry (item 939).

Vult de scan-queue van hockey-inside (vanger_cmd_queue) op basis van de
huidige queue-status. Losstaand van de bestaande, altijd-actieve scan-plan-
pass (hockey_vanger_scanplan.py) - dit is de aanvullende, LLM-gedreven laag
(zie roadmap-item 888)."""

from sqlmodel import select

from models.hockey_discovery import VangerCmd
from routers.hockey_vanger import add_vanger_cmd
from services.agents.common import NONE_POST_PROCESS


def ds_vanger_queue_state(session, params):
    counts = {}
    for status in ("pending", "in_progress", "done", "failed", "skipped"):
        counts[status] = len(session.exec(select(VangerCmd).where(VangerCmd.status == status)).all())
    return {"vanger_cmd_queue_counts": counts}


def pp_hockey_cmds(session, body, current_user):
    cmd_results = []
    for cmd in body.cmds:
        result = add_vanger_cmd(session, cmd.cmd_type, cmd.params)
        cmd_results.append({"cmd_type": cmd.cmd_type, "params": cmd.params, **result})
    return {"action": "hockey_cmds", "cmds": cmd_results}


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
        "none": NONE_POST_PROCESS,
    },
}
