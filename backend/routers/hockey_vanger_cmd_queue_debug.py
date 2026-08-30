"""Debug-pagina voor de vanger-queue (Bart: "een debug pagina met de echte
queue, waarbij ik obv selecties de queue kan doorlopen") - puur lezend,
muteert de queue niet. Los bestand i.p.v. hockey_vanger_cmd_queue.py uit te
breiden, om het al werkende GET /vanger/cmd-queue (Scout-tab) niet te raken."""

import json
from typing import Optional

from fastapi import APIRouter, Depends
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.hockey_discovery import VangerCmd
from services.hockey_vanger_filters import _cmd_matches_filter, _get_queue_filter

router = APIRouter(prefix="/api/hockey", tags=["hockey-vanger"])

VALID_STATUSES = {"pending", "in_progress", "done", "failed", "skipped"}
VALID_CMD_TYPES = {"get_poule", "scan_club", "get_clubs", "get_competition_detail", "get_competitions"}


def _iso(dt) -> Optional[str]:
    return dt.isoformat() + "Z" if dt else None


@router.get("/vanger/cmd-queue/browse")
def browse_cmd_queue(
    status: Optional[str] = None,
    cmd_type: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Filterbare, gepagineerde lijst van de echte vanger-queue - i.t.t. het
    bestaande GET /vanger/cmd-queue (vast op de laatste 200, ongefilterd)."""
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    query = select(VangerCmd)
    if status in VALID_STATUSES:
        query = query.where(VangerCmd.status == status)
    if cmd_type in VALID_CMD_TYPES:
        query = query.where(VangerCmd.cmd_type == cmd_type)
    query = query.order_by(col(VangerCmd.id).desc())

    matching = session.exec(query).all()
    if search:
        needle = search.lower()
        matching = [c for c in matching if needle in c.params.lower()]
    total = len(matching)
    page = matching[offset:offset + limit]

    ages, club, cats, hts, genders = _get_queue_filter(session)
    items = []
    for cmd in page:
        try:
            params = json.loads(cmd.params)
        except (ValueError, TypeError):
            params = {}
        in_filter = _cmd_matches_filter(session, cmd.cmd_type, params, ages, club, cats, hts, genders)
        items.append({
            "id": cmd.id,
            "cmd_type": cmd.cmd_type,
            "params": params,
            "status": cmd.status,
            "created_at": _iso(cmd.created_at),
            "started_at": _iso(cmd.started_at),
            "finished_at": _iso(cmd.finished_at),
            "error": cmd.error,
            "in_active_filter": in_filter,
        })
    return {"total": total, "items": items}


@router.get("/vanger/cmd-queue/preview-next")
def preview_next_cmd(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Simuleert GET /vanger/cmd-queue/next (welke cmd Ghost/Scout nu zou
    oppakken) ZONDER de queue te muteren - om de queue-filter te debuggen
    (roadmap-melding: cmds bleven stilzwijgend uren buiten het filter liggen)."""
    ages, club, cats, hts, genders = _get_queue_filter(session)
    pending = session.exec(
        select(VangerCmd).where(VangerCmd.status == "pending").order_by(col(VangerCmd.id).asc())
    ).all()
    skipped = 0
    for cmd in pending:
        try:
            params = json.loads(cmd.params)
        except (ValueError, TypeError):
            continue
        if _cmd_matches_filter(session, cmd.cmd_type, params, ages, club, cats, hts, genders):
            return {
                "found": True,
                "skipped_count": skipped,
                "id": cmd.id,
                "cmd_type": cmd.cmd_type,
                "params": params,
                "created_at": _iso(cmd.created_at),
            }
        skipped += 1
    return {"found": False, "skipped_count": skipped}
