"""Tournix — shared utility functions."""

from sqlmodel import Session, select
from models.tournix import TournixTeam, TournixMatch, TournixPool, TournixPhase


def calc_match_stats(matches, teams) -> dict:
    """Pure stats calculation: takes pre-fetched matches and teams, returns dict keyed by team_id."""
    stats = {
        t.id: {"pts": 0, "won": 0, "draw": 0, "lost": 0, "gf": 0, "ga": 0, "played": 0}
        for t in teams
    }
    for m in matches:
        if m.score_a is None or m.score_b is None:
            continue
        a, b = stats.get(m.team_a_id), stats.get(m.team_b_id)
        if not a or not b:
            continue
        a["played"] += 1; b["played"] += 1
        a["gf"] += m.score_a; a["ga"] += m.score_b
        b["gf"] += m.score_b; b["ga"] += m.score_a
        if m.score_a > m.score_b:
            a["won"] += 1; a["pts"] += 3; b["lost"] += 1
        elif m.score_a < m.score_b:
            b["won"] += 1; b["pts"] += 3; a["lost"] += 1
        else:
            a["draw"] += 1; a["pts"] += 1; b["draw"] += 1; b["pts"] += 1
    return stats


def _round_robin_pairs(teams):
    """Circle method: returns list of rounds, each round is list of (team_a, team_b) tuples."""
    lst = list(teams)
    if len(lst) % 2 == 1:
        lst.append(None)
    n = len(lst)
    rounds = []
    for _ in range(n - 1):
        round_pairs = [(lst[i], lst[n - 1 - i]) for i in range(n // 2) if lst[i] and lst[n - 1 - i]]
        rounds.append(round_pairs)
        lst = [lst[0]] + [lst[-1]] + lst[1:-1]
    return rounds


def calc_standings(tid: str, session: Session, phase_id: str | None = None) -> list[dict]:
    """Calculate standings for a tournament, filtered to a specific phase.

    If phase_id is None, uses the first pool-type phase (or all pool matches as fallback).
    """
    if phase_id is None:
        first_phase = session.exec(
            select(TournixPhase)
            .where(TournixPhase.tournament_id == tid, TournixPhase.phase_type == "pool")
            .order_by(TournixPhase.order, TournixPhase.created_at)
        ).first()
        if first_phase:
            phase_id = first_phase.id

    teams = session.exec(
        select(TournixTeam).where(
            TournixTeam.tournament_id == tid,
            TournixTeam.is_placeholder == False,  # noqa: E712
        )
    ).all()

    if phase_id:
        matches = session.exec(
            select(TournixMatch)
            .where(
                TournixMatch.tournament_id == tid,
                TournixMatch.phase_id == phase_id,
                TournixMatch.status == "finished",
            )
        ).all()
        pools_by_id = {
            p.id: p.name
            for p in session.exec(select(TournixPool).where(TournixPool.phase_id == phase_id)).all()
        }
    else:
        matches = session.exec(
            select(TournixMatch)
            .where(
                TournixMatch.tournament_id == tid,
                TournixMatch.match_type == "pool",
                TournixMatch.status == "finished",
            )
        ).all()
        pools_by_id = {
            p.id: p.name
            for p in session.exec(select(TournixPool).where(TournixPool.tournament_id == tid)).all()
        }

    raw = calc_match_stats(matches, teams)

    result = []
    for t in teams:
        s = raw[t.id]
        result.append({
            "id": t.id, "name": t.name, "short_name": t.short_name, "color": t.color,
            "pool_id": t.pool_id,
            "pool_name": pools_by_id.get(t.pool_id) if t.pool_id else None,
            **s,
        })

    return sorted(result, key=lambda x: (-x["pts"], -(x["gf"] - x["ga"]), -x["gf"]))
