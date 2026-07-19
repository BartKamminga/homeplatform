"""Tournix — hockey.nl import API (Datavanger endpoint)."""

import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func as sqlfunc
from sqlmodel import Session, select

from core.auth import get_current_user
from core.database import get_session
from models.core import User
from models.tournix import (
    Tournament, TournixImportLog, TournixMatch, TournixPhase,
    TournixPhaseTeam, TournixPool, TournixTeam, new_uuid,
)

router = APIRouter(prefix="/api/tournix/import", tags=["tournix-import"])


# ── Parser ────────────────────────────────────────────────────────────────────

def _clean_o14(name: str) -> str:
    return re.sub(r'\s+[A-Z]?O?\d+-\d+$', '', name).strip()

def _clean_o16(name: str) -> str:
    return re.sub(r'\s+[MJ]O\d+-\d+$', '', name).strip()

def _parse_match_raw(m: dict, clean_fn) -> dict:
    score = m.get("score") or {}
    return {
        "home":        clean_fn(m.get("home", {}).get("name", "")),
        "away":        clean_fn(m.get("away", {}).get("name", "")),
        "round":       m.get("round"),
        "date":        m.get("date"),
        "status":      m.get("status", "scheduled"),
        "score_a":     score.get("home"),
        "score_b":     score.get("away"),
        "external_id": str(m["id"]) if m.get("id") else None,
    }

def _build(poule_map: dict, name: str) -> dict:
    pools, matches, date = [], [], None
    for letter in sorted(poule_map):
        p = poule_map[letter]
        pools.append({"name": p["pool_name"], "teams": p["teams"]})
        for m in p["played"] + p["remaining"]:
            if not date and m.get("date"):
                try:
                    date = datetime.fromisoformat(m["date"]).date().isoformat()
                except Exception:
                    pass
            matches.append({**m, "pool": p["pool_name"]})
    return {"name": name, "date": date, "pools": pools, "matches": matches}

def _parse_o16(entry: dict, root: dict) -> Optional[dict]:
    LETTERS = list("ABCDEFGH")
    label = entry.get("label") or entry.get("competition") or "Hockey import"
    poule_map = {}
    for p in root.get("poules", []):
        if p.get("competition", {}).get("class_name") != "Landelijk":
            continue
        letter = (p.get("name") or "").replace("Poule ", "")
        if letter not in LETTERS:
            continue
        ma = p.get("matches", [])
        poule_map[letter] = {
            "pool_name": p.get("name", f"Poule {letter}"),
            "teams": [_clean_o16(s["team"]["name"]) for s in p.get("standings", [])],
            "played":    [_parse_match_raw(m, _clean_o16) for m in ma if m.get("status") == "final"],
            "remaining": [_parse_match_raw(m, _clean_o16) for m in ma if m.get("status") in ("scheduled", "announced")],
        }
    return _build(poule_map, label) if poule_map else None

def _parse_o14(entries: list) -> Optional[dict]:
    LETTERS = list("ABCDEFGH")
    poule_map, comp_name = {}, None
    for entry in entries:
        if entry.get("type") == "competition":
            continue
        poule = entry.get("data", {}).get("data", {}).get("poule", {})
        if not poule:
            continue
        letter = (poule.get("name") or "").replace("Poule ", "")
        if letter not in LETTERS or letter in poule_map:
            continue
        if not comp_name:
            c = entry.get("competition", "")
            comp_name = f"NK Hockey {'JO14' if 'Jongens' in c else 'MO14' if 'Meisjes' in c else c}"
        ma = poule.get("matches", [])
        poule_map[letter] = {
            "pool_name": poule.get("name", f"Poule {letter}"),
            "teams": [_clean_o14(s["team"]["name"]) for s in poule.get("standings", [])],
            "played":    [_parse_match_raw(m, _clean_o14) for m in ma if m.get("status") == "final"],
            "remaining": [_parse_match_raw(m, _clean_o14) for m in ma if m.get("status") in ("scheduled", "announced")],
        }
    return _build(poule_map, comp_name or "Hockey import") if poule_map else None

def parse_hockey_nl(raw: dict) -> Optional[dict]:
    """Parse ruwe Datavanger JSON naar intern formaat. Herkent O14 en O16 automatisch."""
    for entry in raw.values():
        data = entry.get("data", {}).get("data", entry.get("data", {}))
        if "poules" in data:
            result = _parse_o16(entry, data)
            if result:
                return result
    return _parse_o14(list(raw.values()))


# ── Upsert-helpers ────────────────────────────────────────────────────────────

