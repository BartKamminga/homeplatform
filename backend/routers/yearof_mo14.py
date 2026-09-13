"""YearOf MO14 ("MO14 à Paris") — supportersite voor Victoria MO14-1.

Fase 1 (item 1143): fundament — status/me-endpoints.
Fase 2 (item 1144): kerndata — spelers-CRUD, wedstrijden/bijzondere-dagen-CRUD,
en een samengevoegde tijdlijn (competitie via hockey-inside/Poulebord + de
handmatige YearOfCustomEntry-rijen).
Fase 3 (item 1145): publieke basispagina's + teamlinkje v1 (simpele code,
handmatig vervangen door de beheerder). Nog GEEN server-side afdwinging op
de publieke GET-endpoints hieronder — dat volgt met content-scoping in fase
1149/fase 7. Voor nu is het teamlinkje een client-side toegangsdeur.

Single-tenant, bewust hardcoded voor Victoria MO14-1 (poule_id 551, Topklasse
Zuid-Holland poule B, seizoen 2026-2027) - zie roadmap item 1142/1143.
Publieke content/tokens (teamlinkje, foto's, verslagen) komen in latere fases.
"""

import random
import string
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from core.auth import get_current_user
from core.crud import get_or_404
from core.database import get_session
from models.core import User
from models.hockey_discovery import HockeyPoule
from models.yearof import YearOfCustomEntry, YearOfPlayer, YearOfTeamLink
from routers.hockey_public import _serialize_poule_matches

router = APIRouter(prefix="/api/yearof-mo14", tags=["yearof-mo14"])

TEAM_NAME = "Victoria MO14-1"
POULE_ID = 551  # HockeyPoule.id, single-tenant hardcoded (zie item 1143 architectuurbeslissing)


@router.get("/status")
def status():
    """Publiek, geen auth — bewijst dat de site/router leeft."""
    return {"site": "yearof-mo14", "fase": 3, "status": "publieke basispaginas + teamlinkje v1"}


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    """Beheerder-only — bewijst dat de bestaande homeplatform-login werkt voor deze site."""
    return {"username": current_user.username, "email": current_user.email}


# ---------------------------------------------------------------------------
# Spelers
# ---------------------------------------------------------------------------

class PlayerIn(BaseModel):
    name: str
    nickname: Optional[str] = None
    shirt_number: Optional[int] = None
    position: Optional[str] = None
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    fun_facts: Optional[str] = None  # JSON-string


class PlayerUpdate(BaseModel):
    name: Optional[str] = None
    nickname: Optional[str] = None
    shirt_number: Optional[int] = None
    position: Optional[str] = None
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    fun_facts: Optional[str] = None


@router.get("/players")
def list_players(session: Session = Depends(get_session)):
    rows = session.exec(select(YearOfPlayer).order_by(YearOfPlayer.shirt_number)).all()
    return rows


@router.get("/players/{player_id}")
def get_player(player_id: str, session: Session = Depends(get_session)):
    return get_or_404(session, YearOfPlayer, player_id, "Speler")


