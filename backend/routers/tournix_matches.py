"""Tournix — matches, scores, standings, schedules, predictions, snapshots."""

import json
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from core.database import get_session
from core.auth import get_current_user, require_admin
from core.crud import get_or_404
from models.core import User
from models.tournix import (
    Tournament, TournixPool, TournixTeam, TournixField,
    TournixMatch, TournixPrediction, TournixSnapshot,
)
from routers.tournix_utils import calc_standings

router = APIRouter(prefix="/api/tournix", tags=["tournix"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class MatchCreate(BaseModel):
    team_a_id:    Optional[str]      = None
    team_b_id:    Optional[str]      = None
    field_id:     Optional[str]      = None
    round:        Optional[int]      = None
    scheduled_at: Optional[datetime] = None

class MatchUpdate(BaseModel):
    field_id:     Optional[str]      = None
    round:        Optional[int]      = None
    scheduled_at: Optional[datetime] = None
    team_a_id:    Optional[str]      = None
    team_b_id:    Optional[str]      = None

class MatchResult(BaseModel):
    score_a: int
    score_b: int

class PredictionIn(BaseModel):
    pred_a: int = Field(..., ge=0)
    pred_b: int = Field(..., ge=0)

class ScheduleGenerateBody(BaseModel):
    clear_existing: bool = False


# ── Helper ────────────────────────────────────────────────────────────────────

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
    match = get_or_404(session, TournixMatch, mid, "Wedstrijd")
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
    match = get_or_404(session, TournixMatch, mid, "Wedstrijd")
    match.score_a = body.score_a
    match.score_b = body.score_b
    match.status = "finished"
    session.add(match)
    session.commit()
    session.refresh(match)
    return match


@router.delete("/matches/{mid}", status_code=204)
def delete_match(mid: str, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    match = get_or_404(session, TournixMatch, mid, "Wedstrijd")
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
    return calc_standings(tid, session)


# ── Voorspellingen ────────────────────────────────────────────────────────────

@router.post("/matches/{mid}/predict")
def predict(
    mid: str,
    body: PredictionIn,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    match = get_or_404(session, TournixMatch, mid, "Wedstrijd")
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
    tournament = get_or_404(session, Tournament, tid, "Toernooi")

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
    return json.loads(snapshot.snapshot_json)


# ── Schedule generation ───────────────────────────────────────────────────────

@router.post("/tournaments/{tid}/generate-schedule", dependencies=[Depends(require_admin)])
def generate_schedule(tid: str, body: ScheduleGenerateBody, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    """Generate round-robin matches for all pools in a tournament."""
    tournament = get_or_404(session, Tournament, tid, "Toernooi")

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
    tournament = get_or_404(session, Tournament, tid, "Toernooi")
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
