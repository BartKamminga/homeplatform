"""Tournix — pools and pool-team assignment."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from core.database import get_session
from core.auth import get_current_user, require_admin
from models.core import User
from models.tournix import Tournament, TournixPool, TournixTeam

router = APIRouter(prefix="/api/tournix", tags=["tournix"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class PoolCreate(BaseModel):
    name: str
    order: int = 0

class TeamPoolAssign(BaseModel):
    pool_id: str | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/tournaments/{tid}/pools")
def list_pools(tid: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    pools = session.exec(
        select(TournixPool).where(TournixPool.tournament_id == tid).order_by(TournixPool.order)
    ).all()
    return pools


@router.post("/tournaments/{tid}/pools", dependencies=[Depends(require_admin)])
def create_pool(tid: str, body: PoolCreate, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    pool = TournixPool(tournament_id=tid, name=body.name, order=body.order)
    session.add(pool)
    session.commit()
    session.refresh(pool)
    return pool


@router.delete("/pools/{pid}", dependencies=[Depends(require_admin)])
def delete_pool(pid: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    pool = session.get(TournixPool, pid)
    if not pool:
        raise HTTPException(404, "Poule niet gevonden")
    # Unassign teams from this pool
    teams = session.exec(select(TournixTeam).where(TournixTeam.pool_id == pid)).all()
    for t in teams:
        t.pool_id = None
        session.add(t)
    session.delete(pool)
    session.commit()
    return {"ok": True}


@router.patch("/teams/{team_id}/pool", dependencies=[Depends(require_admin)])
def assign_team_pool(team_id: str, body: TeamPoolAssign, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    team = session.get(TournixTeam, team_id)
    if not team:
        raise HTTPException(404, "Team niet gevonden")
    team.pool_id = body.pool_id
    session.add(team)
    session.commit()
    session.refresh(team)
    return team


@router.post("/tournaments/{tid}/auto-assign", dependencies=[Depends(require_admin)])
def auto_assign_pools(tid: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    """Distribute teams evenly across pools (serpentine/snake draft)."""
    tournament = session.get(Tournament, tid)
    if not tournament:
        raise HTTPException(404, "Toernooi niet gevonden")

    # Always recreate pools to match current num_pools setting
    existing_pools = session.exec(
        select(TournixPool).where(TournixPool.tournament_id == tid)
    ).all()
    for p in existing_pools:
        session.delete(p)

    # Unassign all teams first
    all_teams = session.exec(
        select(TournixTeam).where(TournixTeam.tournament_id == tid)
    ).all()
    for t in all_teams:
        t.pool_id = None
        session.add(t)

    session.commit()

    letters = "ABCDEFGH"
    for i in range(min(tournament.num_pools, 8)):
        pool = TournixPool(tournament_id=tid, name=f"Poule {letters[i]}", order=i)
        session.add(pool)
    session.commit()

    pools = session.exec(
        select(TournixPool).where(TournixPool.tournament_id == tid).order_by(TournixPool.order)
    ).all()

    teams = session.exec(
        select(TournixTeam).where(TournixTeam.tournament_id == tid).order_by(TournixTeam.created_at)
    ).all()

    n = len(pools)
    if n == 0:
        raise HTTPException(400, "Geen poules aangemaakt")

    # Serpentine: forward pass then reverse
    assignment = []
    forward = list(range(n))
    backward = list(reversed(range(n)))
    direction = forward
    i = 0
    for t in teams:
        assignment.append((t, pools[direction[i % n]]))
        i += 1
        if i % n == 0:
            direction = backward if direction is forward else forward

    for team, pool in assignment:
        team.pool_id = pool.id
        session.add(team)

    session.commit()
    return {"ok": True, "assigned": len(assignment)}
