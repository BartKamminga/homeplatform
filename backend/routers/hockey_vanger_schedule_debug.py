"""Debug-pagina voor het SCANSCHEMA (ScanScheduleEntry, item 1015) - niet te
verwarren met de echte uitvoeringsqueue (VangerCmd, zie
hockey_vanger_cmd_queue_debug.py). Puur lezend, muteert niets."""

import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.hockey_discovery import HockeyClub, HockeyCompetition, HockeyPoule, ScanScheduleEntry

router = APIRouter(prefix="/api/hockey", tags=["hockey-vanger"])

VALID_STATUSES = {"planned", "promoted", "cancelled"}
VALID_REASONS = {
    "matchday_burst", "daily_fallback", "live_check", "manual_weekly",
    "unknown_start_recheck", "new_or_empty", "club_scan", "club_list",
}
VALID_TARGET_TYPES = {"poule", "competition", "club"}


def _iso(dt) -> Optional[str]:
    return dt.isoformat() + "Z" if dt else None


def _label_for(entry: ScanScheduleEntry, poule_by_id: dict, comp_by_hl_id: dict, club_by_id: dict) -> str:
    if entry.target_type == "poule":
        poule = poule_by_id.get(entry.target_id)
        if not poule:
            return f"poule {entry.target_id} (onbekend/verwijderd)"
        return f"{poule.name} · poule {entry.target_id}"
    if entry.target_type == "competition":
        comp = comp_by_hl_id.get(entry.target_id)
        return comp.name if comp else f"competitie {entry.target_id} (onbekend)"
    if entry.target_type == "club":
        club = club_by_id.get(entry.target_id)
        return club.friendly_name or club.name if club else f"club {entry.target_id}"
    return str(entry.target_id)


@router.get("/vanger/schedule/browse")
def browse_schedule(
    status: Optional[str] = None,
    reason: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    date: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Filterbare, gepagineerde lijst van het scanschema (ScanScheduleEntry) -
    de vooraf berekende, toekomstgerichte planning (Fase A, schaduw-modus),
    los van de echte uitvoeringsqueue (VangerCmd). date/target_id maken het
    mogelijk om vanuit de Kalender-tab direct door te linken naar "wat staat
    er gepland voor DEZE dag/poule" (item: link vanaf de kalender-rij)."""
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    query = select(ScanScheduleEntry)
    if status in VALID_STATUSES:
        query = query.where(ScanScheduleEntry.status == status)
    if reason in VALID_REASONS:
        query = query.where(ScanScheduleEntry.reason == reason)
    if target_type in VALID_TARGET_TYPES:
        query = query.where(ScanScheduleEntry.target_type == target_type)
    if target_id is not None:
        query = query.where(ScanScheduleEntry.target_id == target_id)
    if date:
        try:
            day_start = datetime.fromisoformat(date)
            day_end = day_start + timedelta(days=1)
            query = query.where(ScanScheduleEntry.planned_at >= day_start).where(ScanScheduleEntry.planned_at < day_end)
        except ValueError:
            pass
    query = query.order_by(col(ScanScheduleEntry.planned_at).asc())

    matching = session.exec(query).all()

    poule_ids = {e.target_id for e in matching if e.target_type == "poule"}
    comp_ids = {e.target_id for e in matching if e.target_type == "competition"}
    club_ids = {e.target_id for e in matching if e.target_type == "club"}
    poule_by_id = {p.poule_id: p for p in session.exec(
        select(HockeyPoule).where(col(HockeyPoule.poule_id).in_(poule_ids))
    ).all()} if poule_ids else {}
    comp_by_hl_id = {c.hl_comp_id: c for c in session.exec(
        select(HockeyCompetition).where(col(HockeyCompetition.hl_comp_id).in_(comp_ids))
    ).all()} if comp_ids else {}
    club_by_id = {c.id: c for c in session.exec(
        select(HockeyClub).where(col(HockeyClub.id).in_(club_ids))
    ).all()} if club_ids else {}

    if search:
        needle = search.lower()
        matching = [
            e for e in matching
            if needle in e.params.lower() or needle in _label_for(e, poule_by_id, comp_by_hl_id, club_by_id).lower()
        ]
    total = len(matching)
    page = matching[offset:offset + limit]

    items = []
    for entry in page:
        try:
            params = json.loads(entry.params)
        except (ValueError, TypeError):
            params = {}
        items.append({
            "id": entry.id,
            "target_type": entry.target_type,
            "target_id": entry.target_id,
            "label": _label_for(entry, poule_by_id, comp_by_hl_id, club_by_id),
            "cmd_type": entry.cmd_type,
            "params": params,
            "planned_at": _iso(entry.planned_at),
            "reason": entry.reason,
            "status": entry.status,
            "vanger_cmd_id": entry.vanger_cmd_id,
            "created_at": _iso(entry.created_at),
        })
    return {"total": total, "items": items}


@router.get("/vanger/schedule/summary")
def schedule_summary(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Aantal scanschema-rijen per status en per reason - snel overzicht
    zonder alles te hoeven ophalen/pagineren."""
    entries = session.exec(select(ScanScheduleEntry)).all()
    by_status: dict = {}
    by_reason: dict = {}
    for e in entries:
        by_status[e.status] = by_status.get(e.status, 0) + 1
        if e.status == "planned":
            by_reason[e.reason] = by_reason.get(e.reason, 0) + 1
    return {"total": len(entries), "by_status": by_status, "by_reason_planned": by_reason}
