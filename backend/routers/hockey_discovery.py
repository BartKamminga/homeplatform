"""Hockey — publieke endpoints (Poulebord + Hockey Inside)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, col, select

from core.database import get_session
from models.hockey_discovery import (
    HockeyClub,
    HockeyCompetition,
    HockeyPoule,
    HockeyPouleMatch,
    HockeyPouleStanding,
    HockeyTeam,
)
from services.hockey_scope import get_comp_link_tags, get_visible_comp_links
from services.hockey_teams import club_logo_for_team, resolve_team_clubs

router = APIRouter(prefix="/api/hockey", tags=["hockey-discovery"])


@router.get("/public/clubs")
def list_public_clubs(session: Session = Depends(get_session)):
    """Clubnamen voor de poulebord-clubselector (uit HockeyClub, niet tournix_clubs)."""
    clubs = session.exec(select(HockeyClub)).all()
    names = sorted({(c.friendly_name or c.name) for c in clubs if (c.friendly_name or c.name)})
    return names


@router.get("/public/publications")
def list_public_publications(session: Session = Depends(get_session)):
    """Lijst van gepubliceerde hockey-inside publicaties voor Poulebord."""
    from models.hockey import HockeyPublication
    pubs = session.exec(
        select(HockeyPublication)
        .where(HockeyPublication.published == True)  # noqa: E712
        .order_by(HockeyPublication.season.desc(), HockeyPublication.order, HockeyPublication.name)
    ).all()
    return [
        {"id": p.id, "name": p.name, "season": p.season, "published": p.published}
        for p in pubs
    ]


@router.get("/public/tournaments/{tid}/competition-standings")
def get_tournament_competition_standings(
    tid: str,
    session: Session = Depends(get_session),
):
    """Lees standings per gekoppelde competitie voor een publicatie."""
    links = get_visible_comp_links(session, tid)

    if not links:
        return {"tournament_id": tid, "competitions": []}

    competitions = []
    for lnk in links:
        comp = session.get(HockeyCompetition, lnk.competition_id)
        if not comp:
            continue
        assigned_tags = get_comp_link_tags(session, lnk.id)
        poules = session.exec(
            select(HockeyPoule)
            .where(HockeyPoule.competition_id == lnk.competition_id)
            .order_by(HockeyPoule.name)
        ).all()
        match_counts: dict = {}
        if poules:
            ext_ids = [p.poule_id for p in poules]
            for m in session.exec(
                select(HockeyPouleMatch).where(col(HockeyPouleMatch.poule_id).in_(ext_ids))
            ).all():
                mc = match_counts.setdefault(m.poule_id, {"total": 0, "played": 0})
                mc["total"] += 1
                if m.status == "finished":
                    mc["played"] += 1

        comp_entry = {
            "link_id":     lnk.id,
            "id":          comp.id,
            "name":        lnk.label or comp.name,
            "hockey_type": comp.hockey_type,
            "class_name":  comp.class_name,
            "district":    comp.district,
            "season":      comp.season,
            "fase_tags":   [{"id": ft.id, "name": ft.name} for ft in assigned_tags],
            "poules":      [],
        }
        for poule in poules:
            rows = session.exec(
                select(HockeyPouleStanding)
                .where(HockeyPouleStanding.poule_id == poule.poule_id)
                .order_by(
                    HockeyPouleStanding.position,
                    HockeyPouleStanding.points.desc(),  # type: ignore[attr-defined]
                )
            ).all()
            teams_pending = []
            if not rows:
                pending_teams = session.exec(
                    select(HockeyTeam)
                    .where(HockeyTeam.recent_poule_id == poule.poule_id)
                    .order_by(HockeyTeam.name)
                ).all()
                teams_pending = [t.name for t in pending_teams]
            mc = match_counts.get(poule.poule_id, {"total": 0, "played": 0})
            teams, clubs = resolve_team_clubs(session, [r.team_id for r in rows])
            comp_entry["poules"].append({
                "id":             poule.id,
                "name":           poule.name,
                "poule_id":       poule.poule_id,
                "teams_pending":  teams_pending,
                "matches_total":  mc["total"],
                "matches_played": mc["played"],
                "standings": [
                    {
                        "team_name":     r.team_name,
                        "club_logo_url": club_logo_for_team(teams, clubs, r.team_id),
                        "pts":           r.points,
                        "played":        r.played,
                        "won":           r.won,
                        "drawn":         r.drawn,
                        "lost":          r.lost,
                        "gf":            r.goals_for,
                        "ga":            r.goals_against,
                    }
                    for r in rows
                ],
            })
        competitions.append(comp_entry)

    return {"tournament_id": tid, "competitions": competitions}


@router.get("/public/competitions/{cid}/matches")
def get_competition_matches(cid: int, session: Session = Depends(get_session)):
    """Wedstrijden per poule voor een discovery-competitie."""
    comp = session.get(HockeyCompetition, cid)
    if not comp:
        raise HTTPException(404, "Competitie niet gevonden")
    poules = session.exec(
        select(HockeyPoule)
        .where(HockeyPoule.competition_id == cid)
        .order_by(HockeyPoule.name)
    ).all()
    result = []
    for poule in poules:
        matches = session.exec(
            select(HockeyPouleMatch)
            .where(HockeyPouleMatch.poule_id == poule.poule_id)
            .order_by(HockeyPouleMatch.match_date, HockeyPouleMatch.match_id)
        ).all()
        finished  = [m for m in matches if m.status == "finished"]
        scheduled = [m for m in matches if m.status != "finished"]
        result.append({
            "id":       poule.id,
            "name":     poule.name,
            "poule_id": poule.poule_id,
            "finished": [
                {
                    "match_id":   m.match_id,
                    "home":       m.home_team_name,
                    "away":       m.away_team_name,
                    "home_score": m.home_score,
                    "away_score": m.away_score,
                    "date":       m.match_date,
                    "round":      m.round,
                }
                for m in finished
            ],
            "scheduled": [
                {
                    "match_id": m.match_id,
                    "home":     m.home_team_name,
                    "away":     m.away_team_name,
                    "date":     m.match_date,
                    "round":    m.round,
                }
                for m in scheduled
            ],
        })
    return {"competition_id": cid, "name": comp.name, "poules": result}


@router.get("/public/season")
def get_public_season(session: Session = Depends(get_session)):
    """Huidig discovery-seizoen (disc_target_season AppSetting) voor Poulebord."""
    from models.settings import AppSetting
    row = session.get(AppSetting, "disc_target_season")
    return {"season": row.value if row else "2026-2027"}


@router.get("/public/hockey-poules/{pid}/standings")
def get_hockey_poule_standings(pid: int, session: Session = Depends(get_session)):
    """Standings voor één discovery-poule (voor gepinde poules op het board)."""
    poule = session.get(HockeyPoule, pid)
    if not poule:
        raise HTTPException(404, "Poule niet gevonden")
    rows = session.exec(
        select(HockeyPouleStanding)
        .where(HockeyPouleStanding.poule_id == poule.poule_id)
        .order_by(HockeyPouleStanding.position, HockeyPouleStanding.points.desc())  # type: ignore[attr-defined]
    ).all()
    teams, clubs = resolve_team_clubs(session, [r.team_id for r in rows])
    return {
        "pool_name": poule.name,
        "standings": [
            {"team_name": r.team_name, "club_logo_url": club_logo_for_team(teams, clubs, r.team_id),
             "pts": r.points, "won": r.won,
             "drawn": r.drawn, "lost": r.lost, "gf": r.goals_for, "ga": r.goals_against}
            for r in rows
        ],
    }
