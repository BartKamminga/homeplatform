"""Geaggregeerde scan-statistieken (items 1108/1096/1097/1104) - puur lezend,
gebouwd bovenop ScanScheduleEntry(status='promoted') als betrouwbare
geschiedenis (die rijen worden NOOIT opgeruimd door rebuild_schedule, zie
services/hockey_vanger_schedule.py::rebuild_schedule), aangevuld met
ScanHistoryDaily voor de permanente succes/fail-telling. Losstaand van
hockey_vanger_schedule_debug.py (dat is de LIVE debug-browse van het
schema) en van hockey_capture.py (dat is CRUD/coverage, geen scan-analyse)."""

import json
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.hockey_discovery import (
    HockeyClub, HockeyCompetition, HockeyPoule, ScanHistoryDaily, ScanScheduleEntry,
)
from routers.hockey_vanger_schedule_debug import _iso, _label_for

router = APIRouter(prefix="/api/hockey/vanger/stats", tags=["hockey-vanger"])


def _build_target_lookups(session: Session, entries: List[ScanScheduleEntry]):
    """Zelfde opbouw als browse_schedule() in hockey_vanger_schedule_debug.py,
    hier apart zodat deze module niet afhankelijk is van die router se
    interne query-flow."""
    poule_ids = {e.target_id for e in entries if e.target_type == "poule"}
    comp_ids = {e.target_id for e in entries if e.target_type == "competition"}
    club_ids = {e.target_id for e in entries if e.target_type == "club"}
    poule_by_id = {p.poule_id: p for p in session.exec(
        select(HockeyPoule).where(col(HockeyPoule.poule_id).in_(poule_ids))
    ).all()} if poule_ids else {}
    comp_by_hl_id = {c.hl_comp_id: c for c in session.exec(
        select(HockeyCompetition).where(col(HockeyCompetition.hl_comp_id).in_(comp_ids))
    ).all()} if comp_ids else {}
    club_by_id = {c.id: c for c in session.exec(
        select(HockeyClub).where(col(HockeyClub.id).in_(club_ids))
    ).all()} if club_ids else {}
    poule_comp_ids = {p.competition_id for p in poule_by_id.values() if p.competition_id}
    comp_by_id = {c.id: c for c in session.exec(
        select(HockeyCompetition).where(col(HockeyCompetition.id).in_(poule_comp_ids))
    ).all()} if poule_comp_ids else {}
    return poule_by_id, comp_by_hl_id, club_by_id, comp_by_id


def _entry_label(session: Session, entry: ScanScheduleEntry, lookups) -> str:
    poule_by_id, comp_by_hl_id, club_by_id, comp_by_id = lookups
    try:
        params = json.loads(entry.params)
    except (ValueError, TypeError):
        params = {}
    return _label_for(entry, params, poule_by_id, comp_by_hl_id, club_by_id, comp_by_id)


