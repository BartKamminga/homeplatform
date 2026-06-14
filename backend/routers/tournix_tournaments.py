"""Tournix — tournament CRUD, stages, import."""

from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from core.database import get_session
from core.auth import get_current_user, require_admin
from core.crud import get_or_404
from core.logging import log_action
from models.core import User
from models.tournix import (
    Tournament, TournixClub, TournixPool, TournixTeam,
    TournixField, TournixMatch, TournixPrediction, TournixSnapshot,
    TournixPhase, TournixPhaseTeam, TournixPhaseField,
)

router = APIRouter(prefix="/api/tournix", tags=["tournix"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class TournamentCreate(BaseModel):
    name:             str
    date:             Optional[datetime] = None
    location:         Optional[str]      = None
    location_club_id: Optional[str]      = None
    description:      Optional[str]      = None
    group_id:         Optional[str]      = None

class TournamentUpdate(BaseModel):
    name:             Optional[str]      = None
    date:             Optional[datetime] = None
    location:         Optional[str]      = None
    location_club_id: Optional[str]      = None
    description:      Optional[str]      = None
    status:           Optional[str]      = None
    stage:            Optional[str]      = None
    num_pools:        Optional[int]      = None
    pool_type:        Optional[str]      = None
    knockout_type:    Optional[str]      = None
    knockout_advance: Optional[int]      = None

class ImportPoolTeam(BaseModel):
    name:  str
    club:  Optional[str] = None
    color: Optional[str] = None

class ImportPool(BaseModel):
    name:  str
    teams: list[ImportPoolTeam] = []

class ImportField(BaseModel):
    name: str
    club: Optional[str] = None

class ImportMatch(BaseModel):
    team_a:     str
    team_b:     str
    pool:       Optional[str] = None
    round:      Optional[int] = None
    field:      Optional[str] = None
    time:       Optional[str] = None
    match_type: str = "pool"
    score_a:    Optional[int] = None
    score_b:    Optional[int] = None
    status:     str = "scheduled"

class ImportPayload(BaseModel):
    name:          str
    date:          Optional[str] = None
    location_club: Optional[str] = None
    pool_type:     str = "half"
    pools:         list[ImportPool]  = []
    fields:        list[ImportField] = []
    matches:       list[ImportMatch] = []


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/tournaments")
def list_tournaments(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return session.exec(select(Tournament).order_by(Tournament.created_at.desc())).all()


@router.get("/tournaments/{tid}")
def get_tournament(
    tid: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return get_or_404(session, Tournament, tid, "Toernooi")


@router.post("/tournaments", status_code=201)
def create_tournament(
    body: TournamentCreate,
    session: Session = Depends(get_session),
    user: User = Depends(require_admin),
):
    t = Tournament(**body.model_dump(), created_by=user.id)
    session.add(t)
    session.commit()
    session.refresh(t)
    log_action(session, "tournix.tournament.create", user_id=user.id, payload={"name": t.name})
    return t


@router.patch("/tournaments/{tid}")
def update_tournament(
    tid: str,
    body: TournamentUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(require_admin),
):
    t = get_or_404(session, Tournament, tid, "Toernooi")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(t, k, v)
    session.add(t)
    session.commit()
    session.refresh(t)
    return t


@router.post("/tournaments/{tid}/copy", status_code=201)
def copy_tournament(
    tid: str,
    session: Session = Depends(get_session),
    user: User = Depends(require_admin),
):
    """Kopieer toernooistructuur (teams, poules, velden) zonder wedstrijden en scores."""
    orig = get_or_404(session, Tournament, tid, "Toernooi")

    new_t = Tournament(
        name=f"{orig.name} (kopie)",
        date=orig.date,
        location=orig.location,
        location_club_id=orig.location_club_id,
        description=orig.description,
        status="draft",
        stage="inregel",
        num_pools=orig.num_pools,
        pool_type=orig.pool_type,
        knockout_type=orig.knockout_type,
        knockout_advance=orig.knockout_advance,
        created_by=user.id,
    )
    session.add(new_t)
    session.flush()

    old_pools = session.exec(
        select(TournixPool).where(TournixPool.tournament_id == tid).order_by(TournixPool.order)
    ).all()
    pool_id_map: dict[str, str] = {}
    for p in old_pools:
        new_p = TournixPool(tournament_id=new_t.id, name=p.name, order=p.order)
        session.add(new_p)
        session.flush()
        pool_id_map[p.id] = new_p.id

    team_id_map: dict[str, str] = {}
    for team in session.exec(select(TournixTeam).where(TournixTeam.tournament_id == tid)).all():
        if team.is_placeholder:
            continue
        new_team = TournixTeam(
            tournament_id=new_t.id,
            name=team.name,
            short_name=team.short_name,
            color=team.color,
            pool_id=pool_id_map.get(team.pool_id) if team.pool_id else None,
            club_id=team.club_id,
        )
        session.add(new_team)
        team_id_map[team.id] = new_team.id

    for field in session.exec(select(TournixField).where(TournixField.tournament_id == tid)).all():
        session.add(TournixField(tournament_id=new_t.id, name=field.name, club_id=field.club_id))

    # Copy phases
    phase_id_map: dict[str, str] = {}
    old_phases = session.exec(
        select(TournixPhase).where(TournixPhase.tournament_id == tid).order_by(TournixPhase.order)
    ).all()
    for phase in old_phases:
        new_phase = TournixPhase(
            tournament_id=new_t.id,
            name=phase.name,
            order=phase.order,
            phase_type=phase.phase_type,
            ko_type=phase.ko_type,
            pool_type=phase.pool_type,
        )
        session.add(new_phase)
        session.flush()
        phase_id_map[phase.id] = new_phase.id

    # Backfill phase_id on pools that were linked to a phase
    for old_pid, new_pid in pool_id_map.items():
        old_p = next((p for p in old_pools if p.id == old_pid), None)
        if old_p and old_p.phase_id and old_p.phase_id in phase_id_map:
            new_p = session.get(TournixPool, new_pid)
            if new_p:
                new_p.phase_id = phase_id_map[old_p.phase_id]
                session.add(new_p)

    # Copy phase team assignments (skip placeholder teams)
    for phase in old_phases:
        new_phase_id = phase_id_map.get(phase.id)
        if not new_phase_id:
            continue
        for pt in session.exec(select(TournixPhaseTeam).where(TournixPhaseTeam.phase_id == phase.id)).all():
            new_team_id = team_id_map.get(pt.team_id)
            if not new_team_id:
                continue
            session.add(TournixPhaseTeam(
                phase_id=new_phase_id,
                team_id=new_team_id,
                group_name=pt.group_name,
            ))

    session.commit()
    session.refresh(new_t)
    return new_t


@router.delete("/tournaments/{tid}", status_code=204)
def delete_tournament(tid: str, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    t = get_or_404(session, Tournament, tid, "Toernooi")
    # Cascade: predictions → matches → snapshots → phase_teams → phases → teams → fields → pools → tournament
    matches = session.exec(select(TournixMatch).where(TournixMatch.tournament_id == tid)).all()
    for m in matches:
        preds = session.exec(select(TournixPrediction).where(TournixPrediction.match_id == m.id)).all()
        for p in preds:
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


# ── Import ────────────────────────────────────────────────────────────────────

@router.post("/import", status_code=201)
def import_tournament_data(
    payload: ImportPayload,
    session: Session = Depends(get_session),
    user: User = Depends(require_admin),
):
    """Importeer een volledig toernooi vanuit extern JSON-formaat (geen scores)."""
    all_clubs = session.exec(select(TournixClub)).all()
    club_lookup = {c.name.lower(): c.id for c in all_clubs}

    def find_club_id(name: Optional[str]) -> Optional[str]:
        return club_lookup.get(name.lower()) if name else None

    parsed_date = None
    if payload.date:
        try:
            parsed_date = datetime.fromisoformat(payload.date)
        except ValueError:
            pass

    tournament = Tournament(
        name=payload.name,
        date=parsed_date,
        location_club_id=find_club_id(payload.location_club),
        stage="inregel",
        status="active",
        num_pools=len(payload.pools),
        pool_type=payload.pool_type,
        created_by=user.id,
    )
    session.add(tournament)
    session.flush()

    pool_map: dict[str, TournixPool] = {}
    for i, p_data in enumerate(payload.pools):
        pool = TournixPool(tournament_id=tournament.id, name=p_data.name, order=i)
        session.add(pool)
        session.flush()
        pool_map[p_data.name] = pool

    team_map: dict[str, TournixTeam] = {}
    for p_data in payload.pools:
        pool = pool_map.get(p_data.name)
        for t_data in p_data.teams:
            team = TournixTeam(
                tournament_id=tournament.id,
                name=t_data.name,
                club_id=find_club_id(t_data.club),
                color=t_data.color,
                pool_id=pool.id if pool else None,
            )
            session.add(team)
            session.flush()
            team_map[t_data.name] = team

    field_map: dict[str, TournixField] = {}
    for f_data in payload.fields:
        field = TournixField(
            tournament_id=tournament.id,
            name=f_data.name,
            club_id=find_club_id(f_data.club),
        )
        session.add(field)
        session.flush()
        field_map[f_data.name] = field

    match_count = 0
    for m_data in payload.matches:
        team_a = team_map.get(m_data.team_a)
        team_b = team_map.get(m_data.team_b)
        field  = field_map.get(m_data.field) if m_data.field else None

        scheduled_at = None
        if payload.date and m_data.time:
            try:
                scheduled_at = datetime.fromisoformat(f"{payload.date}T{m_data.time}")
            except ValueError:
                pass

        has_score = m_data.score_a is not None and m_data.score_b is not None
        match = TournixMatch(
            tournament_id=tournament.id,
            team_a_id=team_a.id if team_a else None,
            team_b_id=team_b.id if team_b else None,
            field_id=field.id if field else None,
            round=m_data.round,
            scheduled_at=scheduled_at,
            match_type=m_data.match_type,
            status="finished" if has_score else m_data.status,
            score_a=m_data.score_a,
            score_b=m_data.score_b,
        )
        session.add(match)
        match_count += 1

    session.commit()
    log_action(session, "tournix.tournament.import", user_id=user.id, payload={
        "name": tournament.name, "pools": len(pool_map),
        "teams": len(team_map), "matches": match_count,
    })

    return {
        "tournament_id": tournament.id,
        "name": tournament.name,
        "pools": len(pool_map),
        "teams": len(team_map),
        "fields": len(field_map),
        "matches": match_count,
    }