def _get_or_create_phase(session: Session, tournament: Tournament) -> TournixPhase:
    phase = session.exec(
        select(TournixPhase).where(
            TournixPhase.tournament_id == tournament.id,
            TournixPhase.phase_type == "pool",
        )
    ).first()
    if not phase:
        phase = TournixPhase(tournament_id=tournament.id, name="Poule fase", order=0, phase_type="pool")
        session.add(phase)
        session.flush()
    return phase

def _upsert_pools_teams(session: Session, tournament: Tournament, phase: TournixPhase, pools_data: list) -> tuple[dict, dict]:
    existing_pools = {p.name: p for p in session.exec(select(TournixPool).where(TournixPool.phase_id == phase.id)).all()}
    existing_teams = {t.name: t for t in session.exec(select(TournixTeam).where(TournixTeam.tournament_id == tournament.id)).all()}
    phase_team_ids = {pt.team_id for pt in session.exec(select(TournixPhaseTeam).where(TournixPhaseTeam.phase_id == phase.id)).all()}

    pool_map, team_map = {}, {}
    for i, p_data in enumerate(pools_data):
        pool = existing_pools.get(p_data["name"])
        if not pool:
            pool = TournixPool(tournament_id=tournament.id, name=p_data["name"], order=i, phase_id=phase.id)
            session.add(pool)
            session.flush()
        pool_map[p_data["name"]] = pool

        for team_name in p_data["teams"]:
            team = existing_teams.get(team_name)
            if not team:
                team = TournixTeam(tournament_id=tournament.id, name=team_name, pool_id=pool.id)
                session.add(team)
                session.flush()
                existing_teams[team_name] = team
            elif team.pool_id != pool.id:
                team.pool_id = pool.id
                session.add(team)
            if team.id not in phase_team_ids:
                session.add(TournixPhaseTeam(phase_id=phase.id, team_id=team.id))
                phase_team_ids.add(team.id)
            team_map[team_name] = team

    session.flush()
    return pool_map, team_map

def _upsert_matches(session: Session, tournament: Tournament, phase: TournixPhase, pool_map: dict, team_map: dict, matches_data: list) -> tuple[int, int]:
    existing = session.exec(select(TournixMatch).where(TournixMatch.phase_id == phase.id)).all()
    by_ext   = {m.external_id: m for m in existing if m.external_id}
    by_teams = {(m.team_a_id, m.team_b_id, m.round): m for m in existing if m.team_a_id and m.team_b_id}

    created = updated = 0
    for m in matches_data:
        team_a = team_map.get(m.get("home", ""))
        team_b = team_map.get(m.get("away", ""))
        if not team_a or not team_b:
            continue

        status   = "finished" if m.get("status") == "final" else "scheduled"
        score_a  = m.get("score_a")
        score_b  = m.get("score_b")
        ext_id   = m.get("external_id")
        rnd      = m.get("round")

        existing_match = by_ext.get(ext_id) if ext_id else None
        if not existing_match:
            existing_match = by_teams.get((team_a.id, team_b.id, rnd))

        if existing_match:
            changed = False
            if existing_match.status != status:       existing_match.status  = status;  changed = True
            if score_a is not None and existing_match.score_a != score_a: existing_match.score_a = score_a; changed = True
            if score_b is not None and existing_match.score_b != score_b: existing_match.score_b = score_b; changed = True
            if ext_id and existing_match.external_id != ext_id:           existing_match.external_id = ext_id; changed = True
            if changed:
                session.add(existing_match); updated += 1
        else:
            scheduled_at = None
            if m.get("date"):
                try: scheduled_at = datetime.fromisoformat(m["date"])
                except Exception: pass
            session.add(TournixMatch(
                tournament_id=tournament.id, phase_id=phase.id,
                team_a_id=team_a.id, team_b_id=team_b.id,
                round=rnd, scheduled_at=scheduled_at,
                score_a=score_a, score_b=score_b,
                status=status, match_type="pool", external_id=ext_id,
            ))
            created += 1

    session.flush()
    return created, updated


# ── Schemas ───────────────────────────────────────────────────────────────────

