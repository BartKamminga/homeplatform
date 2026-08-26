"""Poulebord-agent — definities voor de agent-registry (item 939).

Analyseert standen/verloop van een competitie en schrijft een korte notitie
terug op de publicatie-competitie-koppeling, zichtbaar op Poulebord via de
bestaande publieke competition-standings-respons (geen nieuw endpoint).

Item 957 breidt dit uit met ai_note op poule- (HockeyPoule) en teamniveau
(HockeyPouleStanding - team-binnen-een-poule, niet het globale HockeyTeam).
Items 915/917 voegen een gap-finder en een publicatie-highlight toe."""

from dataclasses import asdict

from sqlmodel import col, select

from models.hockey import HockeyPublication, HockeyPublicationComp
from models.hockey_discovery import (
    HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyPouleStanding,
)
from routers.hockey_query import get_tag_round_matches, get_tag_round_scorers, get_upcoming_matches
from services.agents.common import NONE_POST_PROCESS
from services.hockey_scenario import load_poule_inputs, simulate_position


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


def ds_ai_note_gaps(session, params):
    """Item 915 - welke zichtbare competities missen nog een AI-notitie,
    geprioriteerd op aantal gespeelde wedstrijden."""
    links = session.exec(
        select(HockeyPublicationComp)
        .where(HockeyPublicationComp.visible == True)  # noqa: E712
        .where(col(HockeyPublicationComp.ai_note).is_(None))
    ).all()

    rows = []
    for link in links:
        comp = session.get(HockeyCompetition, link.competition_id)
        poule_ext_ids = [
            p.poule_id for p in session.exec(
                select(HockeyPoule).where(HockeyPoule.competition_id == link.competition_id)
            ).all()
        ]
        played = 0
        if poule_ext_ids:
            played = len(session.exec(
                select(HockeyPouleMatch)
                .where(col(HockeyPouleMatch.poule_id).in_(poule_ext_ids))
                .where(HockeyPouleMatch.status == "finished")
            ).all())
        rows.append({
            "link_id": link.id, "competition_name": comp.name if comp else None,
            "publication_id": link.publication_id, "played_matches": played,
        })
    rows.sort(key=lambda r: -r["played_matches"])
    return {"ai_note_gaps": rows[:20]}


def ds_scenario_simulation(session, params):
    """Item 963 - berekent (geen LLM) of een team gegarandeerd/onmogelijk/
    afhankelijk op een gekozen eindpositie uitkomt, en welke resterende
    wedstrijden daarbij pivotal zijn. Voedt de poulebord-agent zo met
    deterministische feiten die de LLM alleen nog moet navertellen."""
    poule_id = params.get("poule_id")
    team_id = params.get("team_id")
    target_position = params.get("target_position")
    if not poule_id or not team_id or not target_position:
        return {"note": "poule_id/team_id/target_position ontbreekt in de taak-params"}

    fixed_outcomes = {int(k): v for k, v in (params.get("fixed_outcomes") or {}).items()}
    standings, remaining = load_poule_inputs(session, int(poule_id))
    try:
        summary = simulate_position(
            standings, remaining, team_id=int(team_id), target_position=int(target_position),
            comparator=params.get("comparator", "lte"), method=params.get("method", "auto"),
            fixed_outcomes=fixed_outcomes,
        )
    except ValueError as e:
        return {"note": str(e)}
    return asdict(summary)


def ds_publication_query_data(session, params):
    """Item 917 - ruwe query-data voor de seizoenshighlight van een publicatie
    (spannendste aankomende wedstrijd + opvallendste laatste uitslag)."""
    publication_id = params.get("publication_id")
    pub = session.get(HockeyPublication, publication_id) if publication_id else None
    if not pub:
        return {"note": "geen (geldige) publication_id meegegeven in de taak-params"}

    return {
        "publication_id": publication_id,
        "publication_name": pub.name,
        "upcoming_matches": get_upcoming_matches(publication_id, tag=None, limit=5, session=session),
        "round_matches":    get_tag_round_matches(publication_id, tag=None, stat="biggest_margin", scope="round", limit=3, session=session),
        "round_scorers":    get_tag_round_scorers(publication_id, tag=None, stat="goals_for", limit=3, session=session),
    }


def pp_publication_info(session, body, current_user):
    pub = session.get(HockeyPublication, body.publication_id) if body.publication_id else None
    if not pub:
        return {"action": "poulebord_publication_info", "ok": False, "reason": "publication_id ontbreekt of onbekend"}
    pub.info = body.publication_info or body.notes
    session.add(pub)
    return {"action": "poulebord_publication_info", "ok": True, "publication_id": body.publication_id}


