"""Poulebord — query-templates op niveau-tag (ranglijst + rondehighlights)."""

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

# stat -> (sleutel-functie, reverse) — reverse=True is "hoogste eerst"
RANKING_STATS = {
    "points":        (lambda r: r.points, True),
    "goal_diff":     (lambda r: r.goals_for - r.goals_against, True),
    "goals_for":     (lambda r: r.goals_for, True),
    "goals_against": (lambda r: r.goals_against, False),
    "won":           (lambda r: r.won, True),
    "drawn":         (lambda r: r.drawn, True),
}

ROUND_TEAM_STATS = {"goals_for", "goals_against"}
ROUND_MATCH_STATS = {"biggest_margin", "closest_match"}


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


def _last_round_finished_matches(session: Session, poule_ext_ids: list):
    """Alle afgeronde wedstrijden van de laatst gespeelde ronde, per poule."""
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

    return [m for m in matches if last_round.get(m.poule_id) == m.round], last_round


@router.get("/public/tournaments/{tid}/query/ranking")
def get_tag_ranking(
    tid: str,
    tag: Optional[str] = None,
    stat: str = "points",
    limit: int = 3,
    session: Session = Depends(get_session),
):
    """Cross-poule ranglijst (top-N) voor een niveau-tag binnen een publicatie."""
    if stat not in RANKING_STATS:
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
    key_func, reverse = RANKING_STATS[stat]
    ranked = sorted(standings, key=key_func, reverse=reverse)[:limit]

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
            "goals_for":        r.goals_for,
            "goals_against":    r.goals_against,
            "goal_diff":        r.goals_for - r.goals_against,
        })
    return {"tag": tag, "stat": stat, "rows": rows}


@router.get("/public/tournaments/{tid}/query/round-scorers")
def get_tag_round_scorers(
    tid: str,
    tag: Optional[str] = None,
    stat: str = "goals_for",
    limit: int = 3,
    session: Session = Depends(get_session),
):
    """Team-ranglijst van de laatst afgeronde ronde (per poule): meeste doelpunten voor of tegen."""
    if stat not in ROUND_TEAM_STATS:
        raise HTTPException(400, "Onbekende stat")
    limit = max(1, min(limit, 20))

    scoped = _scoped_poules(session, tid, tag)
    if not scoped:
        return {"tag": tag, "stat": stat, "rows": []}

    poule_ext_ids = [p.poule_id for p, _ in scoped]
    poule_by_ext = {p.poule_id: (p, comp) for p, comp in scoped}
    matches, last_round = _last_round_finished_matches(session, poule_ext_ids)

    totals: dict = {}  # (poule_ext_id, team_id) -> {team_name, goals_for, goals_against}
    for m in matches:
        if m.home_team_id is not None and m.home_score is not None and m.away_score is not None:
            entry = totals.setdefault(
                (m.poule_id, m.home_team_id),
                {"team_name": m.home_team_name, "goals_for": 0, "goals_against": 0},
            )
            entry["goals_for"] += m.home_score
            entry["goals_against"] += m.away_score
        if m.away_team_id is not None and m.away_score is not None and m.home_score is not None:
            entry = totals.setdefault(
                (m.poule_id, m.away_team_id),
                {"team_name": m.away_team_name, "goals_for": 0, "goals_against": 0},
            )
            entry["goals_for"] += m.away_score
            entry["goals_against"] += m.home_score

    teams, clubs = _teams_and_clubs(session, [team_id for (_, team_id) in totals.keys()])
    reverse = stat == "goals_for"
    ranked = sorted(totals.items(), key=lambda kv: kv[1][stat], reverse=reverse)[:limit]

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
            "goals_for":        data["goals_for"],
            "goals_against":    data["goals_against"],
            "round":            last_round.get(poule_ext_id),
        })
    return {"tag": tag, "stat": stat, "rows": rows}


@router.get("/public/tournaments/{tid}/query/round-matches")
def get_tag_round_matches(
    tid: str,
    tag: Optional[str] = None,
    stat: str = "biggest_margin",
    limit: int = 3,
    session: Session = Depends(get_session),
):
    """Match-highlights van de laatst afgeronde ronde: grootste overwinning of spannendste wedstrijd."""
    if stat not in ROUND_MATCH_STATS:
        raise HTTPException(400, "Onbekende stat")
    limit = max(1, min(limit, 20))

    scoped = _scoped_poules(session, tid, tag)
    if not scoped:
        return {"tag": tag, "stat": stat, "rows": []}

    poule_ext_ids = [p.poule_id for p, _ in scoped]
    poule_by_ext = {p.poule_id: (p, comp) for p, comp in scoped}
    matches, last_round = _last_round_finished_matches(session, poule_ext_ids)

    candidates = []
    for m in matches:
        if m.home_score is None or m.away_score is None:
            continue
        margin = abs(m.home_score - m.away_score)
        if stat == "closest_match" and margin == 0:
            continue  # gelijkspel telt niet mee als "spannendste wedstrijd"
        candidates.append((m, margin))

    reverse = stat == "biggest_margin"
    ranked = sorted(candidates, key=lambda mm: mm[1], reverse=reverse)[:limit]

    rows = []
    for i, (m, margin) in enumerate(ranked):
        poule, comp = poule_by_ext.get(m.poule_id, (None, None))
        rows.append({
            "rank":             i + 1,
            "home_team":        m.home_team_name,
            "away_team":        m.away_team_name,
            "home_score":       m.home_score,
            "away_score":       m.away_score,
            "margin":           margin,
            "poule_name":       poule.name if poule else None,
            "competition_name": comp.name if comp else None,
            "round":            last_round.get(m.poule_id),
        })
    return {"tag": tag, "stat": stat, "rows": rows}