@router.get("/day")
def stats_for_day(
    date: str,
    bucket_min: int = 30,
    top_n: int = 12,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Item 1097: server-side gebucket overzicht voor 1 kalenderdag - een
    drukke wedstrijddag heeft al snel 1000+ ScanScheduleEntry-rijen, die
    moeten dus NIET ruw naar de client (vandaar bucketing + top-N hier,
    niet clientside)."""
    bucket_min = max(5, min(bucket_min, 120))
    day_start = datetime.fromisoformat(date)
    day_end = day_start + timedelta(days=1)

    entries = session.exec(
        select(ScanScheduleEntry)
        .where(ScanScheduleEntry.status == "promoted")
        .where(ScanScheduleEntry.planned_at >= day_start)
        .where(ScanScheduleEntry.planned_at < day_end)
    ).all()

    n_buckets = (24 * 60) // bucket_min
    bucket_by_reason = [defaultdict(int) for _ in range(n_buckets)]
    reason_totals: Dict[str, int] = defaultdict(int)
    target_totals: Dict[tuple, int] = defaultdict(int)

    for e in entries:
        minutes = e.planned_at.hour * 60 + e.planned_at.minute
        idx = min(minutes // bucket_min, n_buckets - 1)
        bucket_by_reason[idx][e.reason] += 1
        reason_totals[e.reason] += 1
        target_totals[(e.target_type, e.target_id)] += 1

    buckets = []
    for i in range(n_buckets):
        start_min = i * bucket_min
        label = f"{start_min // 60:02d}:{start_min % 60:02d}"
        by_reason = dict(bucket_by_reason[i])
        buckets.append({"bucket": label, "by_reason": by_reason, "total": sum(by_reason.values())})

    reasons_present = sorted(reason_totals, key=lambda r: reason_totals[r], reverse=True)

    lookups = _build_target_lookups(session, entries)
    entry_by_target: Dict[tuple, ScanScheduleEntry] = {}
    for e in entries:
        entry_by_target.setdefault((e.target_type, e.target_id), e)
    top_targets = []
    for (target_type, target_id), total in sorted(target_totals.items(), key=lambda kv: kv[1], reverse=True)[:top_n]:
        rep_entry = entry_by_target[(target_type, target_id)]
        top_targets.append({
            "target_type": target_type, "target_id": target_id,
            "label": _entry_label(session, rep_entry, lookups), "total": total,
        })

    return {
        "date": date, "bucket_min": bucket_min, "buckets": buckets,
        "reasons_present": reasons_present, "top_targets": top_targets,
    }


@router.get("/summary")
def stats_summary(
    days: int = 30,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Item 1108: scanschema (gepland/uitgevoerd) + cmd-queue-uitkomst
    (ScanHistoryDaily) samengevat over een rollend venster - systeembreed,
    geen competitie/dag-filter (dat onderscheidt dit van /day en
    /competition/{id})."""
    days = max(1, min(days, 180))
    since = (datetime.utcnow() - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)

    entries = session.exec(
        select(ScanScheduleEntry)
        .where(ScanScheduleEntry.status == "promoted")
        .where(ScanScheduleEntry.planned_at >= since)
    ).all()

    totals_by_date: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for e in entries:
        totals_by_date[e.planned_at.date().isoformat()][e.reason] += 1

    daily_totals = []
    cursor = since
    today = datetime.utcnow().date()
    while cursor.date() <= today:
        d = cursor.date().isoformat()
        by_reason = dict(totals_by_date.get(d, {}))
        daily_totals.append({"date": d, "total": sum(by_reason.values()), "by_reason": by_reason})
        cursor += timedelta(days=1)

    since_str = since.date().isoformat()
    history_rows = session.exec(
        select(ScanHistoryDaily).where(ScanHistoryDaily.date >= since_str)
    ).all()
    outcome_totals: Dict[str, Dict[str, int]] = defaultdict(lambda: {"success": 0, "failed": 0})
    for row in history_rows:
        key = "success" if row.outcome == "success" else "failed"
        outcome_totals[row.reason][key] += row.count
    outcome_by_reason = [
        {"reason": reason, "success": v["success"], "failed": v["failed"]}
        for reason, v in sorted(outcome_totals.items(), key=lambda kv: kv[1]["success"] + kv[1]["failed"], reverse=True)
    ]

    return {"since": since_str, "days": days, "daily_totals": daily_totals, "outcome_by_reason": outcome_by_reason}


@router.get("/poule-ranking")
def poule_ranking(
    days: int = 7,
    limit: int = 20,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Item 1104: vergelijk hoeveel scans elke poule heeft gehad, over een
    rollend venster."""
    days = max(1, min(days, 180))
    limit = max(1, min(limit, 100))
    since = (datetime.utcnow() - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)

    entries = session.exec(
        select(ScanScheduleEntry)
        .where(ScanScheduleEntry.status == "promoted")
        .where(ScanScheduleEntry.target_type == "poule")
        .where(ScanScheduleEntry.planned_at >= since)
    ).all()

    totals: Dict[int, int] = defaultdict(int)
    for e in entries:
        totals[e.target_id] += 1

    top_poule_ids = [pid for pid, _ in sorted(totals.items(), key=lambda kv: kv[1], reverse=True)[:limit]]
    poule_by_id = {p.poule_id: p for p in session.exec(
        select(HockeyPoule).where(col(HockeyPoule.poule_id).in_(top_poule_ids))
    ).all()} if top_poule_ids else {}
    comp_ids = {p.competition_id for p in poule_by_id.values() if p.competition_id}
    comp_by_id = {c.id: c for c in session.exec(
        select(HockeyCompetition).where(col(HockeyCompetition.id).in_(comp_ids))
    ).all()} if comp_ids else {}

    rows = []
    for poule_id in top_poule_ids:
        poule = poule_by_id.get(poule_id)
        comp = comp_by_id.get(poule.competition_id) if poule else None
        label = f"{comp.name} · {poule.name}" if comp and poule else (poule.name if poule else f"poule {poule_id}")
        rows.append({
            "target_type": "poule", "target_id": poule_id, "label": label,
            "competition_name": comp.name if comp else None, "total": totals[poule_id],
        })

    return {"since": since.date().isoformat(), "days": days, "rows": rows}


@router.get("/competition/{competition_id}")
def competition_stats(
    competition_id: int,
    days: int = 30,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Item 1096b: scan-stats voor 1 competitie (interne PK, niet hl_comp_id -
    dezelfde id als CompetitionRow/CompetitieDetailView al gebruiken)."""
    days = max(1, min(days, 180))
    since = (datetime.utcnow() - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)

    poules = session.exec(
        select(HockeyPoule).where(HockeyPoule.competition_id == competition_id)
    ).all()
    poule_ids = [p.poule_id for p in poules]

    entries = session.exec(
        select(ScanScheduleEntry)
        .where(ScanScheduleEntry.status == "promoted")
        .where(ScanScheduleEntry.target_type == "poule")
        .where(col(ScanScheduleEntry.target_id).in_(poule_ids))
        .where(ScanScheduleEntry.planned_at >= since)
    ).all() if poule_ids else []

    totals_by_date: Dict[str, int] = defaultdict(int)
    scan_count_by_poule: Dict[int, int] = defaultdict(int)
    for e in entries:
        totals_by_date[e.planned_at.date().isoformat()] += 1
        scan_count_by_poule[e.target_id] += 1

    daily_totals = []
    cursor = since
    today = datetime.utcnow().date()
    while cursor.date() <= today:
        d = cursor.date().isoformat()
        daily_totals.append({"date": d, "total": totals_by_date.get(d, 0)})
        cursor += timedelta(days=1)

    # item 07-09-2026 ("als de scan-queue is opgeruimd dan mist deze info?"):
    # ScanHistoryDaily.target_type/target_id (i.p.v. een join naar VangerCmd)
    # is de PERMANENTE bron - blijft kloppen ook nadat de vanger-queue is
    # opgeruimd. Historische rijen van vóór deze kolommen bestonden hebben
    # target_type=NULL en tellen dus niet mee - dat is geen fout, die
    # koppeling is nooit vastgelegd. "unknown" is wat er volgens het
    # scanschema wél gescand is maar nog geen success/failed-uitkomst heeft
    # (bv. nog pending/in_progress, of zo'n oudere rij).
    history_rows = session.exec(
        select(ScanHistoryDaily)
        .where(ScanHistoryDaily.target_type == "poule")
        .where(col(ScanHistoryDaily.target_id).in_(poule_ids))
        .where(ScanHistoryDaily.date >= since.date().isoformat())
    ).all() if poule_ids else []
    success = sum(r.count for r in history_rows if r.outcome == "success")
    failed = sum(r.count for r in history_rows if r.outcome == "failed")
    unknown = max(0, sum(scan_count_by_poule.values()) - success - failed)

    planned_poule_ids = {
        e.target_id for e in session.exec(
            select(ScanScheduleEntry)
            .where(ScanScheduleEntry.status == "planned")
            .where(ScanScheduleEntry.target_type == "poule")
            .where(col(ScanScheduleEntry.target_id).in_(poule_ids))
        ).all()
    } if poule_ids else set()

    poule_rows = [{
        "poule_id": p.poule_id, "name": p.name, "last_scanned_at": _iso(p.last_scanned_at),
        "scan_count": scan_count_by_poule.get(p.poule_id, 0),
        "schedule_status": "gepland" if p.poule_id in planned_poule_ids else "geen planning",
    } for p in poules]

    return {
        "competition_id": competition_id, "days": days, "daily_totals": daily_totals,
        "poules": poule_rows, "outcome": {"success": success, "failed": failed, "unknown": unknown},
    }
