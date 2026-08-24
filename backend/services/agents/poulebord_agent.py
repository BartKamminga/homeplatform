"""Poulebord-agent — definities voor de agent-registry (item 939).

Analyseert standen/verloop van een competitie en schrijft een korte notitie
terug op de publicatie-competitie-koppeling, zichtbaar op Poulebord via de
bestaande publieke competition-standings-respons (geen nieuw endpoint)."""

from sqlmodel import select

from models.hockey import HockeyPublicationComp
from models.hockey_discovery import HockeyCompetition, HockeyPoule, HockeyPouleStanding
from services.agents.common import NONE_POST_PROCESS


def ds_poule_standings(session, params):
    link_id = params.get("link_id")
    link = session.get(HockeyPublicationComp, link_id) if link_id else None
    if not link:
        return {"note": "geen (geldig) link_id meegegeven in de taak-params"}

    comp = session.get(HockeyCompetition, link.competition_id)
    poules = session.exec(select(HockeyPoule).where(HockeyPoule.competition_id == link.competition_id)).all()
    standings_by_poule = {}
    for p in poules:
        rows = session.exec(
            select(HockeyPouleStanding)
            .where(HockeyPouleStanding.poule_id == p.poule_id)
            .order_by(HockeyPouleStanding.position)
        ).all()
        standings_by_poule[p.name] = [
            {"team": r.team_name, "pts": r.points, "played": r.played, "gf": r.goals_for, "ga": r.goals_against}
            for r in rows
        ]
    return {"link_id": link_id, "competition_name": comp.name if comp else None, "standings_by_poule": standings_by_poule}


def pp_poulebord_note(session, body, current_user):
    link = session.get(HockeyPublicationComp, body.link_id) if body.link_id else None
    if not link:
        return {"action": "poulebord_note", "ok": False, "reason": "link_id ontbreekt of onbekend"}
    link.ai_note = body.note_text or body.notes
    session.add(link)
    return {"action": "poulebord_note", "ok": True, "link_id": body.link_id}


AGENT = {
    "label": "Poulebord-agent",
    # Geen zinnig routine-standaard zonder een specifiek link_id - buiten een
    # gekozen taak/context doet deze agent dus niets (alleen heartbeat).
    "default_data_source":  None,
    "default_post_process": "none",
    "data_sources": {
        "poule_standings": {
            "label": "Poule-standen van een competitie",
            "params": [
                {"name": "link_id", "type": "string", "required": True,
                 "desc": "id van de publicatie-competitie-koppeling (hockey_publication_comps.id)"},
            ],
            "desc": "Competitienaam + standen per poule (team, punten, gespeeld, doelsaldo).",
            "fn": ds_poule_standings,
        },
    },
    "post_processes": {
        "poulebord_note": {
            "label": "Poulebord: notitie bij een competitie",
            "result_fields": [
                {"name": "note_text", "type": "string (max ~200 tekens)", "required": True,
                 "desc": "Tekst die op Poulebord verschijnt (hockey_publication_comps.ai_note)"},
            ],
            "fn": pp_poulebord_note,
        },
        "none": NONE_POST_PROCESS,
    },
}
