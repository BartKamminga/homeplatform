"""Hockey — poule capture, competitions, plugin errors."""

import json
from collections import defaultdict
from datetime import datetime, time as dtime, timedelta, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.capture import DataCapture, new_uuid
from models.hockey import HockeyPublicationComp
from models.hockey_discovery import (
    HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch,
    HockeyPouleStanding, HockeyTeam, VangerCmd,
)
from models.settings import AppSetting
from services.hockey_poule_capture_core import apply_poule_capture

router = APIRouter(prefix="/api/hockey", tags=["hockey-capture"])

DISC_TARGET_SEASON = "disc_target_season"


def _get_target_season(session: Session) -> str:
    row = session.get(AppSetting, DISC_TARGET_SEASON)
    return row.value if row and row.value else "2026-2027"


class TeamInPoule(BaseModel):
    id:                      int
    name:                    str
    short_name:              str = ""
    logo:                    Optional[str] = None
    federation_reference_id: Optional[str] = None


class StandingIn(BaseModel):
    team_id:       int
    team_name:     str = ""
    position:      Optional[int] = None
    played:        int = 0
    won:           int = 0
    drawn:         int = 0
    lost:          int = 0
    goals_for:     int = 0
    goals_against: int = 0
    points:        int = 0


class MatchIn(BaseModel):
    match_id:       Optional[int] = None
    home_team_id:   Optional[int] = None
    home_team_name: str = ""
    away_team_id:   Optional[int] = None
    away_team_name: str = ""
    match_date:     Optional[str] = None
    status:         str = ""
    home_score:     Optional[int] = None
    away_score:     Optional[int] = None
    round:          Optional[int] = None


class PouleCaptureIn(BaseModel):
    poule_id:         int
    poule_name:       str
    competition_name: str
    class_name:       str
    district:         str = ""
    hockey_type:      str = ""
    season:           str = "2026-2027"
    session_id:       Optional[str] = None
    teams_in_poule:   List[TeamInPoule] = []
    standings_data:   List[StandingIn]  = []
    matches_data:     List[MatchIn]     = []


