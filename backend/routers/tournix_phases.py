"""Tournix — fases (alle bracket-typen na of inclusief de poule fase)."""

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
    TournixField, TournixMatch, TournixPool, TournixPhaseField,
)
from routers.tournix_matches import _round_robin_pairs

router = APIRouter(prefix="/api/tournix", tags=["tournix"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class PhaseCreate(BaseModel):
    name: str
    order: int = 0
    phase_type: str = "pool"
    ko_type: str = "single"
    pool_type: Optional[str] = None
    match_duration_min: int = 20
    break_min: int = 5


class PhaseUpdate(BaseModel):
    name:               Optional[str] = None
    order:              Optional[int] = None
    phase_type:         Optional[str] = None
    ko_type:            Optional[str] = None
    pool_type:          Optional[str] = None
    match_duration_min: Optional[int] = None
    break_min:          Optional[int] = None


class SetPhaseFieldsBody(BaseModel):
    field_ids: list[str]


class PhaseTeamIn(BaseModel):
    team_id: str
    group_name: Optional[str] = None


class PhaseTeamsBulk(BaseModel):
    teams: list[PhaseTeamIn]


class FromStandingsBody(BaseModel):
    positions: list[int]  # 1-indexed per pool, bijv. [1, 2] = top 2


class PoolInPhaseCreate(BaseModel):
    name: str
    order: int = 0


class AutoPoolsBody(BaseModel):
    num_pools: int
    pool_type: str = "half"  # "half" | "vol"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _calc_pool_standings(pool_teams: list, pool_matches: list) -> list:
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


def _is_main_phase(phase: TournixPhase, session: Session) -> bool:
    """True als dit de eerste pool-type fase is (de poule-fase)."""
    first = session.exec(
        select(TournixPhase)
        .where(TournixPhase.tournament_id == phase.tournament_id, TournixPhase.phase_type == "pool")
        .order_by(TournixPhase.order, TournixPhase.created_at)
    ).first()
    return first is not None and first.id == phase.id


def _phase_dict(phase: TournixPhase, session: Session) -> dict:
    members = session.exec(
        select(TournixPhaseTeam).where(TournixPhaseTeam.phase_id == phase.id)
    ).all()
    match_count = session.exec(
        select(TournixMatch).where(TournixMatch.phase_id == phase.id)
    ).all()
    pools = session.exec(
        select(TournixPool)
        .where(TournixPool.phase_id == phase.id)
        .order_by(TournixPool.order)
    ).all()
    pool_data = []
    for p in pools:
        team_count = len(session.exec(
            select(TournixTeam).where(TournixTeam.pool_id == p.id)
        ).all())
        pool_data.append({
            "id": p.id,
            "name": p.name,
            "order": p.order,
            "team_count": team_count,
        })
    phase_field_rows = session.exec(
        select(TournixPhaseField).where(TournixPhaseField.phase_id == phase.id)
    ).all()
    return {
        "id": phase.id,
        "tournament_id": phase.tournament_id,
        "name": phase.name,
        "order": phase.order,
        "phase_type": phase.phase_type,
        "ko_type": phase.ko_type or "single",
        "pool_type": phase.pool_type,
        "match_duration_min": phase.match_duration_min,
        "break_min": phase.break_min,
        "field_ids": [pf.field_id for pf in phase_field_rows],
        "match_count": len(match_count),
        "is_main_phase": _is_main_phase(phase, session),
        "teams": [{"team_id": m.team_id, "group_name": m.group_name} for m in members],
        "pools": pool_data,
    }


# ── Fase CRUD ─────────────────────────────────────────────────────────────────

@router.get("/tournaments/{tid}/phases")
def list_phases(tid: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    phases = session.exec(
        select(TournixPhase)
        .where(TournixPhase.tournament_id == tid)
        .order_by(TournixPhase.order, TournixPhase.created_at)
    ).all()
    return [_phase_dict(p, session) for p in phases]


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
    return _phase_dict(phase, session)


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
    return _phase_dict(phase, session)


@router.delete("/phases/{pid}", status_code=204)
def delete_phase(pid: str, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    phase = get_or_404(session, TournixPhase, pid, "Fase")
    for m in session.exec(select(TournixMatch).where(TournixMatch.phase_id == pid)).all():
        session.delete(m)
    for pt in session.exec(select(TournixPhaseTeam).where(TournixPhaseTeam.phase_id == pid)).all():
        session.delete(pt)
    for p in session.exec(select(TournixPool).where(TournixPool.phase_id == pid)).all():
        for t in session.exec(select(TournixTeam).where(TournixTeam.pool_id == p.id)).all():
            t.pool_id = None
            session.add(t)
        session.delete(p)
    session.delete(phase)
    session.commit()


# ── Pools binnen een fase ─────────────────────────────────────────────────────

@router.post("/phases/{pid}/pools", status_code=201)
def create_pool_in_phase(
    pid: str,
    body: PoolInPhaseCreate,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    phase = get_or_404(session, TournixPhase, pid, "Fase")
    if phase.phase_type != "pool":
        raise HTTPException(400, "Alleen pool-type fases kunnen sub-poules hebben")
    pool = TournixPool(
        tournament_id=phase.tournament_id,
        name=body.name,
        order=body.order,
        phase_id=pid,
    )
    session.add(pool)
    session.commit()
    session.refresh(pool)
    return pool


@router.delete("/phases/{pid}/pools/{pool_id}", status_code=204)
def delete_pool_in_phase(
    pid: str,
    pool_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    pool = get_or_404(session, TournixPool, pool_id, "Poule")
    if pool.phase_id != pid:
        raise HTTPException(400, "Poule hoort niet bij deze fase")
    for t in session.exec(select(TournixTeam).where(TournixTeam.pool_id == pool_id)).all():
        t.pool_id = None
        session.add(t)
    session.delete(pool)
    session.commit()


@router.post("/phases/{pid}/auto-pools")
def auto_pools_in_phase(
    pid: str,
    body: AutoPoolsBody,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    """Hermaak sub-poules en verdeel teams gelijkmatig (slangendraft)."""
    phase = get_or_404(session, TournixPhase, pid, "Fase")
    if phase.phase_type != "pool":
        raise HTTPException(400, "Alleen pool-type fases")
    tid = phase.tournament_id

    # Verwijder bestaande pools + ontkoppel teams
    for p in session.exec(select(TournixPool).where(TournixPool.phase_id == pid)).all():
        for t in session.exec(select(TournixTeam).where(TournixTeam.pool_id == p.id)).all():
            t.pool_id = None
            session.add(t)
        session.delete(p)
    session.flush()

    # Maak nieuwe pools aan
    letters = "ABCDEFGH"
    new_pools = []
    for i in range(min(body.num_pools, 8)):
        p = TournixPool(
            tournament_id=tid,
            name=f"Poule {letters[i]}",
            order=i,
            phase_id=pid,
        )
        session.add(p)
        new_pools.append(p)
    session.flush()

    # Bepaal welke teams in deze fase zitten
    is_main = _is_main_phase(phase, session)
    if is_main:
        phase_teams = session.exec(
            select(TournixTeam)
            .where(TournixTeam.tournament_id == tid)
            .order_by(TournixTeam.created_at)
        ).all()
    else:
        pt_rows = session.exec(
            select(TournixPhaseTeam).where(TournixPhaseTeam.phase_id == pid)
        ).all()
        team_ids = [r.team_id for r in pt_rows]
        phase_teams = session.exec(
            select(TournixTeam)
            .where(TournixTeam.id.in_(team_ids))
            .order_by(TournixTeam.created_at)
        ).all()

    # Slangenpatroon
    n = len(new_pools)
    if n == 0:
        raise HTTPException(400, "Geen poules aangemaakt")

    forward = list(range(n))
    backward = list(reversed(range(n)))
    direction = forward
    i = 0
    for team in phase_teams:
        team.pool_id = new_pools[direction[i % n]].id
        session.add(team)
        i += 1
        if i % n == 0:
            direction = backward if direction is forward else forward

    session.commit()
    return {"ok": True, "pools": n, "assigned": len(phase_teams)}


# ── Team-toewijzing (voor KO-fases en handmatige override) ───────────────────

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
    """Vul teams op basis van poule-standen uit de eerste pool-fase."""
    phase = get_or_404(session, TournixPhase, pid, "Fase")
    tid = phase.tournament_id

    # Zoek de eerste pool-fase (de bronfase)
    source_phase = session.exec(
        select(TournixPhase)
        .where(TournixPhase.tournament_id == tid, TournixPhase.phase_type == "pool")
        .order_by(TournixPhase.order, TournixPhase.created_at)
    ).first()
    if not source_phase or source_phase.id == pid:
        raise HTTPException(400, "Geen eerdere poule-fase gevonden om standen van te halen")

    pools = session.exec(
        select(TournixPool)
        .where(TournixPool.phase_id == source_phase.id)
        .order_by(TournixPool.order)
    ).all()
    if not pools:
        raise HTTPException(400, "Geen poules in de poule-fase gevonden")

    all_teams = session.exec(select(TournixTeam).where(TournixTeam.tournament_id == tid)).all()
    pool_teams_map = {p.id: [t for t in all_teams if t.pool_id == p.id] for p in pools}

    pool_matches = session.exec(
        select(TournixMatch).where(
            TournixMatch.phase_id == source_phase.id,
            TournixMatch.status == "finished",
        )
    ).all()

    for pt in session.exec(select(TournixPhaseTeam).where(TournixPhaseTeam.phase_id == pid)).all():
        session.delete(pt)

    added = 0
    for pool in pools:
        ranked = _calc_pool_standings(pool_teams_map[pool.id], pool_matches)
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


# ── Placeholder-teams (pre-genereer schema) ───────────────────────────────────

class PreAllocateBody(BaseModel):
    positions: list[int]  # [1, 2] = plekken 1 en 2 per poule


def _find_source_phase(phase: TournixPhase, session: Session) -> TournixPhase | None:
    """Vind de meest recente pool-fase vóór deze fase (op order)."""
    return session.exec(
        select(TournixPhase)
        .where(
            TournixPhase.tournament_id == phase.tournament_id,
            TournixPhase.phase_type == "pool",
            TournixPhase.order < phase.order,
        )
        .order_by(TournixPhase.order.desc())
    ).first()


def _delete_placeholders_for_phase(pid: str, session: Session):
    """Verwijder placeholder-teams en hun TournixPhaseTeam-rijen voor fase pid."""
    pt_rows = session.exec(select(TournixPhaseTeam).where(TournixPhaseTeam.phase_id == pid)).all()
    placeholder_ids = []
    for pt in pt_rows:
        t = session.get(TournixTeam, pt.team_id)
        if t and t.is_placeholder:
            placeholder_ids.append(t.id)
            session.delete(pt)
    for tid in placeholder_ids:
        t = session.get(TournixTeam, tid)
        if t:
            session.delete(t)
    session.flush()


@router.post("/phases/{pid}/teams/pre-allocate")
def pre_allocate_phase_teams(
    pid: str,
    body: PreAllocateBody,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    """Maak placeholder-teams aan voor een vervolg-fase (vóór de wedstrijden)."""
    phase = get_or_404(session, TournixPhase, pid, "Fase")
    source_phase = _find_source_phase(phase, session)
    if not source_phase:
        raise HTTPException(400, "Geen poule-fase gevonden vóór deze fase")

    pools = session.exec(
        select(TournixPool)
        .where(TournixPool.phase_id == source_phase.id)
        .order_by(TournixPool.order)
    ).all()
    if not pools:
        raise HTTPException(400, "Geen sub-poules in de bronpoule-fase")

    _delete_placeholders_for_phase(pid, session)

    created = 0
    for pool in pools:
        for pos in sorted(body.positions):
            placeholder = TournixTeam(
                tournament_id=phase.tournament_id,
                name=f"#{pos} {pool.name}",
                is_placeholder=True,
                placeholder_source_phase_id=source_phase.id,
                placeholder_pool_name=pool.name,
                placeholder_position=pos,
            )
            session.add(placeholder)
            session.flush()
            session.add(TournixPhaseTeam(phase_id=pid, team_id=placeholder.id))
            created += 1

    session.commit()
    return {"created": created, "source_phase": source_phase.name}


def resolve_placeholders(pid: str, session: Session) -> int:
    """Vervang placeholder-teams door echte teams op basis van huidige standen. Geeft aantal opgelost terug."""
    phase = session.get(TournixPhase, pid)
    if not phase:
        return 0

    source_phase = _find_source_phase(phase, session)
    if not source_phase:
        return 0

    from routers.tournix_utils import calc_standings
    standings = calc_standings(phase.tournament_id, session, phase_id=source_phase.id)

    by_pool: dict[str, list] = {}
    for s in standings:
        key = s.get("pool_name") or "Ongedeeld"
        by_pool.setdefault(key, []).append(s)

    pt_rows = session.exec(select(TournixPhaseTeam).where(TournixPhaseTeam.phase_id == pid)).all()
    resolved = 0

    for pt in pt_rows:
        placeholder = session.get(TournixTeam, pt.team_id)
        if not placeholder or not placeholder.is_placeholder:
            continue

        pool_name = placeholder.placeholder_pool_name or "Ongedeeld"
        pos = placeholder.placeholder_position  # 1-indexed
        pool_standings = by_pool.get(pool_name, [])
        if not pos or pos > len(pool_standings):
            continue

        real_team_id = pool_standings[pos - 1]["id"]

        for m in session.exec(
            select(TournixMatch).where(TournixMatch.team_a_id == placeholder.id)
        ).all():
            m.team_a_id = real_team_id
            session.add(m)
        for m in session.exec(
            select(TournixMatch).where(TournixMatch.team_b_id == placeholder.id)
        ).all():
            m.team_b_id = real_team_id
            session.add(m)

        pt.team_id = real_team_id
        session.add(pt)
        session.delete(placeholder)
        resolved += 1

    session.flush()
    return resolved


@router.post("/phases/{pid}/resolve-placeholders")
def resolve_phase_placeholders(
    pid: str,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    """Vervang placeholder-teams door echte teams (handmatig of na afloop poule-fase)."""
    get_or_404(session, TournixPhase, pid, "Fase")
    n = resolve_placeholders(pid, session)
    session.commit()
    return {"resolved": n}


# ── Schema genereren ──────────────────────────────────────────────────────────

@router.post("/phases/{pid}/generate-schedule")
def generate_phase_schedule(
    pid: str,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    """Genereer wedstrijden voor een fase."""
    phase = get_or_404(session, TournixPhase, pid, "Fase")
    tid = phase.tournament_id
    tournament = get_or_404(session, Tournament, tid, "Toernooi")

    for m in session.exec(select(TournixMatch).where(TournixMatch.phase_id == pid)).all():
        session.delete(m)
    session.flush()

    created = 0

    if phase.phase_type == "pool":
        pools = session.exec(
            select(TournixPool)
            .where(TournixPool.phase_id == pid)
            .order_by(TournixPool.order)
        ).all()
        if not pools:
            raise HTTPException(400, "Geen sub-poules aangemaakt voor deze fase")

        for pool in pools:
            pool_teams = session.exec(
                select(TournixTeam).where(TournixTeam.pool_id == pool.id)
            ).all()
            if len(pool_teams) < 2:
                continue
            effective_pool_type = phase.pool_type or tournament.pool_type or "half"
            rounds = _round_robin_pairs(pool_teams)
            if effective_pool_type == "vol":
                rounds = rounds + [[(b, a) for a, b in r] for r in rounds]
            for round_idx, round_pairs in enumerate(rounds, start=1):
                for team_a, team_b in round_pairs:
                    session.add(TournixMatch(
                        tournament_id=tid,
                        team_a_id=team_a.id,
                        team_b_id=team_b.id,
                        round=round_idx,
                        match_type="pool",
                        phase_id=pid,
                    ))
                    created += 1

    elif phase.phase_type == "ko":
        phase_team_rows = session.exec(
            select(TournixPhaseTeam)
            .where(TournixPhaseTeam.phase_id == pid)
            .order_by(TournixPhaseTeam.id)
        ).all()
        if not phase_team_rows:
            raise HTTPException(400, "Geen teams toegewezen aan deze fase")

        teams_ordered = [
            session.get(TournixTeam, pt.team_id)
            for pt in phase_team_rows
            if session.get(TournixTeam, pt.team_id) is not None
        ]
        n = len(teams_ordered)
        if n < 2:
            raise HTTPException(400, "Te weinig teams voor knock-out")

        import math
        bracket_size = 2 ** math.ceil(math.log2(n))
        if bracket_size > 32:
            raise HTTPException(400, "Te veel teams voor knock-out (max 32)")

        padded = teams_ordered + [None] * (bracket_size - n)
        ko_type = phase.ko_type or "single"
        half = bracket_size // 2
        r1_pairs = [(padded[i], padded[bracket_size - 1 - i]) for i in range(half)]

        all_rounds: list[list] = []
        current_pairs = r1_pairs
        bracket_round = 1

        while current_pairs:
            round_matches = []
            for team_a, team_b in current_pairs:
                m = TournixMatch(
                    tournament_id=tid,
                    phase_id=pid,
                    team_a_id=team_a.id if team_a else None,
                    team_b_id=team_b.id if team_b else None,
                    match_type="ko",
                    bracket_round=bracket_round,
                )
                if (team_a is None) != (team_b is None):
                    m.status = "finished"
                    m.score_a = 0 if team_a is None else 1
                    m.score_b = 0 if team_b is None else 1
                session.add(m)
                session.flush()
                round_matches.append(m)
                created += 1
            all_rounds.append(round_matches)
            if len(round_matches) <= 1:
                break
            current_pairs = [(None, None)] * (len(round_matches) // 2)
            bracket_round += 1

        for ri in range(1, len(all_rounds)):
            prev = all_rounds[ri - 1]
            for j, m in enumerate(all_rounds[ri]):
                m.source_match_a_id = prev[2 * j].id
                m.source_match_b_id = prev[2 * j + 1].id
                m.source_a_takes = "winner"
                m.source_b_takes = "winner"
                session.add(m)

        if ko_type == "consolation" and len(all_rounds) >= 2:
            semis = all_rounds[-2]
            if len(semis) >= 2:
                third = TournixMatch(
                    tournament_id=tid,
                    phase_id=pid,
                    team_a_id=None,
                    team_b_id=None,
                    match_type="ko",
                    bracket_round=len(all_rounds),
                    source_match_a_id=semis[0].id,
                    source_match_b_id=semis[1].id,
                    source_a_takes="loser",
                    source_b_takes="loser",
                )
                session.add(third)
                created += 1

    session.commit()
    return {"created": created}


# ── Velden per fase ───────────────────────────────────────────────────────────

@router.put("/phases/{pid}/fields")
def set_phase_fields(
    pid: str,
    body: SetPhaseFieldsBody,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    """Sla de beschikbare velden op voor deze fase (leeg = alle toernooivelden)."""
    get_or_404(session, TournixPhase, pid, "Fase")
    for pf in session.exec(select(TournixPhaseField).where(TournixPhaseField.phase_id == pid)).all():
        session.delete(pf)
    for fid in body.field_ids:
        session.add(TournixPhaseField(phase_id=pid, field_id=fid))
    session.commit()
    return {"ok": True, "count": len(body.field_ids)}


# ── Inplannen (greedy slot-packing) ──────────────────────────────────────────

@router.post("/phases/{pid}/plan-schedule")
def plan_phase_schedule(
    pid: str,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    """Wijs scheduled_at + field_id toe via greedy slot-packing. Geblokkeerd in productie."""
    phase = get_or_404(session, TournixPhase, pid, "Fase")
    tournament = get_or_404(session, Tournament, phase.tournament_id, "Toernooi")

    if tournament.stage == "productie":
        raise HTTPException(400, "Inplannen is geblokkeerd in productie — pas handmatig aan")

    # Bepaal beschikbare velden
    pf_rows = session.exec(select(TournixPhaseField).where(TournixPhaseField.phase_id == pid)).all()
    if pf_rows:
        field_ids = [pf.field_id for pf in pf_rows]
    else:
        all_fields = session.exec(
            select(TournixField).where(TournixField.tournament_id == phase.tournament_id)
        ).all()
        field_ids = [f.id for f in all_fields]

    if not field_ids:
        raise HTTPException(400, "Geen velden beschikbaar — voeg eerst velden toe aan het toernooi")

    n_fields = len(field_ids)
    duration = phase.match_duration_min or 20
    pause = phase.break_min or 5
    start_dt = tournament.date  # kan None zijn

    # Haal alle wedstrijden op (sla byes over)
    matches = session.exec(
        select(TournixMatch)
        .where(TournixMatch.phase_id == pid)
        .order_by(TournixMatch.round, TournixMatch.id)
    ).all()
    matches = [m for m in matches if m.team_a_id and m.team_b_id]

    if not matches:
        raise HTTPException(400, "Geen wedstrijden gevonden — genereer eerst het schema")

    # Bouw team→pool map
    team_ids = list({m.team_a_id for m in matches} | {m.team_b_id for m in matches})
    teams = session.exec(select(TournixTeam).where(TournixTeam.id.in_(team_ids))).all()
    team_pool = {t.id: (t.pool_id or "nopool") for t in teams}

    # Index: (team_id, pool_key) -> {round: match}
    team_round_match: dict = {}
    for m in matches:
        pool_key = team_pool.get(m.team_a_id, "nopool")
        for tid_key in [m.team_a_id, m.team_b_id]:
            key = (tid_key, pool_key)
            if key not in team_round_match:
                team_round_match[key] = {}
            if m.round is not None:
                team_round_match[key][m.round] = m

    # Greedy slot-packing
    remaining = list(matches)
    match_slot: dict[str, int] = {}
    assignments: list[tuple] = []  # (match.id, slot, field_idx)

    slot = 0
    while remaining:
        used_teams: set[str] = set()
        slot_batch: list = []

        for m in list(remaining):
            if len(slot_batch) >= n_fields:
                break
            if m.team_a_id in used_teams or m.team_b_id in used_teams:
                continue
            # Soepel rondvolgorde: beide teams moeten vorige ronde in eerder slot hebben
            if m.round is not None and m.round > 1:
                ok = True
                pool_key = team_pool.get(m.team_a_id, "nopool")
                for tid_key in [m.team_a_id, m.team_b_id]:
                    prev = team_round_match.get((tid_key, pool_key), {}).get(m.round - 1)
                    if prev and (prev.id not in match_slot or match_slot[prev.id] >= slot):
                        ok = False
                        break
                if not ok:
                    continue
            slot_batch.append(m)
            used_teams.add(m.team_a_id)
            used_teams.add(m.team_b_id)

        if not slot_batch:
            slot += 1
            if slot > len(matches) + n_fields:
                break
            continue

        for idx, m in enumerate(slot_batch):
            match_slot[m.id] = slot
            assignments.append((m.id, slot, idx))
            remaining.remove(m)

        slot += 1

    # Schrijf scheduled_at + field_id terug
    from datetime import timedelta
    updated = 0
    for mid, slot_num, field_idx in assignments:
        m = session.get(TournixMatch, mid)
        if m:
            m.field_id = field_ids[field_idx % n_fields]
            if start_dt:
                m.scheduled_at = start_dt + timedelta(minutes=slot_num * (duration + pause))
            session.add(m)
            updated += 1

    session.commit()
    return {"updated": updated, "slots": slot}


# ── Standen per fase ──────────────────────────────────────────────────────────

@router.get("/phases/{pid}/standings")
def get_phase_standings(
    pid: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Standen voor een fase (round-robin). Groepeert op sub-poule als beschikbaar."""
    phase = get_or_404(session, TournixPhase, pid, "Fase")

    phase_matches = session.exec(
        select(TournixMatch).where(
            TournixMatch.phase_id == pid,
            TournixMatch.status == "finished",
        )
    ).all()

    pools = session.exec(
        select(TournixPool)
        .where(TournixPool.phase_id == pid)
        .order_by(TournixPool.order)
    ).all()

    if pools:
        result = []
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

    # Fallback: geen pools, gebruik TournixPhaseTeam
    phase_team_rows = session.exec(
        select(TournixPhaseTeam).where(TournixPhaseTeam.phase_id == pid)
    ).all()
    team_ids = {pt.team_id for pt in phase_team_rows}
    teams = session.exec(select(TournixTeam).where(TournixTeam.id.in_(list(team_ids)))).all()
    team_map = {t.id: t for t in teams}
    stats2 = {
        tid: {"id": tid, "name": team_map[tid].name, "pts": 0, "gf": 0, "ga": 0, "w": 0, "d": 0, "l": 0}
        for tid in team_ids
        if tid in team_map
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