class HockeyNlImportBody(BaseModel):
    label:         str
    season:        str           = "2026-2027"
    tournament_id: Optional[str] = None
    data:          dict


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/hockey-nl")
def import_hockey_nl(
    body: HockeyNlImportBody,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Importeer ruwe hockey.nl data van de Datavanger extensie of Playwright script."""
    parsed = parse_hockey_nl(body.data)
    if not parsed:
        raise HTTPException(422, "Geen bruikbare hockey.nl data herkend in de payload")

    action = "updated"
    if body.tournament_id:
        tournament = session.get(Tournament, body.tournament_id)
        if not tournament:
            raise HTTPException(404, f"Toernooi {body.tournament_id} niet gevonden")
    else:
        parsed_date = None
        if parsed.get("date"):
            try: parsed_date = datetime.fromisoformat(parsed["date"])
            except Exception: pass
        tournament = Tournament(
            name=body.label or parsed["name"], date=parsed_date,
            stage="inregel", status="active",
            num_pools=len(parsed["pools"]), pool_type="half",
            season=body.season, created_by=user.id,
        )
        session.add(tournament)
        session.flush()
        action = "created"

    phase                 = _get_or_create_phase(session, tournament)
    pool_map, team_map    = _upsert_pools_teams(session, tournament, phase, parsed["pools"])
    matches_created, matches_updated = _upsert_matches(session, tournament, phase, pool_map, team_map, parsed["matches"])

    session.add(TournixImportLog(
        source="hockey.nl", label=body.label,
        tournament_id=tournament.id, action=action,
        pools_count=len(pool_map), teams_count=len(team_map),
        matches_created=matches_created, matches_updated=matches_updated,
    ))
    session.commit()

    return {
        "tournament_id":   tournament.id,
        "tournament_name": tournament.name,
        "action":          action,
        "pools":           len(pool_map),
        "teams":           len(team_map),
        "matches_created": matches_created,
        "matches_updated": matches_updated,
    }


@router.get("/log")
def get_import_log(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Overzicht recente hockey.nl importen (admin)."""
    logs = session.exec(
        select(TournixImportLog).order_by(TournixImportLog.created_at.desc()).limit(100)
    ).all()
    return [
        {
            "id":              l.id,
            "source":          l.source,
            "label":           l.label,
            "tournament_id":   l.tournament_id,
            "action":          l.action,
            "pools":           l.pools_count,
            "teams":           l.teams_count,
            "matches_created": l.matches_created,
            "matches_updated": l.matches_updated,
            "created_at":      l.created_at.isoformat(),
        }
        for l in logs
    ]


@router.get("/config")
def get_import_config(
    season: str = "2026-2027",
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Capture-configuratie voor de hockey-vanger popup (vervangt KNOWN_COMPS)."""
    import json
    tournaments = session.exec(
        select(Tournament).where(Tournament.season == season)
    ).all()

    result = []
    for t in tournaments:
        phases = session.exec(
            select(TournixPhase).where(
                TournixPhase.tournament_id == t.id,
                TournixPhase.capture_type != None,  # noqa: E711
            ).order_by(TournixPhase.order)
        ).all()
        for phase in phases:
            try:
                ids = json.loads(phase.capture_ids) if phase.capture_ids else []
            except Exception:
                ids = []
            try:
                labels = json.loads(phase.capture_labels) if phase.capture_labels else []
            except Exception:
                labels = []
            result.append({
                "phase_id":        phase.id,
                "tournament_id":   t.id,
                "tournament_name": t.name,
                "season":          t.season,
                "capture_type":    phase.capture_type,
                "capture_group":   phase.capture_group,
                "capture_ids":     ids,
                "capture_labels":  labels,
            })

    return {"season": season, "entries": result}


@router.get("/coverage")
def get_import_coverage(
    season: str = "2026-2027",
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Per-toernooi poule-dekking voor een seizoen (voor de hockey-vanger popup)."""
    tournaments = session.exec(
        select(Tournament).where(Tournament.season == season)
    ).all()

    result = []
    for t in tournaments:
        phases = session.exec(
            select(TournixPhase).where(
                TournixPhase.tournament_id == t.id,
                TournixPhase.phase_type == "pool",
            )
        ).all()

        pools = []
        for phase in phases:
            phase_pools = session.exec(
                select(TournixPool)
                .where(TournixPool.phase_id == phase.id)
                .order_by(TournixPool.order)
            ).all()
            for pool in phase_pools:
                tc = session.exec(
                    select(sqlfunc.count(TournixTeam.id)).where(TournixTeam.pool_id == pool.id)
                ).one()
                pools.append({"name": pool.name, "team_count": tc})

        last_log = session.exec(
            select(TournixImportLog)
            .where(TournixImportLog.tournament_id == t.id)
            .order_by(TournixImportLog.created_at.desc())
        ).first()

        result.append({
            "tournament_id":   t.id,
            "tournament_name": t.name,
            "stage":           t.stage,
            "pool_count":      len(pools),
            "pools":           pools,
            "last_import":     last_log.created_at.isoformat() if last_log else None,
        })

    return {"season": season, "tournaments": result}
