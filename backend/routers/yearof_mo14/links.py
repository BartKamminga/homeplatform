"""Korte deel-links (https://webheaven.nl/l/<code>), inclusief het kale,
ongeprefixte shortlink_router dat main.py apart registreert.

Drie soorten (item 1186):
- site:   sitelink voor de ouder-WhatsApp, stuurt door met de teamcode (hele site).
- match:  wedstrijdlink voor de Vrienden-van-WhatsApp - de link zelf is het
          token, alleen deze wedstrijd (highlights), geeft de teamcode NIET prijs.
- player: spelerslink voor de Vrienden-van-WhatsApp - alleen de basisvelden van
          1 speelster (geen fotos, verslagen, uitslagen of ouders/buddy/coaches).
Wedstrijd- en spelerslinks vervallen standaard 10 dagen na aanmaken, los van
de rotatie van de sitelink, en kunnen ingetrokken worden.
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from core.auth import get_current_user
from core.crud import get_or_404
from core.database import get_session
from models.core import User
from models.yearof import YearOfPlayer, YearOfShortLink

from ._shared import _valid_short_link, new_link_code

router = APIRouter(tags=["yearof-mo14"])

SHORT_LINK_DEFAULT_DAYS = 10

# Wat een spelerslink van een speelster laat zien - bewust een whitelist,
# zodat nieuwe kolommen op YearOfPlayer niet vanzelf meelekken.
PLAYER_LINK_FIELDS = ("id", "name", "nickname", "shirt_number", "role_title", "position", "photo_url", "bio", "fun_facts")


class ShortLinkIn(BaseModel):
    team_code: Optional[str] = None
    match_ref: Optional[str] = None
    player_id: Optional[str] = None
    expires_days: int = SHORT_LINK_DEFAULT_DAYS


@router.post("/short-links")
def create_short_link(
    body: ShortLinkIn,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder-only. Hergebruikt een bestaande, nog geldige korte link voor
    exact hetzelfde doel i.p.v. bij elke klik een nieuwe rij aan te maken."""
    now = datetime.utcnow()
    if body.player_id:
        get_or_404(session, YearOfPlayer, body.player_id, "Speler")
        link_type = "player"
        q = select(YearOfShortLink).where(YearOfShortLink.link_type == "player", YearOfShortLink.player_id == body.player_id)
    elif body.match_ref:
        link_type = "match"
        q = select(YearOfShortLink).where(YearOfShortLink.link_type == "match", YearOfShortLink.match_ref == body.match_ref)
    elif body.team_code:
        link_type = "site"
        q = select(YearOfShortLink).where(YearOfShortLink.link_type == "site", YearOfShortLink.team_code == body.team_code)
    else:
        raise HTTPException(status_code=400, detail="Geef team_code, match_ref of player_id op")

    if link_type == "site":
        existing = session.exec(q).first()
        if existing:
            return existing
    else:
        # Alleen nieuwe-stijl links (met eigen vervaldatum) hergebruiken -
        # legacy wedstrijdlinks lopen vanzelf af met hun teamcode.
        q = q.where(YearOfShortLink.revoked_at.is_(None), YearOfShortLink.expires_at > now)
        existing = session.exec(q.order_by(YearOfShortLink.created_at.desc())).first()
        if existing:
            return existing

    link = YearOfShortLink(
        id=new_link_code(session),
        link_type=link_type,
        team_code=(body.team_code or "") if link_type == "site" else "",
        match_ref=body.match_ref if link_type == "match" else None,
        player_id=body.player_id if link_type == "player" else None,
        expires_at=None if link_type == "site" else now + timedelta(days=body.expires_days),
    )
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


@router.get("/short-links")
def list_short_links(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return session.exec(select(YearOfShortLink).order_by(YearOfShortLink.created_at.desc())).all()


@router.post("/short-links/{code}/revoke")
def revoke_short_link(
    code: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    link = get_or_404(session, YearOfShortLink, code.strip().lower(), "Link")
    link.revoked_at = datetime.utcnow()
    session.add(link)
    session.commit()
    return {"ok": True}


@router.get("/short-links/{code}/validate")
def validate_short_link(code: str, session: Session = Depends(get_session)):
    """Publiek — de losse wedstrijdpagina checkt hiermee of de link (nog) geldig is."""
    link = _valid_short_link(code, session)
    if not link:
        return {"valid": False}
    return {"valid": True, "link_type": link.link_type, "match_ref": link.match_ref}


@router.get("/player-links/{code}")
def get_player_link_view(code: str, session: Session = Depends(get_session)):
    """Publiek — de spelerslink zelf is het bewijs. Geeft alleen de
    PLAYER_LINK_FIELDS van die ene speelster terug."""
    link = _valid_short_link(code, session)
    if not link or link.link_type != "player":
        raise HTTPException(status_code=403, detail="Deze link is verlopen of ongeldig")
    player = session.get(YearOfPlayer, link.player_id)
    if not player or player.archived_at is not None:
        raise HTTPException(status_code=404, detail="Speler niet gevonden")
    return {field: getattr(player, field) for field in PLAYER_LINK_FIELDS}


# Kaal, niet onder /api/yearof-mo14 - apart geregistreerd in main.py, want
# dit pad moet zo kort mogelijk blijven.
shortlink_router = APIRouter(tags=["yearof-mo14-shortlinks"])


@shortlink_router.get("/l/{code}")
def resolve_short_link(code: str, session: Session = Depends(get_session)):
    """Ook verlopen wedstrijd-/spelerslinks sturen door naar hun pagina, zodat
    die een duidelijke "link verlopen"-melding kan tonen i.p.v. de
    teamcode-invoer (vrienden hebben geen teamcode)."""
    link = session.get(YearOfShortLink, code.strip().lower())
    if not link:
        return RedirectResponse("/yearof-mo14/")
    if link.link_type == "player":
        return RedirectResponse(f"/yearof-mo14/?speler={link.id}")
    if link.link_type == "match":
        return RedirectResponse(f"/yearof-mo14/?entry={link.match_ref}&link={link.id}")
    return RedirectResponse(f"/yearof-mo14/?code={link.team_code}")
