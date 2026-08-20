from fastapi import APIRouter, Depends, Request
from sqlmodel import Session
from pydantic import BaseModel

from core.analytics import client_ip, hash_ip, log_site_event
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
    """Publiek endpoint — registreert een paginabezoek in de audit log én (voor
    page.view) in site_events, waar de admin site-monitoring (/api/admin/site-stats)
    uit leest — dat las tot nu toe een andere tabel dan waar dit endpoint naar
    schreef, waardoor bezoeken nooit in de monitoring verschenen."""
    log_action(session, data.action, site=data.site, payload=data.details)
    if data.action == "page.view":
        ip_hash = hash_ip(client_ip(request))
        log_site_event(
            data.site, "page_view",
            ip_hash=ip_hash,
            user_agent=request.headers.get("User-Agent", ""),
            endpoint=data.details.get("path"),
        )
    return {"ok": True}
