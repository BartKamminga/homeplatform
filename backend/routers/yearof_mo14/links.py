"""Korte deel-links (https://webheaven.nl/l/<code>), inclusief het kale,
ongeprefixte shortlink_router dat main.py apart registreert.

Drie soorten (item 1186):
- site:   sitelink voor de ouder-WhatsApp, stuurt door met de teamcode (hele site).
- match:  wedstrijdlink voor de Vrienden-van-WhatsApp - de link zelf is het
          token, alleen deze wedstrijd (highlights), geeft de teamcode NIET prijs.
- player: spelerslink voor de Vrienden-van-WhatsApp - alleen het profiel van
          1 speelster incl. ouders/buddy/coaches (geen fotos, verslagen of uitslagen).
Wedstrijd- en spelerslinks vervallen standaard 10 dagen na aanmaken, los van
de rotatie van de sitelink, en kunnen ingetrokken worden.
"""

from datetime import datetime, timedelta
from typing import Optional

from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from core.auth import get_current_user
from core.crud import get_or_404
from core.database import get_session
from models.core import User
from models.yearof import YearOfPhoto, YearOfPlayer, YearOfShortLink, YearOfTeamLink

from ._shared import _valid_short_link, new_link_code
from .entries_timeline import _competition_timeline_items, _custom_timeline_items
from .og_preview import (
    DEFAULT_DESCRIPTION, DEFAULT_TITLE, default_image_png, match_image_png, preview_html, public_base_url,
)

router = APIRouter(tags=["yearof-mo14"])

SHORT_LINK_DEFAULT_DAYS = 10

# Wat een spelerslink van een speelster laat zien - bewust een whitelist,
# zodat nieuwe kolommen op YearOfPlayer niet vanzelf meelekken.
PLAYER_LINK_FIELDS = (
    "id", "name", "nickname", "shirt_number", "role_title", "position", "photo_url", "bio", "fun_facts",
    "parents", "buddy", "coaches",
)


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


def _match_description(item: dict) -> str:
    """Bv. "26-09-2026 · uitslag 4-1 · foto's en verslag van Victoria MO14-1"."""
    parts = []
    if item.get("date"):
        d = str(item["date"])[:10].split("-")
        parts.append("-".join(reversed(d)) if len(d) == 3 else str(item["date"])[:10])
    home = item.get("score_home", item.get("score_us"))
    away = item.get("score_away", item.get("score_them"))
    if home is not None and away is not None:
        parts.append(f"uitslag {home}-{away}")
    parts.append("foto's en verslag van Victoria MO14-1")
    return " · ".join(parts)


def _valid_until(link: YearOfShortLink, session: Session) -> str:
    """" · Link geldig t/m 16-10-2026"" voor in de preview. Sitelinks en legacy
    wedstrijdlinks volgen de vervaldatum van hun teamcode; verlopen = melding."""
    expires_at = link.expires_at
    team = session.get(YearOfTeamLink, link.team_code) if link.team_code and link.expires_at is None else None
    if team:
        if team.revoked_at is not None:
            return " · Deze link is verlopen"
        expires_at = team.expires_at
    if link.revoked_at is not None or (expires_at and expires_at < datetime.utcnow()):
        return " · Deze link is verlopen"
    return f" · Link geldig t/m {expires_at:%d-%m-%Y}" if expires_at else ""


