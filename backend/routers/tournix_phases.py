"""Tournix — fases (follow-up brackets na de poule fase)."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from core.database import get_session
from core.auth import get_current_user, require_admin
from core.crud import get_or_404
from models.core import User
from models.tournix import (
    Tournament, TournixPhase, TournixPhaseTeam, TournixTeam,
    TournixField, TournixMatch, TournixPool,
)
from routers.tournix_matches import _round_robin_pairs

router = APIRouter(prefix="/api/tournix", tags=["tournix"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class PhaseCreate(BaseModel):
    name: str
    order: int = 0
    phase_type: str = "pool"  # "pool" | "ko"


class PhaseUpdate(BaseModel):
    name: Optional[str] = None
    order: Optional[int] = None
    phase_type: Optional[str] = None


class PhaseTeamIn(BaseModel):
    team_id: str
    group_name: Optional[str] = None


class PhaseTeamsBulk(BaseModel):
    teams: list[PhaseTeamIn]


class FromStandingsBody(BaseModel):
    positions: list[int]  # 1-indexed per pool, bijv. [1, 2] = top 2


# ── Helpers ───────────────────────────────────────────────────────────────────

def _calc_pool_standings(pool_id: str, pool_teams: list, pool_matches: list) -> list:
    stats = {t.id: {"team": t, "pts": 0, "gf": 0, "ga": 0} for t in pool_teams}
    for m in pool_matches:
        if m.score_a is None or m.score_b is None:
            continue
        a = stats.get(m.team_a_id)
        b = stats.get(m.team_b_id)
        if not a or not b:
            continue
        a["gf"] += m.score_a
        a["ga"] += m.score_b
        b["gf"] += m.score_b
        b["ga"] += m.score_a
        if m.score_a > m.score_b:
            a["pts"] += 3
        elif m.score_a == m.score_b:
            a["pts"] += 1
            b["pts"] += 1
        else:
            b["pts"] += 3
    return sorted(
        stats.values(),
        key=lambda s: (-s["pts"], -(s["gf"] - s["ga"]), -s["gf"])
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/tournaments/{tid}/phases")
def list_phases(tid: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    phases = session.exec(
        select(TournixPhase)
        .where(TournixPhase.tournament_id == tid)
        .order_by(TournixPhase.order, TournixPhase.created_at)
    ).all()
    result = []
    for p in phases:
        members = session.exec(
            select(TournixPhaseTeam).where(TournixPhaseTeam.phase_id == p.id)
        ).all()
        match_count = len(session.exec(
            select(TournixMatch).where(TournixMatch.phase_id == p.id)
        ).all())
        result.append({
            "id": p.id,
            "tournament_id": p.tournament_id,
            "name": p.name,
            "order": p.order,
            "phase_type": p.phase_type,
            "match_count": match_count,
            "teams": [{"team_id": m.team_id, "group_name": m.group_name} for m in members],
        })
    return result


@router.post("/tournaments/{tid}/phases", status_code=201)
def create_phase(
    tid: str,
    body: PhaseCreate,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    get_or_404(session, Tournament, tid, "Toernooi")
    phase = TournixPhase(tournament_id=tid, **body.model_dump())
    session.add(phase)
    session.commit()
    session.refresh(phase)
    return phase


@router.patch("/phases/{pid}")
def update_phase(
    pid: str,
    body: PhaseUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    phase = get_or_404(session, TournixPhase, pid, "Fase")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(phase, k, v)
    session.add(phase)
    session.commit()
    session.refresh(phase)
    return phase


@router.delete("/phases/{pid}", status_code=204)
def delete_phase(pid: str, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    phase = get_or_404(session, TournixPhase, pid, "Fase")
    for m in session.exec(select(TournixMatch).where(TournixMatch.phase_id == pid)).all():
        session.delete(m)
    for pt in session.exec(select(TournixPhaseTeam).where(TournixPhaseTeam.phase_id == pid)).all():
        session.delete(pt)
    session.delete(phase)
    session.commit()


@router.post("/phases/{pid}/teams")
def set_phase_teams(
    pid: str,
    body: PhaseTeamsBulk,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    get_or_404(session, TournixPhase, pid, "Fase")
    for pt in session.exec(select(TournixPhaseTeam).where(TournixPhaseTeam.phase_id == pid)).all():
        session.delete(pt)
    for t in body.teams:
        session.add(TournixPhaseTeam(phase_id=pid, team_id=t.team_id, group_name=t.group_name))
    session.commit()
    return {"ok": True, "count": len(body.teams)}


@router.post("/phases/{pid}/teams/from-standings")
def phase_teams_from_standings(
    pid: str,
    body: FromStandingsBody,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    """Vul teams automatisch op basis van poule-standen."""
    phase = get_or_404(session, TournixPhase, pid, "Fase")
    tid = phase.tournament_id

    pools = session.exec(
        select(TournixPool)
        .where(TournixPool.tournament_id == tid)
        .order_by(TournixPool.order)
    ).all()
    if not pools:
        raise HTTPException(400, "Geen poules gevonden")

    all_teams = session.exec(select(TournixTeam).where(TournixTeam.tournament_id == tid)).all()
    pool_teams_map = {p.id: [t for t in all_teams if t.pool_id == p.id] for p in pools}

    pool_matches = session.exec(
        select(TournixMatch).where(
            TournixMatch.tournament_id == tid,
            TournixMatch.phase_id.is_(None),
            TournixMatch.match_type == "pool",
            TournixMatch.status == "finished",
        )
    ).all()

    for pt in session.exec(select(TournixPhaseTeam).where(TournixPhaseTeam.phase_id == pid)).all():
        session.delete(pt)

    added = 0
    for pool in pools:
        ranked = _calc_pool_standings(pool.id, pool_teams_map[pool.id], pool_matches)
        for pos in body.positions:
            idx = pos - 1
            if 0 <= idx < len(ranked):
                session.add(TournixPhaseTeam(
                    phase_id=pid,
                    team_id=ranked[idx]["team"].id,
                    group_name=None,
                ))
                added += 1

    session.commit()
    return {"ok": True, "added": added}


@router.post("/phases/{pid}/generate-schedule")
def generate_phase_schedule(
    pid: str,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    """Genereer wedstrijden voor een fase (round-robin per groep, of KO)."""
    phase = get_or_404(session, TournixPhase, pid, "Fase")
    tid = phase.tournament_id

    phase_team_rows = session.exec(
        select(TournixPhaseTeam).where(TournixPhaseTeam.phase_id == pid)
    ).all()
    if not phase_team_rows:
        raise HTTPException(400, "Geen teams toegewezen aan deze fase")

    for m in session.exec(select(TournixMatch).where(TournixMatch.phase_id == pid)).all():
        session.delete(m)
    session.flush()

    fields = session.exec(select(TournixField).where(TournixField.tournament_id == tid)).all()
    field_ids = [f.id for f in fields]
    field_counter = 0
    created = 0

    groups: dict[str, list[str]] = {}
    for pt in phase_team_rows:
        key = pt.group_name or "__all__"
        if key not in groups:
            groups[key] = []
        groups[key].append(pt.team_id)

    if phase.phase_type == "pool":
        for group_name, team_ids in groups.items():
            if len(team_ids) < 2:
                continue
            teams = session.exec(
                select(TournixTeam).where(TournixTeam.id.in_(team_ids))
            ).all()
            rounds = _round_robin_pairs(teams)
            for round_idx, round_pairs in enumerate(rounds, start=1):
                for team_a, team_b in round_pairs:
                    fid = field_ids[field_counter % len(field_ids)] if field_ids else None
                    session.add(TournixMatch(
                        tournament_id=tid,
                        team_a_id=team_a.id,
                        team_b_id=team_b.id,
                        round=round_idx,
                        field_id=fid,
                        match_type="pool",
                        phase_id=pid,
                    ))
                    created += 1
                    field_counter += 1

    elif phase.phase_type == "ko":
        all_team_ids = [tid_item for ids in groups.values() for tid_item in ids]

        pool_matches = session.exec(
            select(TournixMatch).where(
                TournixMatch.tournament_id == tid,
                TournixMatch.phase_id.is_(None),
                TournixMatch.status == "finished",
            )
        ).all()
        stats: dict[str, dict] = {t: {"pts": 0, "gf": 0, "ga": 0} for t in all_team_ids}
        for m in pool_matches:
            if m.score_a is None or m.score_b is None:
                continue
            if m.team_a_id in stats:
                stats[m.team_a_id]["gf"] += m.score_a
                stats[m.team_a_id]["ga"] += m.score_b
                if m.score_a > m.score_b:
                    stats[m.team_a_id]["pts"] += 3
                elif m.score_a == m.score_b:
                    stats[m.team_a_id]["pts"] += 1
            if m.team_b_id in stats:
                stats[m.team_b_id]["gf"] += m.score_b
                stats[m.team_b_id]["ga"] += m.score_a
                if m.score_b > m.score_a:
                    stats[m.team_b_id]["pts"] += 3
                elif m.score_a == m.score_b:
                    stats[m.team_b_id]["pts"] += 1

        sorted_ids = sorted(
            all_team_ids,
            key=lambda t: (-stats[t]["pts"], -(stats[t]["gf"] - stats[t]["ga"]))
        )
        n = len(sorted_ids)
        if n < 2:
            raise HTTPException(400, "Te weinig teams voor knock-out")

        for i in range(n // 2):
            fid = field_ids[field_counter % len(field_ids)] if field_ids else None
            session.add(TournixMatch(
                tournament_id=tid,
                team_a_id=sorted_ids[i],
                team_b_id=sorted_ids[n - 1 - i],
                match_type="ko",
                phase_id=pid,
                field_id=fid,
            ))
            created += 1
            field_counter += 1

    session.commit()
    return {"created": created}


@router.get("/phases/{pid}/standings")
def get_phase_standings(
    pid: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Standen voor een specifieke fase (alleen voor round-robin fases)."""
    phase = get_or_404(session, TournixPhase, pid, "Fase")

    phase_team_rows = session.exec(
        select(TournixPhaseTeam).where(TournixPhaseTeam.phase_id == pid)
    ).all()
    team_ids = {pt.team_id for pt in phase_team_rows}

    teams = session.exec(select(TournixTeam).where(TournixTeam.id.in_(list(team_ids)))).all()
    team_map = {t.id: t for t in teams}

    phase_matches = session.exec(
        select(TournixMatch).where(
            TournixMatch.phase_id == pid,
            TournixMatch.status == "finished",
        )
    ).all()

    stats = {
        tid: {"id": tid, "name": team_map[tid].name, "pts": 0, "gf": 0, "ga": 0, "w": 0, "d": 0, "l": 0}
        for tid in team_ids
        if tid in team_map
    }

    for m in phase_matches:
        if m.score_a is None or m.score_b is None:
            continue
        a = stats.get(m.team_a_id)
        b = stats.get(m.team_b_id)
        if not a or not b:
            continue
        a["gf"] += m.score_a
        a["ga"] += m.score_b
        b["gf"] += m.score_b
        b["ga"] += m.score_a
        if m.score_a > m.score_b:
            a["w"] += 1
            a["pts"] += 3
            b["l"] += 1
        elif m.score_a == m.score_b:
            a["d"] += 1
            a["pts"] += 1
            b["d"] += 1
            b["pts"] += 1
        else:
            b["w"] += 1
            b["pts"] += 3
            a["l"] += 1

    return sorted(stats.values(), key=lambda s: (-s["pts"], -(s["gf"] - s["ga"]), -s["gf"]))