@router.post("/poule-capture")
def upsert_poule_capture(
    body: PouleCaptureIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    target_season = _get_target_season(session)
    result = apply_poule_capture(session, body, target_season)

    if body.session_id:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        ext_cap = "poule_capture_" + str(body.poule_id)
        already = session.exec(
            select(DataCapture)
            .where(DataCapture.session_id == body.session_id)
            .where(DataCapture.external_id == ext_cap)
        ).first()
        if not already:
            session.add(DataCapture(
                id=new_uuid(),
                source="hockey-vanger",
                capture_type="poule_capture",
                external_id=ext_cap,
                session_id=body.session_id,
                payload=json.dumps(body.model_dump(exclude={"session_id"}), ensure_ascii=False),
                meta=json.dumps({
                    "poule_id":    body.poule_id,
                    "poule_name":  body.poule_name,
                    "competition": body.competition_name,
                    "season":      body.season,
                }, ensure_ascii=False),
                captured_at=now,
            ))

    session.commit()
    return {
        "poule_id":          body.poule_id,
        "competition_name":  body.competition_name,
        "competition_id":    result.comp.id,
        "status":            result.poule_status,
        "teams_updated":     result.teams_updated,
        "teams_created":     result.teams_created,
        "standings_saved":   result.standings_saved,
        "matches_saved":     result.matches_saved,
    }


# ── Poule verwijderen (reset queue + Discovery-opschoning, item 723) ────
@router.delete("/poules/{poule_id}")
def delete_poule_capture(
    poule_id: int,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Verwijdert de HockeyPoule-capture inclusief matches/standings, en annuleert
    nog openstaande scan-cmds voor deze poule. team.recent_poule_id blijft ongemoeid —
    komt de poule bij hockey.nl nog steeds voor, dan vindt de eerstvolgende scan 'm
    gewoon terug (bewuste keuze, item 723: geen permanente blokkade)."""
    row = session.exec(select(HockeyPoule).where(HockeyPoule.poule_id == poule_id)).first()
    if not row:
        return {"deleted": False}
    session.delete(row)

    matches_deleted = 0
    for m in session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule_id)).all():
        session.delete(m)
        matches_deleted += 1

    standings_deleted = 0
    for s in session.exec(select(HockeyPouleStanding).where(HockeyPouleStanding.poule_id == poule_id)).all():
        session.delete(s)
        standings_deleted += 1

    cmds_cancelled = 0
    for cmd in session.exec(
        select(VangerCmd)
        .where(VangerCmd.cmd_type == "get_poule")
        .where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).all():
        if json.loads(cmd.params).get("poule_id") == poule_id:
            cmd.status = "skipped"
            session.add(cmd)
            cmds_cancelled += 1

    session.commit()
    return {
        "deleted": True,
        "matches_deleted": matches_deleted,
        "standings_deleted": standings_deleted,
        "cmds_cancelled": cmds_cancelled,
    }


# ── Poule skip (geen data gevonden door interceptor) ─────
@router.post("/poule-skip")
def skip_poule(
    poule_id: int,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Markeert alle teams met recent_poule_id == poule_id als no_new_poule_confirmed."""
    teams = session.exec(
        select(HockeyTeam).where(HockeyTeam.recent_poule_id == poule_id)
    ).all()
    for t in teams:
        t.no_new_poule_confirmed = True
        t.updated_at = datetime.utcnow()
        session.add(t)
    session.commit()
    return {"poule_id": poule_id, "marked": len(teams)}


# ── Competitions query ───────────────────────────────────
@router.get("/competitions")
def list_competitions(
    season: Optional[str] = "2026-2027",
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    q = select(HockeyCompetition).order_by(col(HockeyCompetition.name))
    if season and season != "all":
        q = q.where(HockeyCompetition.season == season)
    comps = session.exec(q).all()
    q_poules = select(HockeyPoule)
    if season and season != "all":
        q_poules = q_poules.where(HockeyPoule.season == season)
    poules_all = session.exec(q_poules).all()
    poule_counts: Dict[int, int] = {}
    for p in poules_all:
        poule_counts[p.competition_id] = poule_counts.get(p.competition_id, 0) + 1

    hl_with_poules: set = {
        c.hl_comp_id for c in comps
        if c.hl_comp_id and poule_counts.get(c.id, 0) > 0
    }

    result = []
    for c in comps:
        pc = poule_counts.get(c.id, 0)
        if pc == 0 and c.hl_comp_id and c.hl_comp_id in hl_with_poules:
            continue
        result.append({
            "id":           c.id,
            "name":         c.name,
            "class_name":   c.class_name,
            "district":     c.district,
            "hockey_type":  c.hockey_type,
            "season":       c.season,
            "hl_comp_id":   c.hl_comp_id,
            "poule_count":  pc,
            "updated_at":   c.updated_at.isoformat(),
        })

    return {"total": len(result), "competitions": result}


# ── Stats per seizoen ────────────────────────────────────
@router.get("/stats/by-season")
def get_stats_by_season(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    comps  = session.exec(select(HockeyCompetition)).all()
    poules = session.exec(select(HockeyPoule)).all()
    captured_ids = set(session.exec(
        select(HockeyPouleStanding.poule_id).distinct()
    ).all())
    active_comp_ids = set(session.exec(
        select(HockeyPublicationComp.competition_id).where(HockeyPublicationComp.scan_profile == "active")
    ).all())
    match_counts: dict = defaultdict(int)
    for poule_id, n in session.exec(
        select(HockeyPouleMatch.poule_id, func.count()).group_by(HockeyPouleMatch.poule_id)
    ).all():
        match_counts[poule_id] = n

    comp_by_season: dict = defaultdict(list)
    for c in comps:
        comp_by_season[c.season or "onbekend"].append(c)

    poule_by_comp: dict = defaultdict(list)
    for p in poules:
        poule_by_comp[p.competition_id].append(p)

    result = []
    for season in sorted(comp_by_season.keys(), reverse=True):
        season_comps  = comp_by_season[season]
        season_poules = [p for c in season_comps for p in poule_by_comp.get(c.id, [])]
        captured = sum(1 for p in season_poules if p.poule_id in captured_ids)
        autoscan = sum(1 for p in season_poules if p.competition_id in active_comp_ids)
        total_matches = sum(match_counts.get(p.poule_id, 0) for p in season_poules)
        result.append({
            "season":          season,
            "competitions":    len(season_comps),
            "total_poules":    len(season_poules),
            "captured_poules": captured,
            "total_matches":   total_matches,
            "autoscan_poules": autoscan,
        })

    return {"stats": result}


# ── Data-kwaliteit (item 974) ────────────────────────────
@router.get("/stats/data-quality")
def get_data_quality(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Signalen naast de scanplan-monitoring: per-poule (aankomende week /
    kicktijd onbekend / uitslag mist) plus een aantal bredere tellingen."""
    target_season = _get_target_season(session)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today = now.date()

    poules = session.exec(select(HockeyPoule).where(HockeyPoule.season == target_season)).all()
    poule_by_id = {p.poule_id: p for p in poules}
    comps = {
        c.id: c for c in session.exec(
            select(HockeyCompetition).where(col(HockeyCompetition.id).in_({p.competition_id for p in poules}))
        ).all()
    } if poules else {}

    matches = session.exec(
        select(HockeyPouleMatch).where(col(HockeyPouleMatch.poule_id).in_(poule_by_id.keys()))
    ).all() if poule_by_id else []

    signals: dict = defaultdict(lambda: {"week": 0, "geen_tijd": 0, "mist_uitslag": 0})
    for m in matches:
        if not m.match_date:
            continue
        try:
            dt = datetime.fromisoformat(m.match_date)
        except ValueError:
            continue
        match_date = dt.date()
        if today <= match_date <= today + timedelta(days=7):
            if dt.time() == dtime(0, 0):
                signals[m.poule_id]["geen_tijd"] += 1
            else:
                signals[m.poule_id]["week"] += 1
        elif today - timedelta(days=7) <= match_date <= today:
            if m.status not in ("cancelled", "postponed") and (m.home_score is None or m.away_score is None):
                signals[m.poule_id]["mist_uitslag"] += 1

    rows = []
    for poule_id, s in signals.items():
        if not (s["week"] or s["geen_tijd"] or s["mist_uitslag"]):
            continue
        poule = poule_by_id.get(poule_id)
        if not poule:
            continue
        comp = comps.get(poule.competition_id)
        rows.append({
            "poule_id": poule_id, "poule_name": poule.name,
            "competition_name": comp.name if comp else None,
            "week": s["week"], "geen_tijd": s["geen_tijd"], "mist_uitslag": s["mist_uitslag"],
        })
    rows.sort(key=lambda r: (-r["mist_uitslag"], -r["geen_tijd"], -r["week"]))

    team_poule_ids = set(session.exec(
        select(HockeyTeam.recent_poule_id).where(col(HockeyTeam.recent_poule_id).is_not(None))
    ).all())
    poules_without_team = sum(1 for p in poules if p.poule_id not in team_poule_ids)

    season_pending_teams = session.exec(
        select(func.count()).select_from(HockeyTeam).where(HockeyTeam.season_pending == True)  # noqa: E712
    ).one()

    standings_poule_ids = set(session.exec(select(HockeyPouleStanding.poule_id).distinct()).all())
    match_poule_ids     = set(session.exec(select(HockeyPouleMatch.poule_id).distinct()).all())
    ghost_poules = len(standings_poule_ids - match_poule_ids)

    clubs_never_scanned = session.exec(
        select(func.count()).select_from(HockeyClub).where(HockeyClub.detail_loaded == False)  # noqa: E712
    ).one()

    return {
        "season": target_season,
        "rows": rows,
        "total_signaled_poules": len(rows),
        "poules_without_team":   poules_without_team,
        "teams_season_pending":  season_pending_teams,
        "ghost_poules":          ghost_poules,
        "clubs_never_scanned":   clubs_never_scanned,
    }


# ── Cleanup lege competities ─────────────────────────────
def _empty_competitions_query(season: Optional[str]):
    q = select(HockeyCompetition).where(
        ~HockeyCompetition.id.in_(
            select(col(HockeyPoule.competition_id)).where(col(HockeyPoule.competition_id).isnot(None))
        )
    )
    if season:
        q = q.where(HockeyCompetition.season == season)
    return q


@router.get("/competitions/empty")
def preview_empty_competitions(
    season: Optional[str] = None,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Dry-run (item 743): toont welke competities 'Lege opruimen' zou
    verwijderen, vOOr je het echt doet - 'leeg' betekent hier 0 HockeyPoule-rijen
    gekoppeld, niet 'weinig poules volgens de bond'."""
    empty = session.exec(_empty_competitions_query(season)).all()
    return {
        "total": len(empty),
        "competitions": [
            {
                "id": c.id, "name": c.name, "class_name": c.class_name,
                "district": c.district, "hockey_type": c.hockey_type, "season": c.season,
            }
            for c in empty
        ],
    }


@router.delete("/competitions/empty")
def delete_empty_competitions(
    season: Optional[str] = None,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Verwijder HockeyCompetition-records zonder gekoppelde poules."""
    empty = session.exec(_empty_competitions_query(season)).all()
    for c in empty:
        session.delete(c)
    session.commit()
    return {"deleted": len(empty)}


# ── Poules query ─────────────────────────────────────────
@router.get("/poules")
def list_poules(
    season: Optional[str] = "2026-2027",
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    q = select(HockeyPoule).order_by(col(HockeyPoule.name))
    if season and season != "all":
        q = q.where(HockeyPoule.season == season)
    poules = session.exec(q).all()
    return {
        "total": len(poules),
        "poules": [
            {
                "id":            p.id,
                "poule_id":      p.poule_id,
                "name":          p.name,
                "competition_id": p.competition_id,
                "season":        p.season,
            }
            for p in poules
        ],
    }


# ── Poule ID-reeksen per seizoen ─────────────────────────
@router.get("/poule-ranges")
def get_poule_ranges(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Berekent min/max poule-ID per seizoen uit gecaptured HockeyPoules."""
    poules = session.exec(select(HockeyPoule)).all()
    ranges: Dict[str, dict] = {}
    for p in poules:
        if p.season not in ranges:
            ranges[p.season] = {"min_id": p.poule_id, "max_id": p.poule_id, "count": 0}
        ranges[p.season]["min_id"] = min(ranges[p.season]["min_id"], p.poule_id)
        ranges[p.season]["max_id"] = max(ranges[p.season]["max_id"], p.poule_id)
        ranges[p.season]["count"] += 1

    seasons = sorted(ranges.items())
    result = []
    for i, (season, r) in enumerate(seasons):
        gap_before = None
        if i > 0:
            prev_max = seasons[i - 1][1]["max_id"]
            gap_before = r["min_id"] - prev_max - 1
        result.append({
            "season":     season,
            "min_id":     r["min_id"],
            "max_id":     r["max_id"],
            "count":      r["count"],
            "span":       r["max_id"] - r["min_id"],
            "gap_before": gap_before,
        })

    return {"seasons": result}


# ── Seizoeninferentie op basis van ID-reeks ──────────────
@router.post("/infer-season-pending")
def infer_season_pending(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Markeert teams als season_pending als hun recent_poule_id in een oud seizoen valt."""
    target_season = _get_target_season(session)

    poules = session.exec(select(HockeyPoule)).all()
    season_ranges: Dict[str, dict] = {}
    for p in poules:
        if p.season not in season_ranges:
            season_ranges[p.season] = {"min_id": p.poule_id, "max_id": p.poule_id}
        season_ranges[p.season]["min_id"] = min(season_ranges[p.season]["min_id"], p.poule_id)
        season_ranges[p.season]["max_id"] = max(season_ranges[p.season]["max_id"], p.poule_id)

    if not season_ranges:
        return {"marked_pending": 0, "cleared_pending": 0, "target_season": target_season}

    global_max = max(r["max_id"] for r in season_ranges.values())

    def _infer(poule_id: int) -> str:
        for season, r in season_ranges.items():
            if r["min_id"] <= poule_id <= r["max_id"]:
                return season
        if poule_id > global_max:
            return target_season
        return target_season

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    teams = session.exec(
        select(HockeyTeam).where(col(HockeyTeam.recent_poule_id).is_not(None))
    ).all()

    marked_pending = 0
    cleared_pending = 0

    for t in teams:
        if t.no_new_poule_confirmed:
            continue
        inferred = _infer(t.recent_poule_id)
        if inferred != target_season and not t.season_pending:
            t.season_pending = True
            t.updated_at = now
            session.add(t)
            marked_pending += 1
        elif inferred == target_season and t.season_pending:
            t.season_pending = False
            t.updated_at = now
            session.add(t)
            cleared_pending += 1

    session.commit()
    return {
        "marked_pending":  marked_pending,
        "cleared_pending": cleared_pending,
        "target_season":   target_season,
        "season_ranges":   [
            {"season": s, **r} for s, r in sorted(season_ranges.items())
        ],
    }

