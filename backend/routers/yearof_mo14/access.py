"""Teamlinkje (viewer-toegang) — create/list/validate — en korte deel-links
(https://webheaven.nl/l/<code>), inclusief het kale, ongeprefixte
shortlink_router dat main.py apart registreert. Zie __init__.py voor hoe
router hier samengevoegd wordt onder /api/yearof-mo14 en hoe shortlink_router
1-op-1 doorgegeven wordt."""

import random
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.core import User
from models.yearof import YearOfShortLink, YearOfTeamLink

from ._shared import TEAM_LINK_CHARS, _valid_team_link

router = APIRouter(tags=["yearof-mo14"])


# ---------------------------------------------------------------------------
# Teamlinkje (viewer-toegang) — v1: simpele code, handmatig vervangen.
# Per-wedstrijd rotatie + vangnet + content-scoping volgen in fase 1149.
# ---------------------------------------------------------------------------

def _new_team_link_code(session: Session) -> str:
    for _ in range(20):
        code = "".join(random.choices(TEAM_LINK_CHARS, k=6))
        if not session.get(YearOfTeamLink, code):
            return code
    raise RuntimeError("Geen unieke code gevonden")


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

    code = _new_team_link_code(session)
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


# ---------------------------------------------------------------------------
# Korte deel-links (https://webheaven.nl/l/<code>) — server-side redirect naar
# een bevroren (team_code, match_ref)-combinatie. Bewust bevroren i.p.v.
# dynamisch naar de huidige actieve teamcode verwijzen, zie YearOfShortLink.
# ---------------------------------------------------------------------------


def _new_short_link_code(session: Session) -> str:
    for _ in range(20):
        code = "".join(random.choices(TEAM_LINK_CHARS, k=6))
        if not session.get(YearOfShortLink, code):
            return code
    raise RuntimeError("Geen unieke code gevonden")


class ShortLinkIn(BaseModel):
    team_code: str
    match_ref: Optional[str] = None


@router.post("/short-links")
def create_short_link(
    body: ShortLinkIn,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder-only. Hergebruikt een bestaande korte link voor exact dezelfde
    (team_code, match_ref)-combinatie i.p.v. bij elke klik een nieuwe rij aan
    te maken."""
    q = select(YearOfShortLink).where(YearOfShortLink.team_code == body.team_code)
    q = q.where(YearOfShortLink.match_ref == body.match_ref) if body.match_ref else q.where(col(YearOfShortLink.match_ref).is_(None))
    existing = session.exec(q).first()
    if existing:
        return existing

    link = YearOfShortLink(id=_new_short_link_code(session), team_code=body.team_code, match_ref=body.match_ref)
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


# Kaal, niet onder /api/yearof-mo14 - zie shortlink_router hieronder, apart
# geregistreerd in main.py, want dit pad moet zo kort mogelijk blijven.
shortlink_router = APIRouter(tags=["yearof-mo14-shortlinks"])


@shortlink_router.get("/l/{code}")
def resolve_short_link(code: str, session: Session = Depends(get_session)):
    link = session.get(YearOfShortLink, code.strip().lower())
    if not link:
        return RedirectResponse("/yearof-mo14/")
    target = f"/yearof-mo14/?entry={link.match_ref}&code={link.team_code}" if link.match_ref \
        else f"/yearof-mo14/?code={link.team_code}"
    return RedirectResponse(target)