@router.post("/players")
def create_player(
    body: PlayerIn,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    player = YearOfPlayer(**body.model_dump())
    session.add(player)
    session.commit()
    session.refresh(player)
    return player


@router.patch("/players/{player_id}")
def update_player(
    player_id: str,
    body: PlayerUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    player = get_or_404(session, YearOfPlayer, player_id, "Speler")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(player, key, value)
    session.add(player)
    session.commit()
    session.refresh(player)
    return player


@router.delete("/players/{player_id}")
def delete_player(
    player_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    player = get_or_404(session, YearOfPlayer, player_id, "Speler")
    session.delete(player)
    session.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Oefenwedstrijden & bijzondere dagen (YearOfCustomEntry)
# ---------------------------------------------------------------------------

class CustomEntryIn(BaseModel):
    kind: str = "oefen"  # "oefen" | "bijzonder"
    title: str
    date: str  # ISO datum/datetime-string
    opponent: Optional[str] = None
    is_home: Optional[bool] = None
    score_us: Optional[int] = None
    score_them: Optional[int] = None
    description: Optional[str] = None
    is_pinned: bool = False


class CustomEntryUpdate(BaseModel):
    kind: Optional[str] = None
    title: Optional[str] = None
    date: Optional[str] = None
    opponent: Optional[str] = None
    is_home: Optional[bool] = None
    score_us: Optional[int] = None
    score_them: Optional[int] = None
    description: Optional[str] = None
    is_pinned: Optional[bool] = None


@router.get("/entries")
def list_entries(kind: Optional[str] = None, session: Session = Depends(get_session)):
    q = select(YearOfCustomEntry)
    if kind:
        q = q.where(YearOfCustomEntry.kind == kind)
    return session.exec(q.order_by(YearOfCustomEntry.date)).all()


@router.post("/entries")
def create_entry(
    body: CustomEntryIn,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    entry = YearOfCustomEntry(**body.model_dump())
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.patch("/entries/{entry_id}")
def update_entry(
    entry_id: str,
    body: CustomEntryUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    entry = get_or_404(session, YearOfCustomEntry, entry_id, "Item")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.delete("/entries/{entry_id}")
def delete_entry(
    entry_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    entry = get_or_404(session, YearOfCustomEntry, entry_id, "Item")
    session.delete(entry)
    session.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Tijdlijn — competitie (Poulebord/hockey-inside) + custom entries samengevoegd
# ---------------------------------------------------------------------------

def _competition_timeline_items(session: Session) -> list[dict]:
    poule = session.get(HockeyPoule, POULE_ID)
    if not poule:
        return []
    data = _serialize_poule_matches(session, poule)
    items = []
    for status_key, rows in (("finished", data["finished"]), ("scheduled", data["scheduled"])):
        for m in rows:
            if TEAM_NAME not in (m["home"], m["away"]):
                continue
            is_home = m["home"] == TEAM_NAME
            items.append({
                "kind": "competitie",
                "match_ref": f"knhb:{m['match_id']}",
                "title": f"{m['home']} - {m['away']}",
                "date": m["date"],
                "opponent": m["away"] if is_home else m["home"],
                "is_home": is_home,
                "score_us": (m["home_score"] if is_home else m["away_score"]) if status_key == "finished" else None,
                "score_them": (m["away_score"] if is_home else m["home_score"]) if status_key == "finished" else None,
                "description": None,
                "is_pinned": False,
                "status": status_key,
            })
    return items


def _custom_timeline_items(session: Session) -> list[dict]:
    rows = session.exec(select(YearOfCustomEntry).order_by(YearOfCustomEntry.date)).all()
    items = []
    for e in rows:
        has_score = e.score_us is not None or e.score_them is not None
        items.append({
            "kind": e.kind,
            "match_ref": f"custom:{e.id}",
            "title": e.title,
            "date": e.date,
            "opponent": e.opponent,
            "is_home": e.is_home,
            "score_us": e.score_us,
            "score_them": e.score_them,
            "description": e.description,
            "is_pinned": e.is_pinned,
            "status": "finished" if has_score else "scheduled",
        })
    return items


@router.get("/timeline")
def get_timeline(session: Session = Depends(get_session)):
    """Competitiewedstrijden (read-only sync) + oefenwedstrijden/bijzondere dagen
    (handmatig ingevoerd), samengevoegd en op datum gesorteerd. match_ref is het
    genormaliseerde tag-doel voor latere content (fase 4/5)."""
    items = _competition_timeline_items(session) + _custom_timeline_items(session)
    items.sort(key=lambda e: e["date"])
    return items


@router.get("/timeline/{match_ref}")
def get_timeline_item(match_ref: str, session: Session = Depends(get_session)):
    items = _competition_timeline_items(session) + _custom_timeline_items(session)
    for item in items:
        if item["match_ref"] == match_ref:
            return item
    raise HTTPException(status_code=404, detail="Item niet gevonden")


# ---------------------------------------------------------------------------
# Teamlinkje (viewer-toegang) — v1: simpele code, handmatig vervangen.
# Per-wedstrijd rotatie + vangnet + content-scoping volgen in fase 1149.
# ---------------------------------------------------------------------------

TEAM_LINK_CHARS = string.ascii_lowercase + string.digits


def _new_team_link_code(session: Session) -> str:
    for _ in range(20):
        code = "".join(random.choices(TEAM_LINK_CHARS, k=6))
        if not session.get(YearOfTeamLink, code):
            return code
    raise RuntimeError("Geen unieke code gevonden")


@router.post("/team-links")
def create_team_link(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Nieuw teamlinkje aanmaken; alle eerder actieve linkjes worden ingetrokken."""
    active = session.exec(
        select(YearOfTeamLink).where(YearOfTeamLink.revoked_at.is_(None))
    ).all()
    now = datetime.utcnow()
    for link in active:
        link.revoked_at = now
        session.add(link)

    code = _new_team_link_code(session)
    new_link = YearOfTeamLink(id=code)
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
    link = session.get(YearOfTeamLink, code.strip().lower())
    valid = bool(link and link.revoked_at is None)
    return {"valid": valid}
