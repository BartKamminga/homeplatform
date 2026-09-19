"""Item 1167: signalering van scandata-vorm-afwijkingen (bv. ontbrekend
district) die apply_poule_capture opvangt zonder een poule los te trekken
van zijn competitie (zie DataShapeFlag/hockey_poule_capture_core.py). Los
bestand i.p.v. toevoegen aan hockey_vanger_stats.py (al 290 regels)."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.hockey_discovery import DataShapeFlag, HockeyCompetition, HockeyPoule

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
