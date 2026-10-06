"""Teamlinkje (viewer-toegang, de "sitelink" voor ouders) — create/list/validate.
Korte deel-links (wedstrijd-/spelerslinks, /l/<code>) staan sinds item 1186 in
links.py. Zie __init__.py voor hoe router hier samengevoegd wordt onder
/api/yearof-mo14."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from core.auth import get_current_user
from core.database import get_session
from models.core import User
from models.yearof import YearOfTeamLink

from ._shared import _valid_team_link, new_link_code

router = APIRouter(tags=["yearof-mo14"])


# ---------------------------------------------------------------------------
# Teamlinkje (viewer-toegang) — v1: simpele code, handmatig vervangen.
# Per-wedstrijd rotatie + vangnet + content-scoping volgen in fase 1149.
# ---------------------------------------------------------------------------

TEAM_LINK_DEFAULT_VANGNET_DAYS = 10


@router.post("/team-links")
def create_team_link(
    vangnet_days: int = TEAM_LINK_DEFAULT_VANGNET_DAYS,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Nieuw teamlinkje aanmaken; alle eerder actieve linkjes worden direct
    ingetrokken. Vangnet (instelbaar, default 10 dagen) is een extra
    vervalmoment naast die directe intrekking, voor als er een langere
    pauze tussen wedstrijden zit."""
    active = session.exec(
        select(YearOfTeamLink).where(YearOfTeamLink.revoked_at.is_(None))
    ).all()
    now = datetime.utcnow()
    for link in active:
        link.revoked_at = now
        session.add(link)

    code = new_link_code(session)
    new_link = YearOfTeamLink(id=code, expires_at=now + timedelta(days=vangnet_days))
    session.add(new_link)
    session.commit()
    session.refresh(new_link)
    return new_link


@router.get("/team-links")
def list_team_links(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return session.exec(select(YearOfTeamLink).order_by(YearOfTeamLink.created_at.desc())).all()


@router.get("/team-links/validate")
def validate_team_link(code: str, session: Session = Depends(get_session)):
    """Publiek — de Gate-pagina checkt hiermee of een ingevoerde code (nog) geldig is."""
    return {"valid": _valid_team_link(code, session) is not None}
