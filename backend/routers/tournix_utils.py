"""Tournix — shared utility functions."""

from sqlmodel import Session, select
from models.tournix import TournixTeam, TournixMatch, TournixPool, TournixPhase


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

    stats = {
        t.id: {
            "id": t.id, "name": t.name, "short_name": t.short_name, "color": t.color,
            "played": 0, "won": 0, "draw": 0, "lost": 0, "gf": 0, "ga": 0, "pts": 0,
        }
        for t in teams
    }

    for m in matches:
        if m.team_a_id not in stats or m.team_b_id not in stats:
            continue
        a, b = stats[m.team_a_id], stats[m.team_b_id]
        a["played"] += 1; b["played"] += 1
        a["gf"] += m.score_a; a["ga"] += m.score_b
        b["gf"] += m.score_b; b["ga"] += m.score_a
        if m.score_a > m.score_b:
            a["won"] += 1; a["pts"] += 3; b["lost"] += 1
        elif m.score_a < m.score_b:
            b["won"] += 1; b["pts"] += 3; a["lost"] += 1
        else:
            a["draw"] += 1; a["pts"] += 1; b["draw"] += 1; b["pts"] += 1

    result = sorted(stats.values(), key=lambda x: (-x["pts"], -(x["gf"] - x["ga"]), -x["gf"]))

    for row in result:
        team = session.get(TournixTeam, row["id"])
        row["pool_id"] = team.pool_id if team else None
        row["pool_name"] = pools_by_id.get(team.pool_id) if team and team.pool_id else None

    return result
