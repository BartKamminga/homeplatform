"""Tournix — teams and clubs."""

import json
import random
import string
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from core.database import get_session
from core.auth import get_current_user, require_admin
from models.core import User
from models.tournix import TournixTeam, TournixClub, TournixPool, TournixPhase
from models.tournix import Tournament, PoulebordBoard

router = APIRouter(prefix="/api/tournix", tags=["tournix"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class TeamCreate(BaseModel):
    name:       str
    short_name: Optional[str] = None
    color:      Optional[str] = None
    club_id:    Optional[str] = None

class TeamUpdate(BaseModel):
    name:       Optional[str] = None
    short_name: Optional[str] = None
    color:      Optional[str] = None
    club_id:    Optional[str] = None

class ClubCreate(BaseModel):
    name:                    str
    abbreviation:            Optional[str] = None
    city:                    Optional[str] = None
    color:                   Optional[str] = None
    federation_reference_id: Optional[str] = None
    logo_url:                Optional[str] = None

class ClubUpdate(BaseModel):
    name:                    Optional[str] = None
    abbreviation:            Optional[str] = None
    city:                    Optional[str] = None
    color:                   Optional[str] = None
    federation_reference_id: Optional[str] = None
    logo_url:                Optional[str] = None


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
    existing = session.exec(
        select(TournixTeam).where(
            TournixTeam.tournament_id == tid,
            TournixTeam.name == body.name,
        )
    ).first()
    if existing:
        raise HTTPException(409, f"Er bestaat al een team met de naam '{body.name}'")
    team = TournixTeam(tournament_id=tid, **body.model_dump())
    session.add(team)
    session.commit()
    session.refresh(team)
    return team


@router.patch("/teams/{team_id}")
def update_team(
    team_id: str,
    body: TeamUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    team = session.get(TournixTeam, team_id)
    if not team:
        raise HTTPException(404, "Team niet gevonden")
    data = body.model_dump(exclude_none=True)
    if "name" in data and data["name"] != team.name:
        dup = session.exec(
            select(TournixTeam).where(
                TournixTeam.tournament_id == team.tournament_id,
                TournixTeam.name == data["name"],
            )
        ).first()
        if dup:
            raise HTTPException(409, f"Er bestaat al een team met de naam '{data['name']}'")
    for k, v in data.items():
        setattr(team, k, v)
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


# ── Clubs ─────────────────────────────────────────────────────────────────────

@router.get("/public/clubs")
def list_clubs_public(session: Session = Depends(get_session)):
    return [c.name for c in session.exec(select(TournixClub).order_by(TournixClub.name)).all()]


@router.get("/public/board")
def get_board(
    club: str,
    stage: Optional[str] = None,
    session: Session = Depends(get_session),
):
    club_lower = club.strip().lower()
    if not club_lower:
        return []

    all_teams = session.exec(
        select(TournixTeam).where(TournixTeam.pool_id.isnot(None))
    ).all()
    club_teams = [t for t in all_teams if not t.is_placeholder and t.name.lower().startswith(club_lower)]

    CATS = ["MO18", "JO18", "MO16", "JO16", "MO14", "JO14"]
    result, seen = [], set()

    for team in club_teams:
        pool = session.get(TournixPool, team.pool_id)
        if not pool or not pool.phase_id:
            continue
        phase = session.get(TournixPhase, pool.phase_id)
        if not phase or phase.phase_type != "pool":
            continue
        tournament = session.get(Tournament, phase.tournament_id)
        if not tournament:
            continue
        if stage and tournament.stage != stage:
            continue
        key = (phase.id, pool.name)
        if key in seen:
            continue
        seen.add(key)
        name_up = tournament.name.upper()
        cat = next((c for c in CATS if c in name_up), None)
        result.append({
            "tournament_id": tournament.id,
            "tournament_name": tournament.name,
            "category": cat,
            "phase_id": phase.id,
            "pool_name": pool.name,
            "team_name": team.name,
        })

    return sorted(result, key=lambda x: (x["category"] or "ZZ", x["tournament_name"]))


# ── Poulebord boards ──────────────────────────────────────────────────────────

BOARD_CODE_CHARS = string.ascii_lowercase + string.digits

def _new_board_code(session: Session) -> str:
    for _ in range(20):
        code = "".join(random.choices(BOARD_CODE_CHARS, k=6))
        if not session.get(PoulebordBoard, code):
            return code
    raise RuntimeError("Geen unieke code gevonden")


class BoardCreate(BaseModel):
    name:      str
    club:      str       = ""
    pins:      list      = []
    pool_pins: list      = []


@router.post("/public/boards", status_code=201)
def create_board(body: BoardCreate, session: Session = Depends(get_session)):
    if not body.name.strip():
        raise HTTPException(400, "Naam is verplicht")
    code = _new_board_code(session)
    board = PoulebordBoard(
        id=code,
        name=body.name.strip(),
        club=body.club,
        pins=json.dumps(body.pins),
        pool_pins=json.dumps(body.pool_pins),
    )
    session.add(board)
    session.commit()
    session.refresh(board)
    return {
        "id":        board.id,
        "name":      board.name,
        "club":      board.club,
        "pins":      json.loads(board.pins),
        "pool_pins": json.loads(board.pool_pins),
    }


@router.get("/public/boards/{code}")
def get_board_by_code(code: str, session: Session = Depends(get_session)):
    board = session.get(PoulebordBoard, code)
    if not board:
        raise HTTPException(404, "Board niet gevonden")
    return {
        "id":        board.id,
        "name":      board.name,
        "club":      board.club,
        "pins":      json.loads(board.pins),
        "pool_pins": json.loads(board.pool_pins),
    }


@router.get("/clubs")
def list_clubs(session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return session.exec(select(TournixClub).order_by(TournixClub.name)).all()


@router.post("/clubs", status_code=201)
def create_club(
    body: ClubCreate,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    existing = session.exec(select(TournixClub).where(TournixClub.name == body.name)).first()
    if existing:
        raise HTTPException(409, f"Er bestaat al een club met de naam '{body.name}'")
    club = TournixClub(**body.model_dump())
    session.add(club)
    session.commit()
    session.refresh(club)
    return club


@router.patch("/clubs/{club_id}")
def update_club(
    club_id: str,
    body: ClubUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    club = session.get(TournixClub, club_id)
    if not club:
        raise HTTPException(404, "Club niet gevonden")
    data = body.model_dump(exclude_none=True)
    if "name" in data:
        dup = session.exec(
            select(TournixClub).where(TournixClub.name == data["name"], TournixClub.id != club_id)
        ).first()
        if dup:
            raise HTTPException(409, f"Er bestaat al een club met de naam '{data['name']}'")
    for k, v in data.items():
        setattr(club, k, v)
    session.add(club)
    session.commit()
    session.refresh(club)
    return club


@router.delete("/clubs/{club_id}", status_code=204)
def delete_club(
    club_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    club = session.get(TournixClub, club_id)
    if not club:
        raise HTTPException(404, "Club niet gevonden")
    session.delete(club)
    session.commit()
