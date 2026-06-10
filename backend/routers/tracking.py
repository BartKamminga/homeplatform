from fastapi import APIRouter, Depends, Request
from sqlmodel import Session
from pydantic import BaseModel

from core.database import get_session
from core.limiter import limiter
from core.logging import log_action

router = APIRouter(prefix="/api", tags=["tracking"])


class TrackRequest(BaseModel):
    site: str
    action: str
    details: dict


@router.post("/track")
@limiter.limit("60/minute")
def track(request: Request, data: TrackRequest, session: Session = Depends(get_session)):
    """Publiek endpoint — registreert een paginabezoek in de audit log."""
    log_action(session, data.action, site=data.site, payload=data.details)
    return {"ok": True}
