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
from models.tournix import Tournament, TournixClub, TournixPool, TournixTeam, TournixField, TournixMatch, TournixPrediction, TournixSnapshot

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

class FieldCreate(BaseModel):
    name:    str
    club_id: Optional[str] = None

class MatchUpdate(BaseModel):
    field_id:     Optional[str]      = None
    round:        Optional[int]      = None
    scheduled_at: Optional[datetime] = None
    team_a_id:    Optional[str]      = None
    team_b_id:    Optional[str]      = None

class ClubCreate(BaseModel):
    name:                    str
    abbreviation:            Optional[str] = None
    city:                    Optional[str] = None
    color:                   Optional[str] = None
    federation_reference_id: Optional[str] = None

class ClubUpdate(BaseModel):
    name:                    Optional[str] = None
    abbreviation:            Optional[str] = None
    city:                    Optional[str] = None
    color:                   Optional[str] = None
    federation_reference_id: Optional[str] = None

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

class PoolCreate(BaseModel):
    name: str
    order: int = 0

class TeamPoolAssign(BaseModel):
    pool_id: Optional[str] = None


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


# ── Helpers ───────────────────────────────────────────────────────────────────

def _round_robin_pairs(teams):
    """Circle method: returns list of rounds, each round is list of (team_a, team_b) tuples."""
    lst = list(teams)
    if len(lst) % 2 == 1:
        lst.append(None)  # bye placeholder
    n = len(lst)
    rounds = []
    for _ in range(n - 1):
        round_pairs = [(lst[i], lst[n - 1 - i]) for i in range(n // 2) if lst[i] and lst[n - 1 - i]]
        rounds.append(round_pairs)
        # Keep lst[0] fixed, rotate the rest
        lst = [lst[0]] + [lst[-1]] + lst[1:-1]
    return rounds


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



@router.delete("/tournaments/{tid}", status_code=204)
def delete_tournament(tid: str, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    t = session.get(Tournament, tid)
    if not t:
        raise HTTPException(404, "Toernooi niet gevonden")
    # Cascade: predictions → matches → snapshots → teams → fields → pools → tournament
    matches = session.exec(select(TournixMatch).where(TournixMatch.tournament_id == tid)).all()
    for m in matches:
        preds = session.exec(select(TournixPrediction).where(TournixPrediction.match_id == m.id)).all()
        for p in preds:
            session.delete(p)
        session.delete(m)
    for snap in session.exec(select(TournixSnapshot).where(TournixSnapshot.tournament_id == tid)).all():
        session.delete(snap)
    for team in session.exec(select(TournixTeam).where(TournixTeam.tournament_id == tid)).all():
        session.delete(team)
    for field in session.exec(select(TournixField).where(TournixField.tournament_id == tid)).all():
        session.delete(field)
    for pool in session.exec(select(TournixPool).where(TournixPool.tournament_id == tid)).all():
        session.delete(pool)
    session.delete(t)
    session.commit()


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


@router.delete("/fields/{field_id}", status_code=204)
def delete_field(field_id: str, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    field = session.get(TournixField, field_id)
    if not field:
        raise HTTPException(404, "Veld niet gevonden")
    session.delete(field)
    session.commit()


# ── Clubs ─────────────────────────────────────────────────────────────────────

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


@router.patch("/matches/{mid}")
def update_match(
    mid: str,
    body: MatchUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    match = session.get(TournixMatch, mid)
    if not match:
        raise HTTPException(404, "Wedstrijd niet gevonden")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(match, k, v)
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


@router.delete("/matches/{mid}", status_code=204)
def delete_match(mid: str, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    match = session.get(TournixMatch, mid)
    if not match:
        raise HTTPException(404, "Wedstrijd niet gevonden")
    for pred in session.exec(select(TournixPrediction).where(TournixPrediction.match_id == mid)).all():
        session.delete(pred)
    session.delete(match)
    session.commit()


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

    result = sorted(stats.values(), key=lambda x: (-x["pts"], -(x["gf"] - x["ga"]), -x["gf"]))

    # Add pool info
    pools_by_id = {}
    pools = session.exec(select(TournixPool).where(TournixPool.tournament_id == tid)).all()
    for p in pools:
        pools_by_id[p.id] = p.name

    for row in result:
        team = session.get(TournixTeam, row["id"])
        row["pool_id"] = team.pool_id if team else None
        row["pool_name"] = pools_by_id.get(team.pool_id, None) if team and team.pool_id else None

    return result


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


# ── Pools ────────────────────────────────────────────────────────────────────

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


class ScheduleGenerateBody(BaseModel):
    clear_existing: bool = False

@router.post("/tournaments/{tid}/generate-schedule", dependencies=[Depends(require_admin)])
def generate_schedule(tid: str, body: ScheduleGenerateBody, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    """Generate round-robin matches for all pools in a tournament."""
    tournament = session.get(Tournament, tid)
    if not tournament:
        raise HTTPException(404, "Toernooi niet gevonden")

    # Get all pools
    pools = session.exec(
        select(TournixPool).where(TournixPool.tournament_id == tid).order_by(TournixPool.order)
    ).all()

    if not pools:
        # Treat all teams as one pool
        teams = session.exec(
            select(TournixTeam).where(TournixTeam.tournament_id == tid)
        ).all()
        pools_with_teams = [(None, teams)]
    else:
        pools_with_teams = []
        for p in pools:
            teams = session.exec(
                select(TournixTeam).where(TournixTeam.pool_id == p.id)
            ).all()
            pools_with_teams.append((p, teams))

    if body.clear_existing:
        # Only remove pool matches, keep KO matches
        existing = session.exec(
            select(TournixMatch).where(
                TournixMatch.tournament_id == tid,
                TournixMatch.match_type == "pool",
            )
        ).all()
        for m in existing:
            session.delete(m)
        session.commit()

    fields = session.exec(
        select(TournixField).where(TournixField.tournament_id == tid)
    ).all()
    field_ids = [f.id for f in fields] if fields else []

    created = 0
    match_counter = 0
    for pool, teams in pools_with_teams:
        if len(teams) < 2:
            continue
        rounds = _round_robin_pairs(teams)
        if tournament.pool_type == "vol":
            reverse_rounds = [[(b, a) for a, b in r] for r in rounds]
            rounds = rounds + reverse_rounds

        for round_idx, round_pairs in enumerate(rounds, start=1):
            for team_a, team_b in round_pairs:
                fid = field_ids[match_counter % len(field_ids)] if field_ids else None
                m = TournixMatch(
                    tournament_id=tid,
                    team_a_id=team_a.id,
                    team_b_id=team_b.id,
                    round=round_idx,
                    field_id=fid,
                    match_type="pool",
                )
                session.add(m)
                created += 1
                match_counter += 1

    session.commit()
    return {"created": created}


@router.post("/tournaments/{tid}/generate-knockout", dependencies=[Depends(require_admin)])
def generate_knockout(tid: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    """Seed teams from pool standings and create knockout matches."""
    tournament = session.get(Tournament, tid)
    if not tournament:
        raise HTTPException(404, "Toernooi niet gevonden")
    if tournament.knockout_type == "none":
        raise HTTPException(400, "Knockout is uitgeschakeld voor dit toernooi")

    # Build standings (reuse logic inline - get all finished pool matches)
    pool_matches = session.exec(
        select(TournixMatch).where(
            TournixMatch.tournament_id == tid,
            TournixMatch.match_type == "pool",
            TournixMatch.status == "finished",
        )
    ).all()

    teams_all = session.exec(
        select(TournixTeam).where(TournixTeam.tournament_id == tid)
    ).all()
    team_map = {t.id: t for t in teams_all}

    stats = {}
    for t in teams_all:
        stats[t.id] = {"team": t, "pts": 0, "gf": 0, "ga": 0, "pool_id": t.pool_id}

    for m in pool_matches:
        if m.score_a is None or m.score_b is None:
            continue
        a, b = m.team_a_id, m.team_b_id
        if a not in stats or b not in stats:
            continue
        stats[a]["gf"] += m.score_a; stats[a]["ga"] += m.score_b
        stats[b]["gf"] += m.score_b; stats[b]["ga"] += m.score_a
        if m.score_a > m.score_b:
            stats[a]["pts"] += 3
        elif m.score_a == m.score_b:
            stats[a]["pts"] += 1; stats[b]["pts"] += 1
        else:
            stats[b]["pts"] += 3

    pools = session.exec(
        select(TournixPool).where(TournixPool.tournament_id == tid).order_by(TournixPool.order)
    ).all()

    def sort_key(s):
        return (-s["pts"], -(s["gf"] - s["ga"]), -s["gf"])

    if tournament.knockout_type == "seeded":
        if pools:
            # Top N from each pool, then re-seed globally
            advancing = []
            for p in pools:
                pool_teams = sorted(
                    [s for s in stats.values() if s["pool_id"] == p.id],
                    key=sort_key
                )
                advancing.extend(pool_teams[:tournament.knockout_advance])
        else:
            all_sorted = sorted(stats.values(), key=sort_key)
            advancing = all_sorted[:tournament.knockout_advance * max(1, len(pools))]

        # Global re-seed
        advancing.sort(key=sort_key)
        n = len(advancing)

        if n < 2:
            raise HTTPException(400, "Te weinig teams voor knock-out")

        # Pair seed 1 vs n, 2 vs n-1, etc.
        pairs = []
        for i in range(n // 2):
            pairs.append((advancing[i]["team"], advancing[n - 1 - i]["team"]))

        # Determine KO round label
        if n <= 2:
            ko_round = "final"
        elif n <= 4:
            ko_round = "sf"
        else:
            ko_round = "qf"

        for team_a, team_b in pairs:
            m = TournixMatch(
                tournament_id=tid,
                team_a_id=team_a.id,
                team_b_id=team_b.id,
                match_type="ko",
                round=None,
            )
            session.add(m)

        session.commit()
        return {"created": len(pairs), "ko_round": ko_round}


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