@shortlink_router.get("/l/{code}", response_class=HTMLResponse)
def resolve_short_link(code: str, request: Request, session: Session = Depends(get_session)):
    """Geeft een kleine HTML-pagina met link-preview (og:-tags, zie
    og_preview.py) die direct doorstuurt - een kale redirect toont in WhatsApp
    alleen "webheaven.nl". Ook verlopen wedstrijd-/spelerslinks sturen door
    naar hun pagina, zodat die een duidelijke "link verlopen"-melding kan tonen
    i.p.v. de teamcode-invoer (vrienden hebben geen teamcode)."""
    link = session.get(YearOfShortLink, code.strip().lower())
    base = public_base_url(request)
    preview = {"title": DEFAULT_TITLE, "description": DEFAULT_DESCRIPTION, "image_path": None}

    if not link:
        target = "/yearof-mo14/"
    elif link.link_type == "player":
        target = f"/yearof-mo14/?speler={link.id}"
        player = session.get(YearOfPlayer, link.player_id) if _valid_short_link(link.id, session) else None
        if player and player.archived_at is None:
            name = player.nickname or player.name
            preview = {
                "title": f"{name} · MO14 à Paris",
                "description": f"Maak kennis met {name} van Victoria MO14-1 - samen op weg naar Parijs!{_valid_until(link, session)}",
                "image_path": player.photo_url,
            }
    elif link.link_type == "match":
        target = f"/yearof-mo14/?entry={quote(link.match_ref or '')}&link={link.id}"
        if _valid_short_link(link.id, session):
            item = _find_timeline_item(session, link.match_ref)
            title = item.get("title")
            # Plaatje: clublogo's + uitslag (competitie, herkenbaar), anders een
            # highlight-foto (bv. oefenwedstrijd zonder logo's), anders standaard.
            # score in de URL: WhatsApp cachet per URL, na de uitslag dus vers.
            if item.get("home_club_logo") or item.get("away_club_logo"):
                image_path = f"/api/yearof-mo14/og-match.png?ref={quote(link.match_ref)}&s={quote(_score_text(item))}"
            else:
                photo = session.exec(
                    select(YearOfPhoto)
                    .where(YearOfPhoto.match_ref == link.match_ref, YearOfPhoto.status == "published",
                           YearOfPhoto.match_highlight == True, YearOfPhoto.media_type == "photo")  # noqa: E712
                    .order_by(YearOfPhoto.created_at.desc())
                ).first()
                image_path = f"/api/yearof-mo14/photos/{photo.id}/medium.jpg" if photo else None
            preview = {
                "title": f"{title or 'Wedstrijd'} · MO14 à Paris",
                "description": _match_description(item) + _valid_until(link, session),
                "image_path": image_path,
            }
    else:
        target = f"/yearof-mo14/?code={link.team_code}"
        preview["description"] = DEFAULT_DESCRIPTION + _valid_until(link, session)

    if link and link.link_type in ("player", "match") and preview["title"] == DEFAULT_TITLE:
        preview["description"] = f"{DEFAULT_DESCRIPTION} · Deze link is verlopen"

    return HTMLResponse(preview_html(base=base, link_path=f"/l/{code}", target=target, **preview))


DUTCH_DAYS = ("ma", "di", "wo", "do", "vr", "za", "zo")
DUTCH_MONTHS = ("januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus",
                "september", "oktober", "november", "december")


def _find_timeline_item(session: Session, match_ref: Optional[str]) -> dict:
    return next((i for i in _competition_timeline_items(session) + _custom_timeline_items(session)
                 if i["match_ref"] == match_ref), None) or {}


def _score_text(item: dict) -> str:
    home = item.get("score_home", item.get("score_us"))
    away = item.get("score_away", item.get("score_them"))
    return f"{home} - {away}" if home is not None and away is not None else "vs"


@router.get("/og-match.png")
def og_match_image(ref: str, session: Session = Depends(get_session)):
    """Publiek - wedstrijdplaatje voor link-previews: beide clublogo's +
    uitslag + datum (alleen openbare competitiegegevens)."""
    item = _find_timeline_item(session, ref)
    if not item or not (item.get("home_club_logo") or item.get("away_club_logo")):
        raise HTTPException(status_code=404, detail="Geen wedstrijdplaatje")
    home, _, away = item["title"].partition(" - ")
    date = ""
    if item.get("date"):
        d = datetime.fromisoformat(str(item["date"])[:19])
        date = f"{DUTCH_DAYS[d.weekday()]} {d.day} {DUTCH_MONTHS[d.month - 1]} {d.year}"
    png = match_image_png(home, away, item.get("home_club_logo"), item.get("away_club_logo"), _score_text(item), date)
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})


@router.get("/og-default.png")
def og_default_image():
    """Publiek - standaardplaatje voor link-previews (zie og_preview.py)."""
    return Response(content=default_image_png(), media_type="image/png",
                    headers={"Cache-Control": "public, max-age=86400"})
