"""Item 1167: signalering van scandata-vorm-afwijkingen (bv. ontbrekend
district) die apply_poule_capture opvangt zonder een poule los te trekken
van zijn competitie (zie DataShapeFlag/hockey_poule_capture_core.py). Los
bestand i.p.v. toevoegen aan hockey_vanger_stats.py (al 290 regels)."""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.hockey_discovery import DataShapeFlag, HockeyCompetition, HockeyPoule
from services import hockey_contract_check as contract_check

router = APIRouter(prefix="/api/hockey/vanger", tags=["hockey-vanger"])


@router.get("/data-shape-flags")
def list_data_shape_flags(
    days: int = 14,
    limit: int = 100,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    days = max(1, min(days, 90))
    limit = max(1, min(limit, 500))
    since = datetime.utcnow() - timedelta(days=days)

    flags = session.exec(
        select(DataShapeFlag)
        .where(DataShapeFlag.created_at >= since)
        .order_by(col(DataShapeFlag.created_at).desc())
        .limit(limit)
    ).all()

    comp_ids = {f.competition_id for f in flags}
    comp_by_id = {c.id: c for c in session.exec(
        select(HockeyCompetition).where(col(HockeyCompetition.id).in_(comp_ids))
    ).all()} if comp_ids else {}
    poule_by_id = {p.poule_id: p for p in session.exec(
        select(HockeyPoule).where(col(HockeyPoule.poule_id).in_({f.poule_id for f in flags}))
    ).all()} if flags else {}

    rows = []
    for f in flags:
        comp = comp_by_id.get(f.competition_id)
        poule = poule_by_id.get(f.poule_id)
        rows.append({
            "poule_id": f.poule_id,
            "poule_name": poule.name if poule else None,
            "competition_name": comp.name if comp else None,
            "missing_field": f.missing_field,
            "detail": f.detail,
            "created_at": f.created_at.isoformat(),
        })

    return {"since": since.date().isoformat(), "days": days, "total": len(rows), "rows": rows}


# ── Item 1257: dagelijkse contract-check hockey.nl ────────────────────────────

@router.get("/contract-check")
def get_contract_check(session: Session = Depends(get_session), _=Depends(get_current_user)):
    """Vaste testdoelen, laatste uitkomst per doel en recente parse-fouten."""
    state = contract_check.load_state(session)
    return {
        "last_run": state.get("last_run"),
        "targets": state["targets"],
        "results": state["results"],
        "parse_failed": state["parse_failed"],
        "has_baseline": sorted(state["baselines"]),
    }


@router.post("/contract-check/run")
def run_contract_check(session: Session = Depends(get_session), _=Depends(get_current_user)):
    """Nu inplannen (los van de 24-uursdrempel)."""
    added = contract_check.maybe_run_contract_check(session, datetime.utcnow(), force=True)
    return {"queued": added}


@router.post("/contract-check/accept")
def accept_contract_check(cmd_type: Optional[str] = None, session: Session = Depends(get_session),
                          _=Depends(get_current_user)):
    """Bewuste wijziging bij hockey.nl: de laatst geziene vorm wordt de basislijn."""
    return {"accepted": contract_check.accept_current_shape(session, cmd_type)}