def pp_poule_note(session, body, current_user):
    """Item 957 - ai_note op poule-niveau (bv. titelstrijd/degradatiestrijd)."""
    if not body.poule_id:
        return {"action": "poule_note", "ok": False, "reason": "poule_id ontbreekt"}
    poule = session.exec(select(HockeyPoule).where(HockeyPoule.poule_id == body.poule_id)).first()
    if not poule:
        return {"action": "poule_note", "ok": False, "reason": "poule niet gevonden"}
    poule.ai_note = body.poule_note or body.notes
    session.add(poule)
    return {"action": "poule_note", "ok": True, "poule_id": body.poule_id}


def pp_team_note(session, body, current_user):
    """Item 957 - ai_note op teamniveau binnen een poule (bv. vormanalyse,
    grootste concurrent) - op HockeyPouleStanding, niet het globale HockeyTeam."""
    if not body.poule_id or not body.team_id:
        return {"action": "team_note", "ok": False, "reason": "poule_id/team_id ontbreekt"}
    standing = session.exec(
        select(HockeyPouleStanding)
        .where(HockeyPouleStanding.poule_id == body.poule_id)
        .where(HockeyPouleStanding.team_id == body.team_id)
    ).first()
    if not standing:
        return {"action": "team_note", "ok": False, "reason": "team niet gevonden in deze poule"}
    standing.ai_note = body.team_note or body.notes
    session.add(standing)
    return {"action": "team_note", "ok": True, "poule_id": body.poule_id, "team_id": body.team_id}


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
        "ai_note_gaps": {
            "label": "Competities zonder AI-notitie (item 915)",
            "params": [],
            "desc": "Zichtbare publicatie-competities zonder ai_note, geprioriteerd op aantal gespeelde wedstrijden.",
            "fn": ds_ai_note_gaps,
        },
        "scenario_simulation": {
            "label": "Eindpositie-scenario voor een team (item 963)",
            "params": [
                {"name": "poule_id", "type": "integer", "required": True,
                 "desc": "hockey.nl poule id (hockey_poules.poule_id)"},
                {"name": "team_id", "type": "integer", "required": True, "desc": "hockey.nl team id"},
                {"name": "target_position", "type": "integer", "required": True,
                 "desc": "Doelpositie (1 = kampioenschap)"},
                {"name": "comparator", "type": "string", "required": False, "desc": "'lte' (standaard), 'eq', 'gte'"},
                {"name": "method", "type": "string", "required": False, "desc": "'auto' (standaard), 'exact', 'monte_carlo'"},
                {"name": "fixed_outcomes", "type": "object", "required": False,
                 "desc": "'Wat als'-aannames: {match_id: 'H'|'D'|'A'}"},
            ],
            "desc": "Berekent of team X gegarandeerd/onmogelijk/afhankelijk op een gekozen eindpositie uitkomt, "
                    "en welke resterende wedstrijden daarbij pivotal zijn.",
            "fn": ds_scenario_simulation,
        },
        "publication_query_data": {
            "label": "Query-data voor publicatiehighlight (item 917)",
            "params": [
                {"name": "publication_id", "type": "string", "required": True,
                 "desc": "id van de publicatie (hockey_publications.id)"},
            ],
            "desc": "Aankomende spannende wedstrijd + laatste-ronde-highlights (uitslag/topscorers) voor 1 publicatie.",
            "fn": ds_publication_query_data,
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
        "poule_note": {
            "label": "Poulebord: notitie bij een poule (item 957)",
            "result_fields": [
                {"name": "poule_id", "type": "integer", "required": True, "desc": "hockey.nl poule id (hockey_poules.poule_id)"},
                {"name": "poule_note", "type": "string (max ~200 tekens)", "required": True, "desc": "Tekst die op Poulebord verschijnt (hockey_poules.ai_note)"},
            ],
            "fn": pp_poule_note,
        },
        "team_note": {
            "label": "Poulebord: notitie bij een team binnen een poule (item 957)",
            "result_fields": [
                {"name": "poule_id", "type": "integer", "required": True, "desc": "hockey.nl poule id"},
                {"name": "team_id", "type": "integer", "required": True, "desc": "hockey.nl team id"},
                {"name": "team_note", "type": "string (max ~200 tekens)", "required": True, "desc": "Tekst die op Poulebord verschijnt (hockey_poule_standings.ai_note)"},
            ],
            "fn": pp_team_note,
        },
        "poulebord_publication_info": {
            "label": "Poulebord: seizoenshighlight bij een publicatie (item 917)",
            "result_fields": [
                {"name": "publication_id", "type": "string", "required": True, "desc": "id van de publicatie"},
                {"name": "publication_info", "type": "string (max ~250 tekens)", "required": True, "desc": "Highlight-tekst (hockey_publications.info)"},
            ],
            "fn": pp_publication_info,
        },
        "none": NONE_POST_PROCESS,
    },
}
