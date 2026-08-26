"""Gedeelde bouwstenen voor agent-definities - elke agent (hockey_scan.py,

poulebord_agent.py, roadmap_agent.py, ...) importeert hiervandaan i.p.v. zijn
eigen "none"-post-process te herschrijven."""

from sqlmodel import col, select

from models.core import RoadmapItem


def make_roadmap_flag_post_process(action_key: str, label: str, site: str):
    """Fabriek voor een post-process die (net als hockey_scan.pp_roadmap_draft_item)
    een nieuw roadmap-item aanmaakt voor een structureel probleem - met dedup op
    exacte titel, zodat een herhaald patroon niet elke run een nieuw item spawnt."""

    def fn(session, body, current_user):
        title = (body.notification or body.notes or "").strip()[:200]
        if not title:
            return {"action": action_key, "ok": False, "reason": "geen titel (notification/notes leeg)"}
        existing = session.exec(
            select(RoadmapItem).where(RoadmapItem.title == title, col(RoadmapItem.status) != "done")
        ).first()
        if existing:
            return {"action": action_key, "ok": False, "reason": "al een open item met deze titel", "roadmap_item_id": existing.id}
        # Late import - vermijdt een circulaire import tussen routers.roadmap en services.agents.
        from routers.roadmap import RoadmapItemCreate, create_item
        item = create_item(
            RoadmapItemCreate(
                title=title, description=body.reasoning, site=site, priority="medium",
                status="idea", notes=f"[AI-signalering] automatisch aangemaakt door {label}",
            ),
            session, current_user,
        )
        return {"action": action_key, "ok": True, "roadmap_item_id": item.id}

    return {
        "label": f"{label}: nieuw roadmap-item bij structureel probleem",
        "result_fields": [
            {"name": "notification", "type": "string", "required": True,
             "desc": "Wordt de titel van het nieuwe roadmap-item (dus kort en dekkend houden)"},
        ],
        "fn": fn,
    }


def pp_none(session, body, current_user):
    """Standaard post-process voor elke agent: alleen een melding, geen
    platform-wijziging. Elke agent kan dit als fallback-optie aanbieden."""
    return {"action": "none"}


NONE_POST_PROCESS = {
    "label": "Alleen melding (geen platform-wijziging)",
    "result_fields": [
        {"name": "notification", "type": "string of null", "required": False, "desc": "Optionele melding aan Bart"},
    ],
    "fn": pp_none,
}
