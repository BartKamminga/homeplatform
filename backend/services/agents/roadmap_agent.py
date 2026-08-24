"""Roadmap-agent — definities voor de agent-registry (item 939).

Analyseert openstaande roadmap-items (status=idea) en levert een VOORSTEL
voor impact/risk/scope - landt altijd geprefixt als "[AI-voorstel]" in notes,
status blijft idea totdat een mens het bevestigt (roadmap-item 906)."""

from sqlmodel import col, select

from models.core import RoadmapItem
from routers.roadmap import RoadmapItemUpdate, update_item
from services.agents.common import NONE_POST_PROCESS


def ds_roadmap_idea_items(session, params):
    items = session.exec(
        select(RoadmapItem).where(RoadmapItem.status == "idea").order_by(col(RoadmapItem.priority)).limit(10)
    ).all()
    return {
        "roadmap_idea_items": [
            {"id": i.id, "title": i.title, "site": i.site, "priority": i.priority, "description": i.description}
            for i in items
        ]
    }


def pp_roadmap_preanalysis(session, body, current_user):
    if not body.roadmap_item_id:
        return {"action": "roadmap_preanalysis", "ok": False, "reason": "roadmap_item_id ontbreekt"}
    prefixed_notes = f"[AI-voorstel] {body.notes}".strip()
    update_item(
        body.roadmap_item_id,
        RoadmapItemUpdate(impact=body.impact, risk=body.risk, scope=body.scope, notes=prefixed_notes),
        session, current_user,
    )
    # Bewust GEEN status-wijziging - dit is een voorstel, een mens bevestigt
    # het item pas als analyzed.
    return {"action": "roadmap_preanalysis", "ok": True, "roadmap_item_id": body.roadmap_item_id}


AGENT = {
    "label": "Roadmap-agent",
    # Routine-standaard: elke cyclus zonder specifieke taak checkt gewoon de
    # openstaande idea-items, maar doet zonder concrete opdracht geen
    # post-processing (geen roadmap_item_id om aan te schrijven).
    "default_data_source":  "idea_items",
    "default_post_process": "none",
    "data_sources": {
        "idea_items": {
            "label": "Openstaande idea-items",
            "params": [],
            "desc": "Tot 10 roadmap-items met status=idea (titel, site, prioriteit, omschrijving).",
            "fn": ds_roadmap_idea_items,
        },
    },
    "post_processes": {
        "roadmap_preanalysis": {
            "label": "Roadmap: analyse-voorstel",
            "result_fields": [
                {"name": "roadmap_item_id", "type": "integer", "required": True, "desc": "Welk roadmap-item"},
                {"name": "impact", "type": "string", "required": False, "desc": "Impact op de gebruiker"},
                {"name": "risk",   "type": "string", "required": False, "desc": "Risico"},
                {"name": "scope",  "type": "string", "required": False, "desc": "Omvang"},
            ],
            "fn": pp_roadmap_preanalysis,
        },
        "none": NONE_POST_PROCESS,
    },
}
