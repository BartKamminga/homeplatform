"""Tournix — publicatie CRUD en competitie-koppelingen."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from core.database import get_session
from core.auth import get_current_user, require_admin
from core.crud import get_or_404
from core.logging import log_action
from models.core import User
from models.tournix import (
    Tournament,
    TournixPool, TournixTeam, TournixField, TournixMatch,
    TournixPrediction, TournixSnapshot, TournixPhase,
    TournixPhaseTeam, TournixPhaseField,
    TournixTournamentFase,
)

router = APIRouter(prefix="/api/tournix", tags=["tournix"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class TournamentCreate(BaseModel):
    name:        str
    season:      Optional[str] = None
    description: Optional[str] = None

class TournamentUpdate(BaseModel):
    name:        Optional[str]  = None
    season:      Optional[str]  = None
    description: Optional[str]  = None
    status:      Optional[str]  = None
    order:       Optional[int]  = None
    published:   Optional[bool] = None
    info:        Optional[str]  = None

class TournamentsReorder(BaseModel):
    ids: list


# ── Tournament endpoints ──────────────────────────────────────────────────────

@router.get("/tournaments")
def list_tournaments(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    tournaments = session.exec(
        select(Tournament).order_by(Tournament.order, Tournament.created_at.desc())
    ).all()
    return tournaments


@router.get("/tournaments/{tid}")
def get_tournament(
    tid: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return get_or_404(session, Tournament, tid, "Publicatie")


@router.post("/tournaments", status_code=201)
def create_tournament(
    body: TournamentCreate,
    session: Session = Depends(get_session),
    user: User = Depends(require_admin),
):
    t = Tournament(**body.model_dump(exclude_none=True), created_by=user.id)
    session.add(t)
    session.commit()
    session.refresh(t)
    log_action(session, "tournix.tournament.create", user_id=user.id, payload={"name": t.name})
    return t


@router.patch("/tournaments/reorder")
def reorder_tournaments(
    body: TournamentsReorder,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    for i, tid in enumerate(body.ids):
        t = session.get(Tournament, tid)
        if t:
            t.order = i
            session.add(t)
    session.commit()
    return {"ok": True}


@router.patch("/tournaments/{tid}")
def update_tournament(
    tid: str,
    body: TournamentUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(require_admin),
):
    t = get_or_404(session, Tournament, tid, "Publicatie")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(t, k, v)
    session.add(t)
    session.commit()
    session.refresh(t)
    return t


@router.delete("/tournaments/{tid}", status_code=204)
def delete_tournament(tid: str, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    t = get_or_404(session, Tournament, tid, "Toernooi")
    for fase in session.exec(select(TournixTournamentFase).where(TournixTournamentFase.tournament_id == tid)).all():
        session.delete(fase)
    # Oud materiaal dat nog in de DB kan zitten
    matches = session.exec(select(TournixMatch).where(TournixMatch.tournament_id == tid)).all()
    for m in matches:
        for p in session.exec(select(TournixPrediction).where(TournixPrediction.match_id == m.id)).all():
            session.delete(p)
        session.delete(m)
    for snap in session.exec(select(TournixSnapshot).where(TournixSnapshot.tournament_id == tid)).all():
        session.delete(snap)
    for phase in session.exec(select(TournixPhase).where(TournixPhase.tournament_id == tid)).all():
        for pt in session.exec(select(TournixPhaseTeam).where(TournixPhaseTeam.phase_id == phase.id)).all():
            session.delete(pt)
        for pf in session.exec(select(TournixPhaseField).where(TournixPhaseField.phase_id == phase.id)).all():
            session.delete(pf)
        session.delete(phase)
    for team in session.exec(select(TournixTeam).where(TournixTeam.tournament_id == tid)).all():
        session.delete(team)
    for field in session.exec(select(TournixField).where(TournixField.tournament_id == tid)).all():
        session.delete(field)
    for pool in session.exec(select(TournixPool).where(TournixPool.tournament_id == tid)).all():
        session.delete(pool)
    session.delete(t)
    session.commit()


# ── Eigen fase-lijst per publicatie ───────────────────────────────────────────

class TournamentFaseCreate(BaseModel):
    name:  str
    order: int = 0


@router.get("/tournaments/{tid}/fases")
def list_tournament_fases(
    tid: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    get_or_404(session, Tournament, tid, "Publicatie")
    return session.exec(
        select(TournixTournamentFase)
        .where(TournixTournamentFase.tournament_id == tid)
        .order_by(TournixTournamentFase.order, TournixTournamentFase.name)
    ).all()


@router.post("/tournaments/{tid}/fases", status_code=201)
def add_tournament_fase(
    tid: str,
    body: TournamentFaseCreate,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    get_or_404(session, Tournament, tid, "Publicatie")
    fase = TournixTournamentFase(tournament_id=tid, name=body.name.strip(), order=body.order)
    session.add(fase)
    session.commit()
    session.refresh(fase)
    return fase


@router.delete("/tournaments/{tid}/fases/{fase_id}", status_code=204)
def remove_tournament_fase(
    tid: str,
    fase_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    fase = session.get(TournixTournamentFase, fase_id)
    if not fase or fase.tournament_id != tid:
        raise HTTPException(404, "Fase niet gevonden")
    session.delete(fase)
    session.commit()


