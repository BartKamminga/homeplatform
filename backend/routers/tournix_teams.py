"""Tournix — teams and clubs."""

import json
import random
import string
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from core.analytics import client_ip, hash_ip, log_site_event
from core.database import get_session
from core.auth import get_current_user, require_admin
from models.core import User
from models.tournix import TournixTeam, TournixClub, TournixPool, TournixPhase
from models.tournix import TournixMatch, TournixPhaseTeam, Tournament, PoulebordBoard

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


@router.post("/public/beacon")
def poulebord_beacon(request: Request):
    """Log a page view from the poulebord frontend."""
    log_site_event(
        "poulebord", "page_view",
        ip_hash=hash_ip(client_ip(request)),
        user_agent=request.headers.get("User-Agent", ""),
    )
    return {"ok": True}


@router.get("/public/board")
def get_board(
    club: str,
    request: Request,
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

    sorted_result = sorted(result, key=lambda x: (x["category"] or "ZZ", x["tournament_name"]))
    log_site_event(
        "poulebord", "api_call",
        ip_hash=hash_ip(client_ip(request)),
        user_agent=request.headers.get("User-Agent", ""),
        endpoint="/api/tournix/public/board",
        result_count=len(sorted_result),
    )
    return sorted_result


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


# ── Poulebord publieke fase- en standings-endpoints ───────────────────────────

@router.get("/public/phases/{pid}/pool-matches")
def get_pool_matches_public(pid: str, pool: str = "", session: Session = Depends(get_session)):
    """Wedstrijden voor één poule binnen een fase — publiek, geen auth vereist."""
    phase = session.get(TournixPhase, pid)
    if not phase:
        raise HTTPException(404, "Fase niet gevonden")

    pool_obj = session.exec(
        select(TournixPool).where(TournixPool.phase_id == pid, TournixPool.name == pool)
    ).first()
    if not pool_obj:
        return {"finished": [], "scheduled": []}

    pool_teams = session.exec(
        select(TournixTeam).where(TournixTeam.pool_id == pool_obj.id)
    ).all()
    team_ids = {t.id for t in pool_teams}
    team_names = {t.id: t.name for t in pool_teams}

    all_matches = session.exec(
        select(TournixMatch).where(TournixMatch.phase_id == pid)
    ).all()
    pool_matches = [m for m in all_matches if m.team_a_id in team_ids and m.team_b_id in team_ids]

    def fmt(m):
        return {
            "id":           m.id,
            "round":        m.round,
            "team_a":       team_names.get(m.team_a_id, "?"),
            "team_b":       team_names.get(m.team_b_id, "?"),
            "score_a":      m.score_a,
            "score_b":      m.score_b,
            "status":       m.status,
            "scheduled_at": m.scheduled_at.isoformat() if m.scheduled_at else None,
        }

    finished  = sorted([fmt(m) for m in pool_matches if m.status == "finished"],
                       key=lambda x: -(x["round"] or 0))
    scheduled = sorted([fmt(m) for m in pool_matches if m.status != "finished"],
                       key=lambda x: (x["scheduled_at"] or "9999", x["round"] or 0))
    return {"finished": finished, "scheduled": scheduled}


@router.get("/public/search")
def search_teams_pools(
    q: str,
    season: str = "2026-2027",
    session: Session = Depends(get_session),
):
    """Zoek teams (en hun poule) op naam — publiek, geen auth vereist."""
    q_norm = q.strip().lower()
    if len(q_norm) < 2:
        return []

    teams = session.exec(
        select(TournixTeam).where(TournixTeam.pool_id.isnot(None))
    ).all()

    results, seen = [], set()
    for team in teams:
        if team.is_placeholder or q_norm not in team.name.lower():
            continue
        pool = session.get(TournixPool, team.pool_id)
        if not pool or not pool.phase_id:
            continue
        phase = session.get(TournixPhase, pool.phase_id)
        if not phase or phase.phase_type != "pool":
            continue
        tournament = session.get(Tournament, team.tournament_id)
        if not tournament or tournament.season != season:
            continue
        key = f"{pool.phase_id}::{pool.name}"
        if key in seen:
            continue
        seen.add(key)
        results.append({
            "phase_id":        pool.phase_id,
            "pool_name":       pool.name,
            "tournament_name": tournament.name,
            "tournament_id":   tournament.id,
            "matched_team":    team.name,
        })

    return sorted(results, key=lambda x: (x["tournament_name"], x["pool_name"]))


@router.get("/public/tournaments/{tid}/phases")
def list_phases_public(tid: str, session: Session = Depends(get_session)):
    """Publieke faselijst voor Poulebord — geen auth vereist."""
    phases = session.exec(
        select(TournixPhase)
        .where(TournixPhase.tournament_id == tid)
        .order_by(TournixPhase.order, TournixPhase.created_at)
    ).all()
    if not phases:
        return []
    phase_ids = [p.id for p in phases]
    all_pools = session.exec(
        select(TournixPool)
        .where(TournixPool.phase_id.in_(phase_ids))
        .order_by(TournixPool.order)
    ).all()
    pool_ids = [p.id for p in all_pools]
    all_teams = session.exec(
        select(TournixTeam).where(TournixTeam.pool_id.in_(pool_ids))
    ).all() if pool_ids else []
    pools_by_phase: dict = {}
    for p in all_pools:
        pools_by_phase.setdefault(p.phase_id, []).append(p)
    team_count_by_pool: dict = {}
    for t in all_teams:
        team_count_by_pool[t.pool_id] = team_count_by_pool.get(t.pool_id, 0) + 1
    first_pool_phase_id = next((p.id for p in phases if p.phase_type == "pool"), None)
    return [
        {
            "id": phase.id,
            "name": phase.name,
            "order": phase.order,
            "phase_type": phase.phase_type,
            "is_main_phase": phase.id == first_pool_phase_id,
            "pools": [
                {"id": p.id, "name": p.name, "order": p.order, "team_count": team_count_by_pool.get(p.id, 0)}
                for p in pools_by_phase.get(phase.id, [])
            ],
        }
        for phase in phases
    ]


@router.get("/public/phases/{pid}/standings")
def get_phase_standings_public(pid: str, session: Session = Depends(get_session)):
    """Publieke standings per poulefase — geen auth vereist."""
    phase = session.get(TournixPhase, pid)
    if not phase:
        raise HTTPException(404, "Fase niet gevonden")
    phase_matches = session.exec(
        select(TournixMatch).where(
            TournixMatch.phase_id == pid,
            TournixMatch.status == "finished",
        )
    ).all()
    pools = session.exec(
        select(TournixPool).where(TournixPool.phase_id == pid).order_by(TournixPool.order)
    ).all()
    if pools:
        pools_by_id = {p.id: p.name for p in pools}
        all_pool_teams = session.exec(
            select(TournixTeam).where(TournixTeam.pool_id.in_([p.id for p in pools]))
        ).all()
        stats = {}
        for t in all_pool_teams:
            stats[t.id] = {
                "id": t.id, "name": t.name,
                "pts": 0, "gf": 0, "ga": 0, "w": 0, "d": 0, "l": 0,
                "pool_id": t.pool_id,
                "pool_name": pools_by_id.get(t.pool_id),
            }
        for m in phase_matches:
            a = stats.get(m.team_a_id)
            b = stats.get(m.team_b_id)
            if not a or not b or m.score_a is None or m.score_b is None:
                continue
            a["gf"] += m.score_a; a["ga"] += m.score_b
            b["gf"] += m.score_b; b["ga"] += m.score_a
            if m.score_a > m.score_b:
                a["w"] += 1; a["pts"] += 3; b["l"] += 1
            elif m.score_a == m.score_b:
                a["d"] += 1; a["pts"] += 1; b["d"] += 1; b["pts"] += 1
            else:
                b["w"] += 1; b["pts"] += 3; a["l"] += 1
        return sorted(stats.values(), key=lambda s: (s.get("pool_id", ""), -s["pts"], -(s["gf"] - s["ga"])))
    # Fallback: geen pools
    phase_team_rows = session.exec(
        select(TournixPhaseTeam).where(TournixPhaseTeam.phase_id == pid)
    ).all()
    team_ids = {pt.team_id for pt in phase_team_rows}
    teams = session.exec(select(TournixTeam).where(TournixTeam.id.in_(list(team_ids)))).all()
    team_map = {t.id: t for t in teams}
    stats2 = {
        tid: {"id": tid, "name": team_map[tid].name, "pts": 0, "gf": 0, "ga": 0, "w": 0, "d": 0, "l": 0}
        for tid in team_ids if tid in team_map
    }
    for m in phase_matches:
        if m.score_a is None or m.score_b is None:
            continue
        a = stats2.get(m.team_a_id)
        b = stats2.get(m.team_b_id)
        if not a or not b:
            continue
        a["gf"] += m.score_a; a["ga"] += m.score_b
        b["gf"] += m.score_b; b["ga"] += m.score_a
        if m.score_a > m.score_b:
            a["w"] += 1; a["pts"] += 3; b["l"] += 1
        elif m.score_a == m.score_b:
            a["d"] += 1; a["pts"] += 1; b["d"] += 1; b["pts"] += 1
        else:
            b["w"] += 1; b["pts"] += 3; a["l"] += 1
    return sorted(stats2.values(), key=lambda s: (-s["pts"], -(s["gf"] - s["ga"]), -s["gf"]))


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
