from fastapi import APIRouter, Depends
from sqlmodel import Session
from pydantic import BaseModel

from core.database import get_session
from core.logging import log_action

router = APIRouter(prefix="/api", tags=["tracking"])


class TrackRequest(BaseModel):
    site: str
    path: str


@router.post("/track")
def track(data: TrackRequest, session: Session = Depends(get_session)):
    """Publiek endpoint — registreert een paginabezoek in de audit log."""
    log_action(session, "page.view", site=data.site, payload={"path": data.path})
    return {"ok": True}
