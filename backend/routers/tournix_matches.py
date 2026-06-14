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
    Tournament, TournixPool, TournixTeam,
    TournixMatch, TournixPrediction, TournixSnapshot,
    TournixPhaseTeam,
)
from routers.tournix_utils import calc_standings, calc_match_stats

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
    shootout_winner: Optional[str] = None  # "a" | "b" — only relevant for tied KO matches

class PredictionIn(BaseModel):
    pred_a: int = Field(..., ge=0)
    pred_b: int = Field(..., ge=0)


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
    match.shootout_winner = body.shootout_winner if match.match_type == "ko" else None
    session.add(match)
    session.flush()

    # KO-bracket: vul volgende ronde in
    if match.match_type == "ko":
        _fill_next_ko_slot(match, session)

    # Auto-resolve placeholders als alle wedstrijden in deze fase klaar zijn
    if match.phase_id:
        _try_auto_resolve(match.phase_id, session)

    session.commit()
    session.refresh(match)
    return match


def _try_auto_resolve(source_phase_id: str, session: Session):
    """Als alle wedstrijden in source_phase klaar zijn, los placeholder-teams op in afhankelijke fases."""
    phase_matches = session.exec(
        select(TournixMatch).where(TournixMatch.phase_id == source_phase_id)
    ).all()
    if not phase_matches:
        return
    if not all(m.status == "finished" for m in phase_matches):
        return

    # Vind alle fases die placeholder-teams hebben die naar deze fase verwijzen
    placeholders = session.exec(
        select(TournixTeam).where(
            TournixTeam.is_placeholder == True,  # noqa: E712
            TournixTeam.placeholder_source_phase_id == source_phase_id,
        )
    ).all()

    dependent_phase_ids: set[str] = set()
    for ph in placeholders:
        for pt in session.exec(
            select(TournixPhaseTeam).where(TournixPhaseTeam.team_id == ph.id)
        ).all():
            dependent_phase_ids.add(pt.phase_id)

    from routers.tournix_phases import resolve_placeholders
    for dep_pid in dependent_phase_ids:
        resolve_placeholders(dep_pid, session)


def _fill_next_ko_slot(match: TournixMatch, session: Session):
    """Vul team-slots in de volgende KO-ronde in na het invoeren van een uitslag."""
    if match.score_a is None or match.score_b is None:
        return

    # Bepaal winnaar en verliezer
    if match.score_a > match.score_b:
        winner_id, loser_id = match.team_a_id, match.team_b_id
    elif match.score_b > match.score_a:
        winner_id, loser_id = match.team_b_id, match.team_a_id
    elif match.shootout_winner == "a":
        winner_id, loser_id = match.team_a_id, match.team_b_id
    else:
        winner_id, loser_id = match.team_b_id, match.team_a_id

    for nm in session.exec(select(TournixMatch).where(TournixMatch.source_match_a_id == match.id)).all():
        nm.team_a_id = loser_id if nm.source_a_takes == "loser" else winner_id
        session.add(nm)

    for nm in session.exec(select(TournixMatch).where(TournixMatch.source_match_b_id == match.id)).all():
        nm.team_b_id = loser_id if nm.source_b_takes == "loser" else winner_id
        session.add(nm)


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

    teams = session.exec(select(TournixTeam).where(TournixTeam.tournament_id == tid)).all()
    team_map = {t.id: t for t in teams}

    raw = calc_match_stats(matches, teams)
    standings_list = sorted(
        [
            {
                "team_id": tid_key, "name": team_map[tid_key].name,
                "w": s["won"], "d": s["draw"], "l": s["lost"],
                "gf": s["gf"], "ga": s["ga"], "pts": s["pts"],
            }
            for tid_key, s in raw.items() if tid_key in team_map
        ],
        key=lambda x: (-x["pts"], -(x["gf"] - x["ga"])),
    )

    snapshot_data = {
        "round": round,
        "standings": standings_list,
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

    raw = calc_match_stats(pool_matches, teams_all)
    stats = {
        t.id: {"team": t, "pool_id": t.pool_id, **raw[t.id]}
        for t in teams_all
    }

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
