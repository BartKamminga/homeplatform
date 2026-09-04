"""Poulebord — query-templates op niveau-tag (ranglijst + rondehighlights)."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, col, select

from core.database import get_session
from models.hockey_discovery import HockeyPouleMatch, HockeyPouleStanding
from services.hockey_query_scope import (
    ALL_RANKING_STATS,
    RANKING_STATS,
    ROUND_MATCH_STATS,
    ROUND_TEAM_STATS,
    compute_win_streaks,
    finished_matches,
    last_round_only,
    scoped_matches,
    scoped_poules,
)
from services.hockey_teams import resolve_team_clubs, club_logo_for_team

router = APIRouter(prefix="/api/hockey", tags=["hockey-query"])


@router.get("/public/tournaments/{tid}/query/ranking")
def get_tag_ranking(
    tid: str,
    tag: Optional[List[str]] = Query(None),
    stat: str = "points",
    limit: int = 3,
    session: Session = Depends(get_session),
):
    """Cross-poule ranglijst (top-N) voor een publicatie, evt. gefilterd op 1+ niveau-tags (AND)."""
    if stat not in ALL_RANKING_STATS:
        raise HTTPException(400, "Onbekende stat")
    limit = max(1, min(limit, 20))

    scoped = scoped_poules(session, tid, tag)
    if not scoped:
        return {"tags": tag, "stat": stat, "rows": []}

    poule_ext_ids = [p.poule_id for p, _ in scoped]
    poule_by_ext = {p.poule_id: (p, comp) for p, comp in scoped}
    standings = session.exec(
        select(HockeyPouleStanding).where(col(HockeyPouleStanding.poule_id).in_(poule_ext_ids))
    ).all()

    teams, clubs = resolve_team_clubs(session, [r.team_id for r in standings])

    if stat == "streak":
        streaks = compute_win_streaks(session, poule_ext_ids)
        ranked = sorted(
            (r for r in standings if (r.poule_id, r.team_id) in streaks),
            key=lambda r: streaks[(r.poule_id, r.team_id)],
            reverse=True,
        )[:limit]
    else:
        streaks = {}
        key_func, reverse = RANKING_STATS[stat]
        ranked = sorted(standings, key=key_func, reverse=reverse)[:limit]

    rows = []
    for i, r in enumerate(ranked):
        poule, comp = poule_by_ext.get(r.poule_id, (None, None))
        rows.append({
            "rank":             i + 1,
            "team_name":        r.team_name,
            "club_logo_url":    club_logo_for_team(teams, clubs, r.team_id),
            "poule_name":       poule.name if poule else None,
            "competition_name": comp.name if comp else None,
            "points":           r.points,
            "won":              r.won,
            "drawn":            r.drawn,
            "lost":             r.lost,
            "goals_for":        r.goals_for,
            "goals_against":    r.goals_against,
            "goal_diff":        r.goals_for - r.goals_against,
            "streak":           streaks.get((r.poule_id, r.team_id), 0),
        })
    return {"tags": tag, "stat": stat, "rows": rows}


@router.get("/public/tournaments/{tid}/query/round-scorers")
def get_tag_round_scorers(
    tid: str,
    tag: Optional[List[str]] = Query(None),
    stat: str = "goals_for",
    limit: int = 3,
    session: Session = Depends(get_session),
):
    """Team-ranglijst: meeste doelpunten voor of tegen in de laatste gespeelde ronde.

    Alleen 'laatste ronde' (geen seizoensvariant): de seizoenstotalen staan al
    op de ranking-template (goals_for/goals_against-stat) - dat zou hier een
    letterlijk duplicaat zijn."""
    if stat not in ROUND_TEAM_STATS:
        raise HTTPException(400, "Onbekende stat")
    limit = max(1, min(limit, 20))

    scoped = scoped_poules(session, tid, tag)
    if not scoped:
        return {"tags": tag, "stat": stat, "rows": []}

    poule_ext_ids = [p.poule_id for p, _ in scoped]
    poule_by_ext = {p.poule_id: (p, comp) for p, comp in scoped}
    matches, last_round = last_round_only(finished_matches(session, poule_ext_ids))

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

    teams, clubs = resolve_team_clubs(session, [team_id for (_, team_id) in totals])
    reverse = stat == "goals_for"
    ranked = sorted(totals.items(), key=lambda kv: kv[1][stat], reverse=reverse)[:limit]

    rows = []
    for i, ((poule_ext_id, team_id), data) in enumerate(ranked):
        poule, comp = poule_by_ext.get(poule_ext_id, (None, None))
        rows.append({
            "rank":             i + 1,
            "team_name":        data["team_name"],
            "club_logo_url":    club_logo_for_team(teams, clubs, team_id),
            "poule_name":       poule.name if poule else None,
            "competition_name": comp.name if comp else None,
            "goals_for":        data["goals_for"],
            "goals_against":    data["goals_against"],
            "round":            last_round.get(poule_ext_id),
        })
    return {"tags": tag, "stat": stat, "rows": rows}


@router.get("/public/tournaments/{tid}/query/round-matches")
def get_tag_round_matches(
    tid: str,
    tag: Optional[List[str]] = Query(None),
    stat: str = "biggest_margin",
    scope: str = "round",
    limit: int = 3,
    session: Session = Depends(get_session),
):
    """Match-highlights: grootste overwinning of spannendste wedstrijd, over de laatste ronde of het hele seizoen."""
    if stat not in ROUND_MATCH_STATS:
        raise HTTPException(400, "Onbekende stat")
    if scope not in ("round", "season"):
        raise HTTPException(400, "Onbekende scope")
    limit = max(1, min(limit, 20))

    scoped = scoped_poules(session, tid, tag)
    if not scoped:
        return {"tags": tag, "stat": stat, "scope": scope, "rows": []}

    poule_ext_ids = [p.poule_id for p, _ in scoped]
    poule_by_ext = {p.poule_id: (p, comp) for p, comp in scoped}
    matches, _ = scoped_matches(session, poule_ext_ids, scope)

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
            "round":            m.round,
        })
    return {"tags": tag, "stat": stat, "scope": scope, "rows": rows}


@router.get("/public/tournaments/{tid}/query/upcoming-matches")
def get_upcoming_matches(
    tid: str,
    tag: Optional[List[str]] = Query(None),
    limit: int = 3,
    session: Session = Depends(get_session),
):
    """Belangrijke nog te spelen wedstrijd: 1 lijst, elke rij getagd met het type belang.

    Item 672: voorheen 2 losse stats (rank_gap/point_gap) die vaak identiek
    ogende kaarten opleverden. Nu 1 gecombineerde lijst: een wedstrijd doet mee
    als de twee teams aangrenzend staan in de ranglijst ("positie", zeker
    zwaar wegend rond plek 1) of gelijk staan in punten ("punten") - een
    wedstrijd kan allebei zijn."""
    limit = max(1, min(limit, 20))

    scoped = scoped_poules(session, tid, tag)
    if not scoped:
        return {"tags": tag, "rows": []}

    poule_ext_ids = [p.poule_id for p, _ in scoped]
    poule_by_ext = {p.poule_id: (p, comp) for p, comp in scoped}

    scheduled = session.exec(
        select(HockeyPouleMatch)
        .where(col(HockeyPouleMatch.poule_id).in_(poule_ext_ids))
        .where(HockeyPouleMatch.status != "final")
    ).all()
    if not scheduled:
        return {"tags": tag, "rows": []}

    standings = session.exec(
        select(HockeyPouleStanding).where(col(HockeyPouleStanding.poule_id).in_(poule_ext_ids))
    ).all()
    standing_by_team = {(s.poule_id, s.team_id): s for s in standings}

    candidates = []
    for m in scheduled:
        if m.home_team_id is None or m.away_team_id is None:
            continue
        home = standing_by_team.get((m.poule_id, m.home_team_id))
        away = standing_by_team.get((m.poule_id, m.away_team_id))
        if not home or not away or home.position is None or away.position is None:
            continue
        rank_gap = abs(home.position - away.position)
        point_gap = abs(home.points - away.points)
        is_position_battle = rank_gap <= 1
        is_points_tie = point_gap == 0
        if not (is_position_battle or is_points_tie):
            continue
        if is_position_battle and is_points_tie:
            type_label = "positie + punten"
        elif is_position_battle:
            type_label = "positie"
        else:
            type_label = "punten"
        top_position = min(home.position, away.position)
        candidates.append((m, home, away, rank_gap, point_gap, type_label, top_position))

    candidates.sort(key=lambda c: (c[6], c[3], c[4], c[0].match_date or ""))
    ranked = candidates[:limit]

    rows = []
    for i, (m, home, away, rank_gap, point_gap, type_label, _) in enumerate(ranked):
        poule, comp = poule_by_ext.get(m.poule_id, (None, None))
        rows.append({
            "rank":             i + 1,
            "home_team":        m.home_team_name,
            "away_team":        m.away_team_name,
            "home_position":    home.position,
            "away_position":    away.position,
            "home_points":      home.points,
            "away_points":      away.points,
            "type":             type_label,
            "match_date":       m.match_date,
            "poule_name":       poule.name if poule else None,
            "competition_name": comp.name if comp else None,
        })
    return {"tags": tag, "rows": rows}


@router.get("/public/tournaments/{tid}/query/live-matches")
def get_live_matches(
    tid: str,
    tag: Optional[List[str]] = Query(None),
    session: Session = Depends(get_session),
):
    """Wedstrijden die nu live staan (status=live) binnen een publicatie - item 1079,
    voor de Poulebord live-knop. Zelfde gebatchde scoped_poules-opzet als de andere
    query-templates hierboven (item 1076-patroon): geen N+1, ongeacht hoeveel
    poules de publicatie heeft."""
    scoped = scoped_poules(session, tid, tag)
    if not scoped:
        return {"tags": tag, "rows": []}

    poule_ext_ids = [p.poule_id for p, _ in scoped]
    poule_by_ext = {p.poule_id: (p, comp) for p, comp in scoped}

    live = session.exec(
        select(HockeyPouleMatch)
        .where(col(HockeyPouleMatch.poule_id).in_(poule_ext_ids))
        .where(HockeyPouleMatch.status == "live")
        .order_by(HockeyPouleMatch.match_date)
    ).all()
    if not live:
        return {"tags": tag, "rows": []}

    rows = []
    for m in live:
        poule, comp = poule_by_ext.get(m.poule_id, (None, None))
        rows.append({
            "match_id":         m.match_id,
            "home_team":        m.home_team_name,
            "away_team":        m.away_team_name,
            "home_score":       m.home_score,
            "away_score":       m.away_score,
            "match_date":       m.match_date,
            "poule_name":       poule.name if poule else None,
            "competition_name": comp.name if comp else None,
        })
    return {"tags": tag, "rows": rows}


@router.get("/public/tournaments/{tid}/query/club-ranking")
def get_club_ranking(
    tid: str,
    tag: Optional[List[str]] = Query(None),
    limit: int = 3,
    session: Session = Depends(get_session),
):
    """Welke club heeft de meeste teams binnen 1 of meer niveau-tags."""
    limit = max(1, min(limit, 20))

    scoped = scoped_poules(session, tid, tag)
    if not scoped:
        return {"tags": tag, "rows": []}

    poule_ext_ids = [p.poule_id for p, _ in scoped]
    standings = session.exec(
        select(HockeyPouleStanding).where(col(HockeyPouleStanding.poule_id).in_(poule_ext_ids))
    ).all()
    team_ids = list({s.team_id for s in standings})
    teams, clubs = resolve_team_clubs(session, team_ids)

    counts: dict = {}
    for team_id in team_ids:
        team = teams.get(team_id)
        if not team:
            continue
        counts[team.club_external_id] = counts.get(team.club_external_id, 0) + 1

    ranked = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    rows = []
    for i, (club_ext_id, count) in enumerate(ranked):
        club = clubs.get(club_ext_id)
        rows.append({
            "rank":          i + 1,
            "club_name":     club.friendly_name if club else club_ext_id,
            "club_logo_url": club.logo_url if club else None,
            "team_count":    count,
        })
    return {"tags": tag, "rows": rows}
