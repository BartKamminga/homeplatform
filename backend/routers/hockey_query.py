"""Poulebord — query-templates op niveau-tag (ranglijst + rondetopscorers)."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, col, select

from core.database import get_session
from models.hockey import HockeyPublicationComp, HockeyPublicationCompTag, HockeyPublicationTag
from models.hockey_discovery import (
    HockeyClub,
    HockeyCompetition,
    HockeyPoule,
    HockeyPouleMatch,
    HockeyPouleStanding,
    HockeyTeam,
)

router = APIRouter(prefix="/api/hockey", tags=["hockey-query"])

STAT_FIELDS = {
    "points":    lambda r: r.points,
    "goal_diff": lambda r: r.goals_for - r.goals_against,
    "goals_for": lambda r: r.goals_for,
    "won":       lambda r: r.won,
}


def _scoped_poules(session: Session, tid: str, tag: Optional[str]):
    """Poules (+ hun competitie) van alle zichtbare comp-koppelingen in een publicatie, evt. gefilterd op tag-naam."""
    links = session.exec(
        select(HockeyPublicationComp)
        .where(HockeyPublicationComp.publication_id == tid)
        .where(HockeyPublicationComp.visible == True)  # noqa: E712
    ).all()

    if tag:
        ctags = session.exec(
            select(HockeyPublicationCompTag)
            .join(HockeyPublicationTag, HockeyPublicationCompTag.tag_id == HockeyPublicationTag.id)
            .where(HockeyPublicationTag.name == tag)
        ).all()
        tagged_link_ids = {ct.comp_link_id for ct in ctags}
        links = [lnk for lnk in links if lnk.id in tagged_link_ids]

    comp_ids = [lnk.competition_id for lnk in links]
    if not comp_ids:
        return []
    comps = {
        c.id: c for c in session.exec(
            select(HockeyCompetition).where(col(HockeyCompetition.id).in_(comp_ids))
        ).all()
    }
    poules = session.exec(
        select(HockeyPoule).where(col(HockeyPoule.competition_id).in_(comp_ids))
    ).all()
    return [(p, comps.get(p.competition_id)) for p in poules]


def _teams_and_clubs(session: Session, team_ids: list):
    if not team_ids:
        return {}, {}
    teams = {
        t.team_id: t for t in session.exec(
            select(HockeyTeam).where(col(HockeyTeam.team_id).in_(team_ids))
        ).all()
    }
    club_ext_ids = [t.club_external_id for t in teams.values()]
    clubs = {
        c.external_id: c for c in session.exec(
            select(HockeyClub).where(col(HockeyClub.external_id).in_(club_ext_ids))
        ).all()
    } if club_ext_ids else {}
    return teams, clubs


@router.get("/public/tournaments/{tid}/query/ranking")
def get_tag_ranking(
    tid: str,
    tag: Optional[str] = None,
    stat: str = "points",
    limit: int = 3,
    session: Session = Depends(get_session),
):
    """Cross-poule ranglijst (top-N) voor een niveau-tag binnen een publicatie."""
    if stat not in STAT_FIELDS:
        raise HTTPException(400, "Onbekende stat")
    limit = max(1, min(limit, 20))

    scoped = _scoped_poules(session, tid, tag)
    if not scoped:
        return {"tag": tag, "stat": stat, "rows": []}

    poule_ext_ids = [p.poule_id for p, _ in scoped]
    poule_by_ext = {p.poule_id: (p, comp) for p, comp in scoped}
    standings = session.exec(
        select(HockeyPouleStanding).where(col(HockeyPouleStanding.poule_id).in_(poule_ext_ids))
    ).all()

    teams, clubs = _teams_and_clubs(session, [r.team_id for r in standings])
    ranked = sorted(standings, key=STAT_FIELDS[stat], reverse=True)[:limit]

    rows = []
    for i, r in enumerate(ranked):
        poule, comp = poule_by_ext.get(r.poule_id, (None, None))
        team = teams.get(r.team_id)
        club = clubs.get(team.club_external_id) if team else None
        rows.append({
            "rank":             i + 1,
            "team_name":        r.team_name,
            "club_logo_url":    club.logo_url if club else None,
            "poule_name":       poule.name if poule else None,
            "competition_name": comp.name if comp else None,
            "points":           r.points,
            "won":              r.won,
            "drawn":            r.drawn,
            "lost":             r.lost,
            "gf":               r.goals_for,
            "ga":               r.goals_against,
            "goal_diff":        r.goals_for - r.goals_against,
        })
    return {"tag": tag, "stat": stat, "rows": rows}


@router.get("/public/tournaments/{tid}/query/round-scorers")
def get_tag_round_scorers(
    tid: str,
    tag: Optional[str] = None,
    limit: int = 3,
    session: Session = Depends(get_session),
):
    """Topscorers van de laatst afgeronde ronde (per poule) voor een niveau-tag binnen een publicatie."""
    limit = max(1, min(limit, 20))

    scoped = _scoped_poules(session, tid, tag)
    if not scoped:
        return {"tag": tag, "rows": []}

    poule_ext_ids = [p.poule_id for p, _ in scoped]
    poule_by_ext = {p.poule_id: (p, comp) for p, comp in scoped}
    matches = session.exec(
        select(HockeyPouleMatch)
        .where(col(HockeyPouleMatch.poule_id).in_(poule_ext_ids))
        .where(HockeyPouleMatch.status == "finished")
    ).all()

    last_round: dict = {}
    for m in matches:
        if m.round is None:
            continue
        if m.round > last_round.get(m.poule_id, -1):
            last_round[m.poule_id] = m.round

    totals: dict = {}  # (poule_ext_id, team_id) -> {team_name, goals}
    for m in matches:
        if last_round.get(m.poule_id) != m.round:
            continue
        if m.home_team_id is not None and m.home_score is not None:
            entry = totals.setdefault((m.poule_id, m.home_team_id), {"team_name": m.home_team_name, "goals": 0})
            entry["goals"] += m.home_score
        if m.away_team_id is not None and m.away_score is not None:
            entry = totals.setdefault((m.poule_id, m.away_team_id), {"team_name": m.away_team_name, "goals": 0})
            entry["goals"] += m.away_score

    teams, clubs = _teams_and_clubs(session, [team_id for (_, team_id) in totals.keys()])
    ranked = sorted(totals.items(), key=lambda kv: kv[1]["goals"], reverse=True)[:limit]

    rows = []
    for i, ((poule_ext_id, team_id), data) in enumerate(ranked):
        poule, comp = poule_by_ext.get(poule_ext_id, (None, None))
        team = teams.get(team_id)
        club = clubs.get(team.club_external_id) if team else None
        rows.append({
            "rank":             i + 1,
            "team_name":        data["team_name"],
            "club_logo_url":    club.logo_url if club else None,
            "poule_name":       poule.name if poule else None,
            "competition_name": comp.name if comp else None,
            "goals":            data["goals"],
            "round":            last_round.get(poule_ext_id),
        })
    return {"tag": tag, "rows": rows}
