"""Hockey vanger — queue-filter-instellingen (categorie/type) - opgesplitst
uit hockey_vanger.py (refactor-plan hockey-inside Fase 3, RFTR-B3).
Leeftijd/club/geslacht waren ooit ook filter-dimensies, verwijderd in item
1089."""

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session

from core.auth import get_current_user
from core.database import get_session
from models.settings import AppSetting
from services.hockey_vanger_filters import DISC_FILTER_CAT, DISC_FILTER_HT, _get_queue_filter

router = APIRouter(prefix="/api/hockey", tags=["hockey-vanger"])


class QueueFilterBody(BaseModel):
    categories:   List[str] = []
    hockey_types: List[str] = []


@router.get("/queue-filter")
def get_queue_filter(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    cats, hts = _get_queue_filter(session)
    return {"categories": cats, "hockey_types": hts}


@router.patch("/queue-filter")
def update_queue_filter(
    body: QueueFilterBody,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for key, val in [
        (DISC_FILTER_CAT, ",".join(body.categories)   if body.categories   else "Junioren"),
        (DISC_FILTER_HT,  ",".join(body.hockey_types) if body.hockey_types else "VE"),
    ]:
        row = session.get(AppSetting, key)
        if row:
            row.value = val
            row.updated_at = now
            session.add(row)
        else:
            session.add(AppSetting(key=key, value=val, updated_at=now))
    session.commit()
    cats, hts = _get_queue_filter(session)
    return {"categories": cats, "hockey_types": hts}
