"""Tournix router — toernooi-app."""

from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from core.database import get_session
from core.auth import get_current_user, require_admin
from core.logging import log_action
from models.core import User
from models.tournix import Tournament, TournixTeam, TournixField, TournixMatch, TournixPrediction, TournixSnapshot

router = APIRouter(prefix="/api/tournix", tags=["tournix"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class TournamentCreate(BaseModel):
    name:        str
    date:        Optional[datetime] = None
    location:    Optional[str]      = None
    description: Optional[str]      = None
    group_id:    Optional[str]      = None

class TournamentUpdate(BaseModel):
    name:        Optional[str]      = None
    date:        Optional[datetime] = None
    location:    Optional[str]      = None
    description: Optional[str]      = None
    status:      Optional[str]      = None
    stage:       Optional[str]      = None

class TeamCreate(BaseModel):
    name:       str
    short_name: Optional[str] = None
    color:      Optional[str] = None

class FieldCreate(BaseModel):
    name: str

class MatchCreate(BaseModel):
    team_a_id:    Optional[str]      = None
    team_b_id:    Optional[str]      = None
    field_id:     Optional[str]      = None
    round:        Optional[int]      = None
    scheduled_at: Optional[datetime] = None

class MatchResult(BaseModel):
    score_a: int
    score_b: int

class PredictionIn(BaseModel):
    pred_a: int = Field(..., ge=0)
    pred_b: int = Field(..., ge=0)


# ── Toernooien ────────────────────────────────────────────────────────────────

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
    t = session.get(Tournament, tid)
    if not t:
        raise HTTPException(404, "Toernooi niet gevonden")
    return t


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
    t = session.get(Tournament, tid)
    if not t:
        raise HTTPException(404, "Toernooi niet gevonden")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(t, k, v)
    session.add(t)
    session.commit()
    session.refresh(t)
    return t


# ── Teams ─────────────────────────────────────────────────────────────────────

@router.get("/tournaments/{tid}/teams")
def list_teams(tid: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return session.exec(select(TournixTeam).where(TournixTeam.tournament_id == tid)).all()


@router.post("/tournaments/{tid}/teams", status_code=201)
def create_team(
    tid: str,
    body: TeamCreate,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    team = TournixTeam(tournament_id=tid, **body.model_dump())
    session.add(team)
    session.commit()
    session.refresh(team)
    return team


@router.delete("/teams/{team_id}", status_code=204)
def delete_team(team_id: str, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    team = session.get(TournixTeam, team_id)
    if not team:
        raise HTTPException(404, "Team niet gevonden")
    session.delete(team)
    session.commit()


# ── Velden ────────────────────────────────────────────────────────────────────

@router.get("/tournaments/{tid}/fields")
def list_fields(tid: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return session.exec(select(TournixField).where(TournixField.tournament_id == tid)).all()


@router.post("/tournaments/{tid}/fields", status_code=201)
def create_field(
    tid: str,
    body: FieldCreate,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    field = TournixField(tournament_id=tid, **body.model_dump())
    session.add(field)
    session.commit()
    session.refresh(field)
    return field


# ── Wedstrijden ───────────────────────────────────────────────────────────────

@router.get("/tournaments/{tid}/matches")
def list_matches(tid: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return session.exec(
        select(TournixMatch)
        .where(TournixMatch.tournament_id == tid)
        .order_by(TournixMatch.scheduled_at)
    ).all()


@router.post("/tournaments/{tid}/matches", status_code=201)
def create_match(
    tid: str,
    body: MatchCreate,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    match = TournixMatch(tournament_id=tid, **body.model_dump())
    session.add(match)
    session.commit()
    session.refresh(match)
    return match


@router.patch("/matches/{mid}/result")
def set_result(
    mid: str,
    body: MatchResult,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    match = session.get(TournixMatch, mid)
    if not match:
        raise HTTPException(404, "Wedstrijd niet gevonden")
    match.score_a = body.score_a
    match.score_b = body.score_b
    match.status = "finished"
    session.add(match)
    session.commit()
    session.refresh(match)
    return match


# ── Stand ─────────────────────────────────────────────────────────────────────

@router.get("/tournaments/{tid}/standings")
def get_standings(
    tid: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    teams   = session.exec(select(TournixTeam).where(TournixTeam.tournament_id == tid)).all()
    matches = session.exec(
        select(TournixMatch)
        .where(TournixMatch.tournament_id == tid, TournixMatch.status == "finished")
    ).all()

    stats = {t.id: {"id": t.id, "name": t.name, "short_name": t.short_name, "color": t.color,
                     "played": 0, "won": 0, "draw": 0, "lost": 0, "gf": 0, "ga": 0, "pts": 0}
             for t in teams}

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

    return sorted(stats.values(), key=lambda x: (-x["pts"], -(x["gf"] - x["ga"]), -x["gf"]))


# ── Voorspellingen ────────────────────────────────────────────────────────────

@router.post("/matches/{mid}/predict")
def predict(
    mid: str,
    body: PredictionIn,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    match = session.get(TournixMatch, mid)
    if not match:
        raise HTTPException(404, "Wedstrijd niet gevonden")
    if match.status == "finished":
        raise HTTPException(400, "Wedstrijd is al afgelopen")
    existing = session.exec(
        select(TournixPrediction)
        .where(TournixPrediction.match_id == mid, TournixPrediction.user_id == user.id)
    ).first()
    if existing:
        existing.pred_a = body.pred_a
        existing.pred_b = body.pred_b
        session.add(existing)
    else:
        session.add(TournixPrediction(match_id=mid, user_id=user.id, **body.model_dump()))
    session.commit()
    return {"ok": True}


@router.get("/matches/{mid}/predictions")
def list_predictions(mid: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return session.exec(select(TournixPrediction).where(TournixPrediction.match_id == mid)).all()


# ── Snapshots ─────────────────────────────────────────────────────────────────

@router.post("/tournaments/{tid}/snapshots", dependencies=[Depends(require_admin)])
def create_snapshot(
    tid: str,
    round: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Save a standings snapshot for a completed round."""
    tournament = session.get(Tournament, tid)
    if not tournament:
        raise HTTPException(404, "Toernooi niet gevonden")

    # Get all finished matches for this tournament up to this round
    matches = session.exec(
        select(TournixMatch).where(
            TournixMatch.tournament_id == tid,
            TournixMatch.round <= round,
            TournixMatch.status == "finished"
        )
    ).all()

    # Get teams
    teams = session.exec(select(TournixTeam).where(TournixTeam.tournament_id == tid)).all()

    # Calculate standings
    standings = {}
    for team in teams:
        standings[team.id] = {"team_id": team.id, "name": team.name, "w": 0, "d": 0, "l": 0, "gf": 0, "ga": 0, "pts": 0}

    for match in matches:
        if match.score_a is None or match.score_b is None:
            continue
        a, b = standings.get(match.team_a_id), standings.get(match.team_b_id)
        if not a or not b:
            continue
        a["gf"] += match.score_a; a["ga"] += match.score_b
        b["gf"] += match.score_b; b["ga"] += match.score_a
        if match.score_a > match.score_b:
            a["w"] += 1; a["pts"] += 3; b["l"] += 1
        elif match.score_a < match.score_b:
            b["w"] += 1; b["pts"] += 3; a["l"] += 1
        else:
            a["d"] += 1; a["pts"] += 1; b["d"] += 1; b["pts"] += 1

    import json
    snapshot_data = {
        "round": round,
        "standings": sorted(standings.values(), key=lambda x: (-x["pts"], -(x["gf"] - x["ga"]))),
        "matches": [
            {
                "id": m.id,
                "round": m.round,
                "team_a_id": m.team_a_id,
                "team_b_id": m.team_b_id,
                "score_a": m.score_a,
                "score_b": m.score_b,
            }
            for m in matches
        ],
    }

    # Upsert snapshot for this round
    existing = session.exec(
        select(TournixSnapshot).where(
            TournixSnapshot.tournament_id == tid,
            TournixSnapshot.round == round
        )
    ).first()

    if existing:
        existing.snapshot_json = json.dumps(snapshot_data)
        session.add(existing)
    else:
        session.add(TournixSnapshot(
            tournament_id=tid,
            round=round,
            snapshot_json=json.dumps(snapshot_data),
        ))

    session.commit()
    return {"ok": True, "round": round}


@router.get("/tournaments/{tid}/snapshots")
def list_snapshots(
    tid: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    snapshots = session.exec(
        select(TournixSnapshot)
        .where(TournixSnapshot.tournament_id == tid)
        .order_by(TournixSnapshot.round)
    ).all()
    return [{"id": s.id, "round": s.round, "created_at": s.created_at} for s in snapshots]


@router.get("/tournaments/{tid}/snapshots/{round}")
def get_snapshot(
    tid: str,
    round: int,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    snapshot = session.exec(
        select(TournixSnapshot).where(
            TournixSnapshot.tournament_id == tid,
            TournixSnapshot.round == round
        )
    ).first()
    if not snapshot:
        raise HTTPException(404, "Geen snapshot gevonden voor ronde " + str(round))
    import json
    return json.loads(snapshot.snapshot_json)
