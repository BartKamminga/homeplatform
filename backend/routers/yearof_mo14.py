"""YearOf MO14 ("MO14 à Paris") — supportersite voor Victoria MO14-1.

Fase 1 (item 1143): fundament — status/me-endpoints.
Fase 2 (item 1144): kerndata — spelers-CRUD, wedstrijden/bijzondere-dagen-CRUD,
en een samengevoegde tijdlijn (competitie via hockey-inside/Poulebord + de
handmatige YearOfCustomEntry-rijen).
Fase 3 (item 1145): publieke basispagina's + teamlinkje v1 (simpele code,
handmatig vervangen door de beheerder). Nog GEEN server-side afdwinging op
de publieke GET-endpoints hieronder — dat volgt met content-scoping in fase
1149/fase 7. Voor nu is het teamlinkje een client-side toegangsdeur.

Fase 4 (item 1146): foto-bijdragen. Eigen publieke upload-route (geen
homeplatform-account, want anonieme bezoekers hebben er geen — geauthenticeerd
via het teamlinkje in plaats daarvan), server-side 3 beeldvarianten
(thumb/medium/full) via Pillow, concept/published-status + beheerder-moderatie.

Fase 5 (item 1147): verslagen & interviews. Wedstrijd-invullink (eenmalig/
tijdelijk, publiek — geen teamcode nodig, de invullink zelf is het bewijs)
voor het insturen van een verhaaltje, altijd als concept. Door de beheerder
direct aangemaakte verslagen mogen wel meteen published zijn. Foto-bijdragen
binnen het invulformulier zijn bewust NIET gebouwd (vereist het teamlinkje,
niet de invullink) - fotos voegt men apart toe via de bestaande "Foto's
toevoegen"-pagina (fase 4), getagd op dezelfde match_ref.

Fase 7 (item 1149): teamlinkje-rotatie + content-scoping. Elk teamlinkje
krijgt een instelbaar vangnet (default 10 dagen) naast de bestaande
"vervalt bij een nieuwer linkje"-regel. De publieke GET-endpoints
(spelers/tijdlijn/fotos/verslagen) vereisen nu ECHT een geldige teamcode
OF een homeplatform-login (beheerder, onbeperkte toegang) - de eerdere
fases lieten deze bewust nog open. Content-scoping voor fotos/verslagen:
een teamlinkje toont nooit content die gepubliceerd is NA het moment dat
het linkje werd uitgegeven (created_at van het linkje als cutoff), ook al
is het linkje zelf nog geldig - dit maakt hard-cutoff-vs-overlap-toegang
grotendeels irrelevant.

Single-tenant, bewust hardcoded voor Victoria MO14-1 (poule_id 551, Topklasse
Zuid-Holland poule B, seizoen 2026-2027) - zie roadmap item 1142/1143.
"""

import io
import random
import shutil
import string
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer
from PIL import Image
from pydantic import BaseModel
from sqlmodel import Session, col, or_, select

from core.auth import decode_token, get_current_user, hash_api_key
from core.crud import get_or_404
from core.database import get_session
from core.settings import settings
from models.core import User, UserApiKey
from models.hockey_discovery import HockeyPoule
from models.yearof import (
    YearOfActionSettings,
    YearOfContributorLink,
    YearOfCustomEntry,
    YearOfMatchGoal,
    YearOfMatchPhotoBlock,
    YearOfPhoto,
    YearOfPhotoPlayerTag,
    YearOfPlayer,
    YearOfPlayerEdit,
    YearOfProfileLink,
    YearOfReport,
    YearOfReportLink,
    YearOfReportPlayerTag,
    YearOfTeamLink,
)
from routers.hockey_public import _serialize_poule_matches, get_hockey_poule_standings

router = APIRouter(prefix="/api/yearof-mo14", tags=["yearof-mo14"])

TEAM_NAME = "Victoria MO14-1"
POULE_ID = 551  # HockeyPoule.id, single-tenant hardcoded (zie item 1143 architectuurbeslissing)


# ---------------------------------------------------------------------------
# Toegang: beheerder (homeplatform-login) OF een geldig teamlinkje.
# Fase 7 (item 1149) - hiervoor stonden deze GET-endpoints nog volledig open.
# ---------------------------------------------------------------------------

_optional_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_optional_user(
    token: Optional[str] = Depends(_optional_oauth2),
    session: Session = Depends(get_session),
) -> Optional[User]:
    """Zelfde logica als core.auth.get_current_user, maar geeft None terug
    i.p.v. een 401 te gooien zodra er geen (geldig) token is - nodig omdat
    deze endpoints ZOWEL door de beheerder (login) als door publieke
    bezoekers (teamcode) aangeroepen worden."""
    if not token:
        return None
    try:
        if token.startswith("hp_"):
            api_key = session.exec(
                select(UserApiKey)
                .where(UserApiKey.key_hash == hash_api_key(token))
                .where(UserApiKey.revoked_at.is_(None))
            ).first()
            if not api_key:
                return None
            user = session.get(User, api_key.user_id)
            return user if (user and user.is_active) else None

        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = session.get(User, user_id)
        return user if (user and user.is_active) else None
    except HTTPException:
        return None


def _valid_team_link(code: Optional[str], session: Session) -> Optional[YearOfTeamLink]:
    if not code:
        return None
    link = session.get(YearOfTeamLink, code.strip().lower())
    if not link or link.revoked_at is not None:
        return None
    if link.expires_at and link.expires_at < datetime.utcnow():
        return None
    return link


def require_team_access(
    code: Optional[str] = None,
    current_user: Optional[User] = Depends(get_optional_user),
    session: Session = Depends(get_session),
) -> None:
    """Toegangscontrole zonder content-scoping (spelers/tijdlijn - geen
    concept/published-cyclus, dus niets om op te filteren). Heropend
    2026-09-16: de publieke site was kort volledig open (2026-09-13 t/m
    2026-09-16, zie git a92e076) maar dat bleek toch niet de bedoeling -
    een geldig teamlinkje (of beheerder-login) is weer verplicht om de site
    te bekijken. Invullinkjes/profiellinkjes blijven hier los van staan
    (eigen toegangstoken, geen team_access-dependency op die routes)."""
    if current_user is not None:
        return
    if not _valid_team_link(code, session):
        raise HTTPException(status_code=403, detail="Ongeldige of verlopen teamcode")


def get_team_scope_cutoff(
    code: Optional[str] = None,
    current_user: Optional[User] = Depends(get_optional_user),
    session: Session = Depends(get_session),
) -> Optional[datetime]:
    """Toegangscontrole MET content-scoping (fotos/verslagen): beheerder ->
    None (onbeperkt), teamlinkje -> het moment waarop dat linkje is
    uitgegeven als cutoff. Content gepubliceerd na dat moment blijft
    verborgen, ook als het linkje zelf nog geldig is. Zie require_team_access
    hierboven voor de heropening van 2026-09-16."""
    if current_user is not None:
        return None
    link = _valid_team_link(code, session)
    if not link:
        raise HTTPException(status_code=403, detail="Ongeldige of verlopen teamcode")
    return link.created_at


@router.get("/status")
def status():
    """Publiek, geen auth — bewijst dat de site/router leeft."""
    return {"site": "yearof-mo14", "fase": 8, "status": "actiepagina + Pinksterweekend + polish"}


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
def list_players(session: Session = Depends(get_session), _: None = Depends(require_team_access)):
    """Publiek - toont geen gearchiveerde spelers (zie /players/moderation voor de beheerder-lijst)."""
    rows = session.exec(
        select(YearOfPlayer).where(col(YearOfPlayer.archived_at).is_(None)).order_by(YearOfPlayer.shirt_number)
    ).all()
    return rows


@router.get("/players/moderation")
def list_players_moderation(session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    """Beheerder-only - inclusief gearchiveerde spelers. Moet vóór /players/{player_id}
    gedeclareerd staan, anders vangt die route 'moderation' als player_id weg."""
    rows = session.exec(select(YearOfPlayer).order_by(YearOfPlayer.shirt_number)).all()
    return rows


@router.get("/players/moderation/{player_id}")
def get_player_moderation(player_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return get_or_404(session, YearOfPlayer, player_id, "Speler")


@router.get("/players/{player_id}")
def get_player(player_id: str, session: Session = Depends(get_session), _: None = Depends(require_team_access)):
    player = get_or_404(session, YearOfPlayer, player_id, "Speler")
    if player.archived_at is not None:
        raise HTTPException(status_code=404, detail="Speler niet gevonden")
    return player


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


@router.post("/players/{player_id}/archive")
def archive_player(
    player_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Verbergt deze speler van de publieke site - foto-tags, verslag-tags,
    doelpunten en linkjes die naar de speler verwijzen blijven gewoon bestaan
    en de beheerder kan de speler altijd terugzetten. Bewust geen verwijderen
    (zelfde reden als bij wedstrijddagen, item 1147/1158)."""
    player = get_or_404(session, YearOfPlayer, player_id, "Speler")
    player.archived_at = datetime.utcnow()
    session.add(player)
    session.commit()
    return {"ok": True}


@router.post("/players/{player_id}/restore")
def restore_player(
    player_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    player = get_or_404(session, YearOfPlayer, player_id, "Speler")
    player.archived_at = None
    session.add(player)
    session.commit()
    return {"ok": True}


@router.delete("/players/{player_id}")
def delete_player(
    player_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Permanent verwijderen, inclusief alles wat naar de speler verwijst
    (foto-tags, verslag-tags, doelpunten, invullinkjes, profiellinkje,
    openstaande profielwijzigingen). Alleen toegestaan als de speler al
    gearchiveerd is - zelfde noodgreep-patroon als bij wedstrijddagen."""
    player = get_or_404(session, YearOfPlayer, player_id, "Speler")
    if player.archived_at is None:
        raise HTTPException(status_code=400, detail="Archiveer deze speler eerst voor je 'm permanent verwijdert")

    for tag in session.exec(select(YearOfPhotoPlayerTag).where(YearOfPhotoPlayerTag.player_id == player_id)).all():
        session.delete(tag)
    for tag in session.exec(select(YearOfReportPlayerTag).where(YearOfReportPlayerTag.player_id == player_id)).all():
        session.delete(tag)
    for goal in session.exec(select(YearOfMatchGoal).where(YearOfMatchGoal.player_id == player_id)).all():
        session.delete(goal)
    for link in session.exec(select(YearOfContributorLink).where(YearOfContributorLink.player_id == player_id)).all():
        session.delete(link)
    for link in session.exec(select(YearOfProfileLink).where(YearOfProfileLink.player_id == player_id)).all():
        session.delete(link)
    for edit in session.exec(select(YearOfPlayerEdit).where(YearOfPlayerEdit.player_id == player_id)).all():
        session.delete(edit)

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
    location: Optional[str] = None
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
    location: Optional[str] = None
    description: Optional[str] = None
    is_pinned: Optional[bool] = None


@router.get("/entries")
def list_entries(kind: Optional[str] = None, session: Session = Depends(get_session), _: None = Depends(require_team_access)):
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


@router.post("/entries/{entry_id}/archive")
def archive_entry(
    entry_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Verbergt deze dag van de publieke site - foto's, verslagen en linkjes
    eronder blijven gewoon bestaan en zijn nog te bekijken/bewerken door de
    beheerder. Bewust geen verwijderen (zie item 1147): dat zou ook alles
    eronder weggooien."""
    entry = get_or_404(session, YearOfCustomEntry, entry_id, "Item")
    entry.archived_at = datetime.utcnow()
    session.add(entry)
    session.commit()
    return {"ok": True}


@router.post("/entries/{entry_id}/restore")
def restore_entry(
    entry_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    entry = get_or_404(session, YearOfCustomEntry, entry_id, "Item")
    entry.archived_at = None
    session.add(entry)
    session.commit()
    return {"ok": True}


@router.delete("/entries/{entry_id}")
def delete_entry(
    entry_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Permanent verwijderen, inclusief alles wat eronder hangt (foto's/video's,
    verslagen + hun tags/linkjes, invullinkjes, doelpunten, foto-blok-positie).
    Alleen toegestaan als de dag al gearchiveerd is - eerst archiveren dwingt
    een bewuste tussenstap af voor je iets echt onomkeerbaars doet."""
    entry = get_or_404(session, YearOfCustomEntry, entry_id, "Item")
    if entry.archived_at is None:
        raise HTTPException(status_code=400, detail="Archiveer deze dag eerst voor je 'm permanent verwijdert")
    match_ref = f"custom:{entry_id}"

    photos = session.exec(select(YearOfPhoto).where(YearOfPhoto.match_ref == match_ref)).all()
    for photo in photos:
        for tag in session.exec(select(YearOfPhotoPlayerTag).where(YearOfPhotoPlayerTag.photo_id == photo.id)).all():
            session.delete(tag)
        session.delete(photo)

    reports = session.exec(select(YearOfReport).where(YearOfReport.match_ref == match_ref)).all()
    for report in reports:
        for tag in session.exec(select(YearOfReportPlayerTag).where(YearOfReportPlayerTag.report_id == report.id)).all():
            session.delete(tag)
        for link in session.exec(select(YearOfReportLink).where(YearOfReportLink.report_id == report.id)).all():
            session.delete(link)
        session.delete(report)

    for link in session.exec(select(YearOfContributorLink).where(YearOfContributorLink.match_ref == match_ref)).all():
        session.delete(link)

    for goal in session.exec(select(YearOfMatchGoal).where(YearOfMatchGoal.match_ref == match_ref)).all():
        session.delete(goal)

    photo_block = session.get(YearOfMatchPhotoBlock, match_ref)
    if photo_block:
        session.delete(photo_block)

    session.delete(entry)
    session.commit()

    for photo in photos:
        shutil.rmtree(PHOTO_ROOT / photo.id, ignore_errors=True)

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
                "location": m.get("location"),
                "home_club_logo": m.get("home_club_logo"),
                "away_club_logo": m.get("away_club_logo"),
                "opponent_club_logo": m.get("away_club_logo") if is_home else m.get("home_club_logo"),
                "description": None,
                "is_pinned": False,
                "status": status_key,
                "is_archived": False,
            })
    return items


def _custom_timeline_items(session: Session, include_archived: bool = False) -> list[dict]:
    q = select(YearOfCustomEntry)
    if not include_archived:
        q = q.where(col(YearOfCustomEntry.archived_at).is_(None))
    rows = session.exec(q.order_by(YearOfCustomEntry.date)).all()
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
            "location": e.location,
            "description": e.description,
            "is_pinned": e.is_pinned,
            "status": "finished" if has_score else "scheduled",
            "is_archived": e.archived_at is not None,
        })
    return items


def _annotate_content_flags(session: Session, items: list[dict]) -> list[dict]:
    """Zet has_photos/has_report/has_footage per item - voor kleine
    aanwezigheids-icoontjes op het tijdlijn-overzicht, zonder de content zelf
    te tonen (dat blijft aan de detailpagina)."""
    match_refs = [it["match_ref"] for it in items]
    if not match_refs:
        return items
    photos = session.exec(
        select(YearOfPhoto).where(YearOfPhoto.status == "published").where(col(YearOfPhoto.match_ref).in_(match_refs))
    ).all()
    photos_by_ref = {p.match_ref for p in photos}

    reports = session.exec(
        select(YearOfReport).where(YearOfReport.status == "published").where(col(YearOfReport.match_ref).in_(match_refs))
    ).all()
    reports_by_ref = {r.match_ref for r in reports if r.report_type in ("wedstrijdverslag", "interview")}
    footage_by_ref = {r.match_ref for r in reports if r.report_type == "wedstrijd_beelden"}

    for it in items:
        it["has_photos"] = it["match_ref"] in photos_by_ref
        it["has_report"] = it["match_ref"] in reports_by_ref
        it["has_footage"] = it["match_ref"] in footage_by_ref
    return items


@router.get("/timeline")
def get_timeline(session: Session = Depends(get_session), _: None = Depends(require_team_access)):
    """Competitiewedstrijden (read-only sync) + oefenwedstrijden/bijzondere dagen
    (handmatig ingevoerd), samengevoegd en op datum gesorteerd. match_ref is het
    genormaliseerde tag-doel voor latere content (fase 4/5)."""
    items = _competition_timeline_items(session) + _custom_timeline_items(session)
    items.sort(key=lambda e: e["date"])
    return _annotate_content_flags(session, items)


@router.get("/timeline/moderation")
def get_timeline_moderation(session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    """Beheerder-only — zelfde als /timeline, maar inclusief gearchiveerde
    dagen (die op de publieke site verborgen zijn). Moet vóór /timeline/{match_ref}
    gedeclareerd staan, anders vangt die route 'moderation' als match_ref weg."""
    items = _competition_timeline_items(session) + _custom_timeline_items(session, include_archived=True)
    items.sort(key=lambda e: e["date"])
    return _annotate_content_flags(session, items)


@router.get("/timeline/moderation/{match_ref}")
def get_timeline_item_moderation(match_ref: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    items = _competition_timeline_items(session) + _custom_timeline_items(session, include_archived=True)
    for item in items:
        if item["match_ref"] == match_ref:
            return item
    raise HTTPException(status_code=404, detail="Item niet gevonden")


@router.get("/timeline/{match_ref}")
def get_timeline_item(match_ref: str, session: Session = Depends(get_session), _: None = Depends(require_team_access)):
    items = _competition_timeline_items(session) + _custom_timeline_items(session)
    for item in items:
        if item["match_ref"] == match_ref:
            return item
    raise HTTPException(status_code=404, detail="Item niet gevonden")


@router.get("/standings")
def get_standings(session: Session = Depends(get_session), _: None = Depends(require_team_access)):
    """Pouletabel (item 1152) - hergebruikt de bestaande Poulebord/hockey-inside
    standings-endpoint 1-op-1, alleen achter het teamlinkje i.p.v. volledig open.
    Markeert onze eigen rij (is_us) zodat de frontend die niet zelf hoeft te
    matchen op teamnaam."""
    data = get_hockey_poule_standings(POULE_ID, session)
    for row in data["standings"]:
        row["is_us"] = row["team_name"] == TEAM_NAME
    return data


# ---------------------------------------------------------------------------
# Doelpunten per speler per wedstrijd (beheerder houdt dit handmatig bij)
# ---------------------------------------------------------------------------

class MatchGoalIn(BaseModel):
    goals: int


# ---------------------------------------------------------------------------
# Positie van het foto-blok op de wedstrijdpagina (WYSIWYG-editor) - zelfde
# spaced-sort_order-schema/swap-met-sibling-aanpak als YearOfReport.sort_order.
# ---------------------------------------------------------------------------

class PhotoBlockMove(BaseModel):
    direction: str  # "up" | "down"


def _photo_block_sort_order(session: Session, match_ref: str) -> int:
    block = session.get(YearOfMatchPhotoBlock, match_ref)
    if block:
        return block.sort_order
    lowest_report = session.exec(
        select(YearOfReport).where(YearOfReport.match_ref == match_ref).order_by(YearOfReport.sort_order)
    ).first()
    return (lowest_report.sort_order - 500) if lowest_report else -500


@router.get("/matches/{match_ref}/photo-block")
def get_photo_block_position(match_ref: str, session: Session = Depends(get_session)):
    return {"sort_order": _photo_block_sort_order(session, match_ref)}


@router.post("/matches/{match_ref}/photo-block/move")
def move_photo_block(
    match_ref: str,
    body: PhotoBlockMove,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    photo_sort = _photo_block_sort_order(session, match_ref)
    reports = session.exec(
        select(YearOfReport).where(YearOfReport.match_ref == match_ref).order_by(YearOfReport.sort_order)
    ).all()
    merged = sorted([("photos", None, photo_sort)] + [("report", r.id, r.sort_order) for r in reports], key=lambda t: t[2])
    idx = next(i for i, m in enumerate(merged) if m[0] == "photos")
    swap_idx = idx - 1 if body.direction == "up" else idx + 1
    if swap_idx < 0 or swap_idx >= len(merged):
        return {"ok": True}
    _, other_id, other_sort = merged[swap_idx]
    other_report = get_or_404(session, YearOfReport, other_id, "Verslag")

    block = session.get(YearOfMatchPhotoBlock, match_ref)
    if not block:
        block = YearOfMatchPhotoBlock(match_ref=match_ref, sort_order=photo_sort)
    block.sort_order = other_sort
    other_report.sort_order = photo_sort
    session.add(block)
    session.add(other_report)
    session.commit()
    return {"ok": True}


@router.get("/matches/{match_ref}/goals")
def list_match_goals(match_ref: str, session: Session = Depends(get_session), _: None = Depends(require_team_access)):
    rows = session.exec(select(YearOfMatchGoal).where(YearOfMatchGoal.match_ref == match_ref)).all()
    return [{"player_id": r.player_id, "goals": r.goals} for r in rows if r.goals]


@router.put("/matches/{match_ref}/goals/{player_id}")
def set_match_goal(
    match_ref: str,
    player_id: str,
    body: MatchGoalIn,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    row = session.exec(
        select(YearOfMatchGoal)
        .where(YearOfMatchGoal.match_ref == match_ref)
        .where(YearOfMatchGoal.player_id == player_id)
    ).first()
    if body.goals <= 0:
        if row:
            session.delete(row)
            session.commit()
        return {"player_id": player_id, "goals": 0}
    if not row:
        row = YearOfMatchGoal(match_ref=match_ref, player_id=player_id, goals=body.goals)
    else:
        row.goals = body.goals
    session.add(row)
    session.commit()
    return {"player_id": player_id, "goals": row.goals}


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
# Foto-bijdragen — publieke upload (via teamlinkje, geen homeplatform-account),
# server-side 3 beeldvarianten, concept/published + beheerder-moderatie.
# ---------------------------------------------------------------------------

PHOTO_ROOT = Path(settings.UPLOAD_ROOT).resolve() / "yearof-mo14" / "photos"
PHOTO_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
PHOTO_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
PHOTO_MAX_SIZE_MB = 15
PHOTO_VARIANT_MAX_DIM = {"thumb": 400, "medium": 1600}  # "full" = ongeschaald (client had al gecomprimeerd)

# Filmpjes (item 1154): ruw bestand opslaan, geen transcode/thumbnail (geen
# ffmpeg beschikbaar) - frontend toont een video-icoontje in de grid en speelt
# het bestand direct af in de lightbox.
VIDEO_ALLOWED_TYPES = {"video/mp4", "video/quicktime", "video/webm"}
VIDEO_ALLOWED_EXTENSIONS = {".mp4", ".mov", ".webm"}
VIDEO_MAX_SIZE_MB = 200


def _photo_safe_path(photo_id: str, filename: str) -> Path:
    candidate = (PHOTO_ROOT / photo_id / filename).resolve()
    if not str(candidate).startswith(str(PHOTO_ROOT)):
        raise HTTPException(status_code=400, detail="Ongeldig pad")
    return candidate


def _save_photo_variants(photo_id: str, content: bytes) -> None:
    image = Image.open(io.BytesIO(content))
    image = image.convert("RGB")  # normaliseert naar jpg, ook bij png/webp-input
    folder = PHOTO_ROOT / photo_id
    folder.mkdir(parents=True, exist_ok=True)
    image.save(folder / "full.jpg", "JPEG", quality=88)
    for variant, max_dim in PHOTO_VARIANT_MAX_DIM.items():
        resized = image.copy()
        resized.thumbnail((max_dim, max_dim))
        resized.save(folder / f"{variant}.jpg", "JPEG", quality=82)


def _save_video(photo_id: str, content: bytes, ext: str) -> None:
    folder = PHOTO_ROOT / photo_id
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"video{ext}").write_bytes(content)


class PhotoUpdate(BaseModel):
    status: Optional[str] = None
    photo_type: Optional[str] = None
    caption: Optional[str] = None
    report_id: Optional[str] = None


@router.post("/photos", status_code=201)
async def upload_photo(
    file: UploadFile = File(...),
    match_ref: Optional[str] = Form(None),
    report_id: Optional[str] = Form(None),
    photo_type: str = Form("actie"),
    code: Optional[str] = Form(None),
    session: Session = Depends(get_session),
):
    """Publiek, open sinds de teamcode-eis is losgelaten (2026-09-13). code is
    optioneel en dient alleen nog voor attributie (uploader_code) - kan een
    teamlinkje OF een invullinkje (contributor-code) zijn, niet opnieuw
    gevalideerd op geldigheid want het invulformulier heeft dat al gedaan bij
    het aanmaken van het verslag. Accepteert zowel fotos als filmpjes -
    media_type wordt afgeleid van het bestandstype/-extensie.

    report_id (optioneel): koppelt de foto aan een specifiek verslag/
    interview/algemeen bericht i.p.v. alleen los aan een wedstrijd - match_ref
    wordt dan overschreven met het match_ref van dat verslag (kan None zijn
    bij een algemeen bericht) zodat beide altijd in sync blijven."""
    uploader_code = None
    if code:
        normalized = code.strip().lower()
        team_link = _valid_team_link(normalized, session)
        if team_link:
            uploader_code = team_link.id
        elif session.get(YearOfContributorLink, normalized):
            uploader_code = normalized

    report = get_or_404(session, YearOfReport, report_id, "Verslag") if report_id else None
    if report:
        match_ref = report.match_ref

    ext = Path(file.filename or "upload").suffix.lower()
    base_type = (file.content_type or "").split(";")[0].strip()
    is_video = base_type in VIDEO_ALLOWED_TYPES or ext in VIDEO_ALLOWED_EXTENSIONS

    if is_video:
        media_type = "video"
        if ext not in VIDEO_ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Bestandsextensie niet toegestaan: {ext}")
        if base_type not in VIDEO_ALLOWED_TYPES:
            raise HTTPException(status_code=400, detail=f"Bestandstype niet toegestaan: {file.content_type}")
        max_size_mb = VIDEO_MAX_SIZE_MB
    else:
        media_type = "photo"
        ext = ext or ".jpg"
        if ext not in PHOTO_ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Bestandsextensie niet toegestaan: {ext}")
        if base_type not in PHOTO_ALLOWED_TYPES:
            raise HTTPException(status_code=400, detail=f"Bestandstype niet toegestaan: {file.content_type}")
        max_size_mb = PHOTO_MAX_SIZE_MB

    content = await file.read()
    if len(content) > max_size_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Bestand te groot. Maximum is {max_size_mb}MB")

    # Een foto bij een al-gepubliceerd verslag volgt meteen die status -
    # anders blijft hij als concept hangen totdat iemand 'm los publiceert,
    # ook al staat het verslag zelf al live.
    status = "published" if (report and report.status == "published") else "concept"

    photo = YearOfPhoto(
        match_ref=match_ref, report_id=report_id, photo_type=photo_type, media_type=media_type,
        file_ext=ext if is_video else None,
        uploader_code=uploader_code, status=status,
    )
    session.add(photo)
    session.commit()
    session.refresh(photo)

    try:
        if is_video:
            _save_video(photo.id, content, ext)
        else:
            _save_photo_variants(photo.id, content)
    except Exception:
        session.delete(photo)
        session.commit()
        raise HTTPException(status_code=400, detail="Kon bestand niet verwerken (ongeldig bestand)")

    return photo


@router.get("/photos/{photo_id}/{variant}.jpg")
def get_photo_file(photo_id: str, variant: str):
    """Publiek, geen auth — zelfde principe als /api/uploads (img src stuurt geen Authorization-header)."""
    if variant not in {"thumb", "medium", "full"}:
        raise HTTPException(status_code=404, detail="Onbekende variant")
    path = _photo_safe_path(photo_id, f"{variant}.jpg")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Bestand niet gevonden")
    return FileResponse(str(path))


@router.get("/photos/{photo_id}/video")
def get_photo_video(photo_id: str, session: Session = Depends(get_session)):
    """Publiek, geen auth — serveert het ruwe videobestand (geen varianten/transcode)."""
    photo = get_or_404(session, YearOfPhoto, photo_id, "Video")
    if photo.media_type != "video" or not photo.file_ext:
        raise HTTPException(status_code=404, detail="Geen video")
    path = _photo_safe_path(photo_id, f"video{photo.file_ext}")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Bestand niet gevonden")
    return FileResponse(str(path))


@router.get("/photos")
def list_photos(
    match_ref: Optional[str] = None,
    report_id: Optional[str] = None,
    player_id: Optional[str] = None,
    session: Session = Depends(get_session),
    scope_cutoff: Optional[datetime] = Depends(get_team_scope_cutoff),
):
    """Publiek — toont alleen gepubliceerde fotos (concepten zijn beheerder-only,
    zie /photos/moderation). Via een teamlinkje bovendien nooit fotos die na
    het uitgeven van dat linkje zijn geupload (content-scoping, fase 7)."""
    q = select(YearOfPhoto).where(YearOfPhoto.status == "published")
    if scope_cutoff is not None:
        q = q.where(YearOfPhoto.created_at <= scope_cutoff)
    if match_ref:
        q = q.where(YearOfPhoto.match_ref == match_ref)
    if report_id:
        q = q.where(YearOfPhoto.report_id == report_id)
    if player_id:
        tagged_ids = [
            t.photo_id for t in
            session.exec(select(YearOfPhotoPlayerTag).where(YearOfPhotoPlayerTag.player_id == player_id)).all()
        ]
        q = q.where(col(YearOfPhoto.id).in_(tagged_ids))
    return session.exec(q.order_by(YearOfPhoto.created_at.desc())).all()


@router.get("/photos/moderation")
def list_photos_for_moderation(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder-only — inclusief de huidige speler-tags per foto (player_ids),
    zodat de moderatie-UI niet apart per foto hoeft te pollen."""
    photos = session.exec(select(YearOfPhoto).order_by(YearOfPhoto.created_at.desc())).all()
    all_tags = session.exec(select(YearOfPhotoPlayerTag)).all()
    tags_by_photo: dict[str, list[str]] = {}
    for t in all_tags:
        tags_by_photo.setdefault(t.photo_id, []).append(t.player_id)
    return [
        {**photo.model_dump(), "player_ids": tags_by_photo.get(photo.id, [])}
        for photo in photos
    ]


@router.patch("/photos/{photo_id}")
def update_photo(
    photo_id: str,
    body: PhotoUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    photo = get_or_404(session, YearOfPhoto, photo_id, "Foto")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(photo, key, value)
    session.add(photo)
    session.commit()
    session.refresh(photo)
    return photo


@router.delete("/photos/{photo_id}")
def delete_photo(
    photo_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    photo = get_or_404(session, YearOfPhoto, photo_id, "Foto")
    for tag in session.exec(select(YearOfPhotoPlayerTag).where(YearOfPhotoPlayerTag.photo_id == photo_id)).all():
        session.delete(tag)
    session.delete(photo)
    session.commit()
    shutil.rmtree(PHOTO_ROOT / photo_id, ignore_errors=True)
    return {"ok": True}


@router.post("/photos/{photo_id}/tags/{player_id}")
def tag_photo(
    photo_id: str,
    player_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    get_or_404(session, YearOfPhoto, photo_id, "Foto")
    get_or_404(session, YearOfPlayer, player_id, "Speler")
    existing = session.exec(
        select(YearOfPhotoPlayerTag)
        .where(YearOfPhotoPlayerTag.photo_id == photo_id)
        .where(YearOfPhotoPlayerTag.player_id == player_id)
    ).first()
    if existing:
        return existing
    tag = YearOfPhotoPlayerTag(photo_id=photo_id, player_id=player_id)
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


@router.delete("/photos/{photo_id}/tags/{player_id}")
def untag_photo(
    photo_id: str,
    player_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    existing = session.exec(
        select(YearOfPhotoPlayerTag)
        .where(YearOfPhotoPlayerTag.photo_id == photo_id)
        .where(YearOfPhotoPlayerTag.player_id == player_id)
    ).first()
    if existing:
        session.delete(existing)
        session.commit()
    return {"ok": True}


@router.get("/photos/{photo_id}/tags")
def get_photo_tags(photo_id: str, session: Session = Depends(get_session)):
    return session.exec(select(YearOfPhotoPlayerTag).where(YearOfPhotoPlayerTag.photo_id == photo_id)).all()


# ---------------------------------------------------------------------------
# Wedstrijd-invullink (contributor) — eenmalig/tijdelijk, publiek zonder
# teamcode (de invullink zelf is het bewijs van toegang).
# ---------------------------------------------------------------------------

CONTRIBUTOR_LINK_DEFAULT_DAYS = 14


class ContributorLinkIn(BaseModel):
    match_ref: str
    player_id: Optional[str] = None
    report_type: str = "interview"  # interview | wedstrijdverslag (bv. vooraf-preview)
    expires_days: int = CONTRIBUTOR_LINK_DEFAULT_DAYS


@router.post("/contributor-links")
def create_contributor_link(
    body: ContributorLinkIn,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    code = None
    for _ in range(20):
        candidate = "".join(random.choices(TEAM_LINK_CHARS, k=6))
        if not session.get(YearOfContributorLink, candidate):
            code = candidate
            break
    if not code:
        raise RuntimeError("Geen unieke code gevonden")

    link = YearOfContributorLink(
        id=code,
        match_ref=body.match_ref,
        player_id=body.player_id,
        report_type=body.report_type,
        expires_at=datetime.utcnow() + timedelta(days=body.expires_days),
    )
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


@router.get("/contributor-links")
def list_contributor_links(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder-only — inclusief status (opened_at + het lot van het bijbehorende
    verslag, indien al ingevuld) zodat de UI geopend/ingevuld/concept/gepubliceerd
    kan tonen zonder aparte round-trips."""
    links = session.exec(select(YearOfContributorLink).order_by(YearOfContributorLink.created_at.desc())).all()
    reports = session.exec(select(YearOfReport).where(col(YearOfReport.contributor_code).is_not(None))).all()
    report_by_code = {r.contributor_code: r for r in reports}
    return [
        {**link.model_dump(), "report_status": report_by_code[link.id].status if link.id in report_by_code else None}
        for link in links
    ]


@router.delete("/contributor-links/{code}")
def delete_contributor_link(
    code: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    link = get_or_404(session, YearOfContributorLink, code, "Invullinkje")
    session.delete(link)
    session.commit()
    return {"ok": True}


@router.get("/matches/{match_ref}/interview-candidates")
def list_interview_candidates(
    match_ref: str,
    session: Session = Depends(get_session),
    _: None = Depends(require_team_access),
):
    """Publiek (teamcode) — namen/fotos van spelers met een nog openstaand
    interview-linkje voor deze wedstrijd, voor een leuke "wie komt er aan het
    woord"-teaser op de homepage. Geeft bewust NOOIT de linkjes/codes zelf
    terug - dat zou een manier zijn om ongevraagd bij iemands invulpagina te komen."""
    now = datetime.utcnow()
    links = session.exec(
        select(YearOfContributorLink)
        .where(YearOfContributorLink.match_ref == match_ref)
        .where(YearOfContributorLink.report_type == "interview")
        .where(YearOfContributorLink.revoked_at.is_(None))
        .where(YearOfContributorLink.expires_at > now)
    ).all()
    reports = session.exec(select(YearOfReport).where(col(YearOfReport.contributor_code).is_not(None))).all()
    filled_codes = {r.contributor_code for r in reports}

    player_ids = [l.player_id for l in links if l.player_id and l.id not in filled_codes]
    if not player_ids:
        return []
    players = session.exec(select(YearOfPlayer).where(col(YearOfPlayer.id).in_(player_ids))).all()
    return [{"id": p.id, "name": p.nickname or p.name, "photo_url": p.photo_url} for p in players]


@router.get("/contributor-links/{code}")
def get_contributor_link_context(code: str, session: Session = Depends(get_session)):
    """Publiek — het invulformulier haalt hiermee de context op (welke wedstrijd,
    voor wie) en checkt meteen of de link nog geldig is. Zet ook opened_at
    (eerste keer) voor de statusweergave in het beheerderscherm."""
    link = session.get(YearOfContributorLink, code.strip().lower())
    if not link or link.revoked_at is not None or link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=403, detail="Deze invullink is verlopen of ongeldig")

    if link.opened_at is None:
        link.opened_at = datetime.utcnow()
        session.add(link)
        session.commit()

    player = session.get(YearOfPlayer, link.player_id) if link.player_id else None
    items = _competition_timeline_items(session) + _custom_timeline_items(session)
    match = next((it for it in items if it["match_ref"] == link.match_ref), None)

    # bestaand verslag via dit linkje - laat het formulier vooraf invullen i.p.v.
    # blanco te tonen, en voorkomt dubbele rijen bij opnieuw versturen.
    existing = session.exec(
        select(YearOfReport)
        .where(YearOfReport.contributor_code == code.strip().lower())
        .order_by(YearOfReport.created_at.desc())
    ).first()

    # Ook nog-concept fotos tonen bij dit verslag (anders lijken ze
    # "verdwenen" bij opnieuw invullen, terwijl ze gewoon wachten op
    # goedkeuring) - mag hier zonder login, want de contributor-code zelf is
    # al het bewijs dat dit hun eigen invullink/verslag is.
    existing_photos = []
    if existing:
        existing_photos = session.exec(
            select(YearOfPhoto).where(YearOfPhoto.report_id == existing.id).order_by(YearOfPhoto.created_at)
        ).all()

    return {
        "match_ref": link.match_ref,
        "match_title": match["title"] if match else link.match_ref,
        "player_id": link.player_id,
        "player_name": (player.nickname or player.name) if player else None,
        "report_type": link.report_type,
        "existing_report": existing,
        "existing_photos": existing_photos,
    }


# ---------------------------------------------------------------------------
# Verslagen & interviews
# ---------------------------------------------------------------------------

class ReportSubmit(BaseModel):
    contributor_code: str
    title: str
    body: str
    author_name: Optional[str] = None


class ReportLinkIn(BaseModel):
    link_type: str  # instagram | video
    url: str
    note: Optional[str] = None


class ReportLinkUpdate(BaseModel):
    link_type: Optional[str] = None
    url: Optional[str] = None
    note: Optional[str] = None


class ReportCreate(BaseModel):
    match_ref: Optional[str] = None  # leeg = algemeen interview (coach/ouder), niet aan 1 wedstrijd gekoppeld
    report_type: str = "wedstrijdverslag"
    interviewee_role: Optional[str] = None  # speelster | coach | ouder
    title: str
    body: str
    author_name: Optional[str] = None
    links: Optional[list[ReportLinkIn]] = None
    status: str = "published"
    insert_after_id: Optional[str] = None  # WYSIWYG-editor: plaats dit item net na dit bestaande item op de wedstrijdpagina


class MoveDirection(BaseModel):
    direction: str  # "up" | "down"


class ReportUpdate(BaseModel):
    match_ref: Optional[str] = None
    report_type: Optional[str] = None
    interviewee_role: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    author_name: Optional[str] = None
    featured: Optional[bool] = None
    status: Optional[str] = None


def _report_links(session: Session, report_id: str) -> list[dict]:
    rows = session.exec(
        select(YearOfReportLink).where(YearOfReportLink.report_id == report_id).order_by(YearOfReportLink.sort_order)
    ).all()
    return [{"id": r.id, "link_type": r.link_type, "url": r.url, "note": r.note} for r in rows]


def _add_report_links(session: Session, report_id: str, links: Optional[list[ReportLinkIn]]) -> None:
    for i, link in enumerate(links or []):
        if not link.url or not link.url.strip():
            continue
        session.add(YearOfReportLink(report_id=report_id, link_type=link.link_type, url=link.url.strip(),
                                      note=link.note or None, sort_order=i))
    session.commit()


def _report_out(session: Session, report: YearOfReport, player_ids: Optional[list[str]] = None) -> dict:
    data = report.model_dump()
    data["links"] = _report_links(session, report.id)
    if player_ids is not None:
        data["player_ids"] = player_ids
    return data


@router.post("/reports", status_code=201)
def submit_report(body: ReportSubmit, session: Session = Depends(get_session)):
    """Publiek — via een wedstrijd-invullink, geen homeplatform-login.

    Eerste keer invullen -> nieuw verslag (concept). Opnieuw invullen via
    hetzelfde linkje -> bestaand verslag bijwerken i.p.v. een dubbele rij
    aan te maken; dit zet de status ALTIJD terug naar concept, ook als het
    inmiddels published was - dat IS het "wijziging aanvragen"-mechanisme:
    de vorige (goedgekeurde) tekst blijft dus tijdelijk van de site tot de
    beheerder de nieuwe versie opnieuw goedkeurt."""
    code = body.contributor_code.strip().lower()
    link = session.get(YearOfContributorLink, code)
    if not link or link.revoked_at is not None or link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=403, detail="Deze invullink is verlopen of ongeldig")

    existing = session.exec(
        select(YearOfReport)
        .where(YearOfReport.contributor_code == code)
        .order_by(YearOfReport.created_at.desc())
    ).first()

    if existing:
        existing.title = body.title
        existing.body = body.body
        existing.author_name = body.author_name
        existing.status = "concept"
        existing.updated_at = datetime.utcnow()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return _report_out(session, existing)

    report = YearOfReport(
        match_ref=link.match_ref,
        report_type=link.report_type,
        interviewee_role="speelster" if link.report_type == "interview" else None,
        status="concept",
        title=body.title,
        body=body.body,
        author_name=body.author_name,
        contributor_code=code,
    )
    session.add(report)
    session.commit()
    session.refresh(report)

    if link.player_id:
        session.add(YearOfReportPlayerTag(report_id=report.id, player_id=link.player_id))
        session.commit()
        session.refresh(report)  # commit hierboven expired report, anders geeft model_dump() straks leeg terug

    return _report_out(session, report)


def _next_sort_order(session: Session, match_ref: Optional[str], insert_after_id: Optional[str]) -> int:
    """WYSIWYG-editor: nieuwe items krijgen standaard een sort_order aan het
    einde (+1000 t.o.v. de hoogste), of - als insert_after_id gegeven is -
    precies tussen dat item en het volgende in, zodat bestaande items niet
    herindexeerd hoeven te worden."""
    if not match_ref:
        return 0
    siblings = session.exec(
        select(YearOfReport).where(YearOfReport.match_ref == match_ref).order_by(YearOfReport.sort_order)
    ).all()
    if not siblings:
        return 1000
    if not insert_after_id:
        return siblings[-1].sort_order + 1000
    idx = next((i for i, r in enumerate(siblings) if r.id == insert_after_id), None)
    if idx is None:
        return siblings[-1].sort_order + 1000
    if idx + 1 < len(siblings):
        nxt = siblings[idx + 1]
        gap = nxt.sort_order - siblings[idx].sort_order
        return siblings[idx].sort_order + (gap // 2 if gap > 1 else 1)
    return siblings[idx].sort_order + 1000


@router.post("/reports/direct", status_code=201)
def create_report_direct(
    body: ReportCreate,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder-only — een verslag direct schrijven (bv. het officiele
    wedstrijdverslag), mag standaard meteen published zijn."""
    data = body.model_dump()
    links = data.pop("links", None)
    insert_after_id = data.pop("insert_after_id", None)
    data["sort_order"] = _next_sort_order(session, data.get("match_ref"), insert_after_id)
    report = YearOfReport(**data)
    session.add(report)
    session.commit()
    session.refresh(report)
    _add_report_links(session, report.id, [ReportLinkIn(**l) for l in (links or [])])
    session.refresh(report)  # _add_report_links commit hierboven expired report, anders geeft model_dump() straks leeg terug
    return _report_out(session, report)


@router.get("/reports")
def list_reports(
    match_ref: Optional[str] = None,
    report_type: Optional[str] = None,
    session: Session = Depends(get_session),
    scope_cutoff: Optional[datetime] = Depends(get_team_scope_cutoff),
):
    """Publiek — toont alleen gepubliceerde verslagen. Via een teamlinkje
    bovendien nooit verslagen die na het uitgeven van dat linkje zijn
    gepubliceerd (content-scoping, fase 7). Zie /reports/spotlight voor de
    handmatig-curated "In de kijker"-selectie."""
    q = select(YearOfReport).where(YearOfReport.status == "published")
    if scope_cutoff is not None:
        q = q.where(YearOfReport.created_at <= scope_cutoff)
    if match_ref:
        q = q.where(YearOfReport.match_ref == match_ref)
    if report_type:
        q = q.where(YearOfReport.report_type == report_type)
    reports = session.exec(q.order_by(YearOfReport.created_at.desc())).all()

    report_ids = [r.id for r in reports]
    tags_by_report: dict[str, list[str]] = {}
    if report_ids:
        for t in session.exec(select(YearOfReportPlayerTag).where(col(YearOfReportPlayerTag.report_id).in_(report_ids))).all():
            tags_by_report.setdefault(t.report_id, []).append(t.player_id)

    return [_report_out(session, r, tags_by_report.get(r.id, [])) for r in reports]


@router.get("/reports/spotlight")
def get_spotlight_reports(
    session: Session = Depends(get_session),
    scope_cutoff: Optional[datetime] = Depends(get_team_scope_cutoff),
):
    """"In de kijker" - beheerder selecteert handmatig welke berichten hier
    verschijnen (featured=true). Algemene berichten (report_type="nieuws")
    staan er altijd bij - die zijn niet aan een wedstrijd gekoppeld en hebben
    anders nergens op de publieke site een plek. Zolang er nog niets
    gefeatured is en er geen nieuws is, valt dit terug op het wedstrijdverslag
    van de meest recente wedstrijd, zodat de pagina niet leeg is."""
    q = (
        select(YearOfReport)
        .where(YearOfReport.status == "published")
        .where(or_(YearOfReport.featured == True, YearOfReport.report_type == "nieuws"))  # noqa: E712
    )
    if scope_cutoff is not None:
        q = q.where(YearOfReport.created_at <= scope_cutoff)
    reports = session.exec(q.order_by(YearOfReport.created_at.desc())).all()

    if not reports:
        fallback_q = (
            select(YearOfReport)
            .where(YearOfReport.status == "published")
            .where(YearOfReport.report_type == "wedstrijdverslag")
        )
        if scope_cutoff is not None:
            fallback_q = fallback_q.where(YearOfReport.created_at <= scope_cutoff)
        fallback = session.exec(fallback_q.order_by(YearOfReport.created_at.desc())).first()
        reports = [fallback] if fallback else []

    report_ids = [r.id for r in reports]
    tags_by_report: dict[str, list[str]] = {}
    if report_ids:
        for t in session.exec(select(YearOfReportPlayerTag).where(col(YearOfReportPlayerTag.report_id).in_(report_ids))).all():
            tags_by_report.setdefault(t.report_id, []).append(t.player_id)

    return [_report_out(session, r, tags_by_report.get(r.id, [])) for r in reports]


@router.get("/reports/moderation")
def list_reports_for_moderation(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    reports = session.exec(select(YearOfReport).order_by(YearOfReport.created_at.desc())).all()
    all_tags = session.exec(select(YearOfReportPlayerTag)).all()
    tags_by_report: dict[str, list[str]] = {}
    for t in all_tags:
        tags_by_report.setdefault(t.report_id, []).append(t.player_id)
    return [_report_out(session, report, tags_by_report.get(report.id, [])) for report in reports]


@router.patch("/reports/{report_id}")
def update_report(
    report_id: str,
    body: ReportUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    report = get_or_404(session, YearOfReport, report_id, "Verslag")
    updates = body.model_dump(exclude_unset=True)
    was_published = report.status == "published"
    for key, value in updates.items():
        setattr(report, key, value)
    session.add(report)

    # Fotos bij dit verslag volgen de publicatiestatus van het verslag zelf -
    # anders blijft een net gepubliceerd verslag toch onzichtbare (concept)
    # fotos houden totdat je ze los publiceert in het fotobeheer.
    if report.status == "published" and not was_published:
        for photo in session.exec(select(YearOfPhoto).where(YearOfPhoto.report_id == report_id)).all():
            photo.status = "published"
            session.add(photo)

    session.commit()
    session.refresh(report)
    return _report_out(session, report)


@router.delete("/reports/{report_id}")
def delete_report(
    report_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    report = get_or_404(session, YearOfReport, report_id, "Verslag")
    for tag in session.exec(select(YearOfReportPlayerTag).where(YearOfReportPlayerTag.report_id == report_id)).all():
        session.delete(tag)
    for link in session.exec(select(YearOfReportLink).where(YearOfReportLink.report_id == report_id)).all():
        session.delete(link)
    for photo in session.exec(select(YearOfPhoto).where(YearOfPhoto.report_id == report_id)).all():
        photo.report_id = None
        session.add(photo)
    session.delete(report)
    session.commit()
    return {"ok": True}


@router.post("/reports/{report_id}/move")
def move_report(
    report_id: str,
    body: MoveDirection,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """WYSIWYG-editor: verwissel sort_order met de vorige/volgende sibling
    binnen dezelfde wedstrijdpagina."""
    report = get_or_404(session, YearOfReport, report_id, "Verslag")
    if not report.match_ref:
        raise HTTPException(400, "Alleen wedstrijd-gebonden berichten kunnen verplaatst worden")
    siblings = session.exec(
        select(YearOfReport).where(YearOfReport.match_ref == report.match_ref).order_by(YearOfReport.sort_order)
    ).all()
    idx = next((i for i, r in enumerate(siblings) if r.id == report_id), None)
    if idx is None:
        raise HTTPException(404, "Verslag niet gevonden")
    swap_idx = idx - 1 if body.direction == "up" else idx + 1
    if swap_idx < 0 or swap_idx >= len(siblings):
        return {"ok": True}
    other = siblings[swap_idx]
    report.sort_order, other.sort_order = other.sort_order, report.sort_order
    session.add(report)
    session.add(other)
    session.commit()
    return {"ok": True}


@router.post("/reports/{report_id}/links", status_code=201)
def add_report_link(
    report_id: str,
    body: ReportLinkIn,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    get_or_404(session, YearOfReport, report_id, "Verslag")
    existing_count = len(session.exec(select(YearOfReportLink).where(YearOfReportLink.report_id == report_id)).all())
    link = YearOfReportLink(report_id=report_id, link_type=body.link_type, url=body.url, note=body.note,
                            sort_order=existing_count)
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


@router.patch("/reports/links/{link_id}")
def update_report_link(
    link_id: str,
    body: ReportLinkUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    link = get_or_404(session, YearOfReportLink, link_id, "Link")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(link, key, value)
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


@router.delete("/reports/links/{link_id}")
def delete_report_link(
    link_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    link = get_or_404(session, YearOfReportLink, link_id, "Link")
    session.delete(link)
    session.commit()
    return {"ok": True}


@router.post("/reports/{report_id}/tags/{player_id}")
def tag_report(
    report_id: str,
    player_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    get_or_404(session, YearOfReport, report_id, "Verslag")
    get_or_404(session, YearOfPlayer, player_id, "Speler")
    existing = session.exec(
        select(YearOfReportPlayerTag)
        .where(YearOfReportPlayerTag.report_id == report_id)
        .where(YearOfReportPlayerTag.player_id == player_id)
    ).first()
    if existing:
        return existing
    tag = YearOfReportPlayerTag(report_id=report_id, player_id=player_id)
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


@router.delete("/reports/{report_id}/tags/{player_id}")
def untag_report(
    report_id: str,
    player_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    existing = session.exec(
        select(YearOfReportPlayerTag)
        .where(YearOfReportPlayerTag.report_id == report_id)
        .where(YearOfReportPlayerTag.player_id == player_id)
    ).first()
    if existing:
        session.delete(existing)
        session.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Profiellinkje (fase 6, item 1148) — permanent, per speler. Wijzigingen
# gaan altijd via een concept-staging-rij (YearOfPlayerEdit), nooit direct
# op de live YearOfPlayer-rij en nooit auto-publish.
# ---------------------------------------------------------------------------

class PlayerEditSubmit(BaseModel):
    profile_link_code: str
    nickname: Optional[str] = None
    position: Optional[str] = None
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    fun_facts: Optional[str] = None


@router.post("/profile-links")
def create_profile_link(
    player_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder-only — maakt (of hergebruikt) het permanente profiellinkje van een speler."""
    get_or_404(session, YearOfPlayer, player_id, "Speler")
    existing = session.exec(select(YearOfProfileLink).where(YearOfProfileLink.player_id == player_id)).first()
    if existing:
        return existing

    code = None
    for _ in range(20):
        candidate = "".join(random.choices(TEAM_LINK_CHARS, k=6))
        if not session.get(YearOfProfileLink, candidate):
            code = candidate
            break
    if not code:
        raise RuntimeError("Geen unieke code gevonden")

    link = YearOfProfileLink(id=code, player_id=player_id)
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


@router.get("/profile-links")
def list_profile_links(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return session.exec(select(YearOfProfileLink)).all()


@router.get("/profile-links/{code}")
def get_profile_link_context(code: str, session: Session = Depends(get_session)):
    """Publiek — het profiel-bewerkformulier haalt hiermee de huidige gegevens op."""
    link = session.get(YearOfProfileLink, code.strip().lower())
    if not link:
        raise HTTPException(status_code=403, detail="Dit profiellinkje is ongeldig")
    player = get_or_404(session, YearOfPlayer, link.player_id, "Speler")
    return player


PROFILE_PHOTO_ROOT = Path(settings.UPLOAD_ROOT).resolve() / "yearof-mo14" / "profile-photos"


async def _save_profile_photo(file: UploadFile) -> str:
    ext = Path(file.filename or "upload").suffix.lower() or ".jpg"
    if ext not in PHOTO_ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Bestandsextensie niet toegestaan: {ext}")
    base_type = (file.content_type or "").split(";")[0].strip()
    if base_type not in PHOTO_ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Bestandstype niet toegestaan: {file.content_type}")

    content = await file.read()
    if len(content) > PHOTO_MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Bestand te groot. Maximum is {PHOTO_MAX_SIZE_MB}MB")

    filename = f"{uuid.uuid4()}.jpg"
    try:
        image = Image.open(io.BytesIO(content)).convert("RGB")
        image.thumbnail((800, 800))
        PROFILE_PHOTO_ROOT.mkdir(parents=True, exist_ok=True)
        image.save(PROFILE_PHOTO_ROOT / filename, "JPEG", quality=85)
    except Exception:
        raise HTTPException(status_code=400, detail="Kon foto niet verwerken (ongeldig beeldbestand)")

    return f"/api/yearof-mo14/profile-photos/{filename}"


@router.post("/profile-links/{code}/photo")
async def upload_profile_photo(
    code: str,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    """Publiek — via het profiellinkje zelf (geen teamcode nodig). Slaat 1
    redelijk formaat op (geen 3 varianten zoals wedstrijdfotos - dit is een
    simpele profielfoto) en geeft de URL terug om mee te sturen in
    PlayerEditSubmit.photo_url; wordt pas na goedkeuring de echte foto."""
    link = session.get(YearOfProfileLink, code.strip().lower())
    if not link:
        raise HTTPException(status_code=403, detail="Dit profiellinkje is ongeldig")
    photo_url = await _save_profile_photo(file)
    return {"photo_url": photo_url}


@router.post("/players/{player_id}/photo")
async def upload_player_photo_admin(
    player_id: str,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder-only — profielfoto direct instellen (geen concept-review,
    in tegenstelling tot de publieke profiellink-route hierboven)."""
    player = get_or_404(session, YearOfPlayer, player_id, "Speler")
    player.photo_url = await _save_profile_photo(file)
    session.add(player)
    session.commit()
    session.refresh(player)
    return player


@router.get("/profile-photos/{filename}")
def get_profile_photo(filename: str):
    """Publiek, geen auth — zelfde principe als /api/uploads (img src stuurt geen Authorization-header)."""
    candidate = (PROFILE_PHOTO_ROOT / filename).resolve()
    if not str(candidate).startswith(str(PROFILE_PHOTO_ROOT)) or not candidate.exists():
        raise HTTPException(status_code=404, detail="Bestand niet gevonden")
    return FileResponse(str(candidate))


@router.post("/player-edits", status_code=201)
def submit_player_edit(body: PlayerEditSubmit, session: Session = Depends(get_session)):
    """Publiek — via het profiellinkje, geen homeplatform-login. Komt altijd
    als concept binnen; de live YearOfPlayer-rij wijzigt hier nog niet door."""
    code = body.profile_link_code.strip().lower()
    link = session.get(YearOfProfileLink, code)
    if not link:
        raise HTTPException(status_code=403, detail="Dit profiellinkje is ongeldig")

    edit = YearOfPlayerEdit(
        player_id=link.player_id,
        nickname=body.nickname,
        position=body.position,
        photo_url=body.photo_url,
        bio=body.bio,
        fun_facts=body.fun_facts,
        status="concept",
    )
    session.add(edit)
    session.commit()
    session.refresh(edit)
    return edit


@router.get("/player-edits/moderation")
def list_player_edits_for_moderation(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return session.exec(
        select(YearOfPlayerEdit).where(YearOfPlayerEdit.status == "concept").order_by(YearOfPlayerEdit.created_at.desc())
    ).all()


@router.post("/player-edits/{edit_id}/apply")
def apply_player_edit(
    edit_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder-only — zet de voorgestelde velden op de echte spelersrij."""
    edit = get_or_404(session, YearOfPlayerEdit, edit_id, "Wijziging")
    player = get_or_404(session, YearOfPlayer, edit.player_id, "Speler")

    for field in ("nickname", "position", "photo_url", "bio", "fun_facts"):
        value = getattr(edit, field)
        if value is not None:
            setattr(player, field, value)
    player.updated_at = datetime.utcnow()
    edit.status = "applied"

    session.add(player)
    session.add(edit)
    session.commit()
    session.refresh(player)
    return player


@router.delete("/player-edits/{edit_id}")
def reject_player_edit(
    edit_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    edit = get_or_404(session, YearOfPlayerEdit, edit_id, "Wijziging")
    edit.status = "rejected"
    session.add(edit)
    session.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Actie-instellingen (fase 8, item 1150) — doelbedrag/voortgang + de simpele
# betaallink-oplossing voor item 1153 (beheerder plakt zelf een extern
# betaalverzoek, geen eigen payment-integratie).
# ---------------------------------------------------------------------------

class ActionSettingsUpdate(BaseModel):
    goal_amount: Optional[int] = None
    raised_amount: Optional[int] = None
    donation_url: Optional[str] = None


def _get_action_settings(session: Session) -> YearOfActionSettings:
    settings_row = session.get(YearOfActionSettings, "default")
    if not settings_row:
        settings_row = YearOfActionSettings(id="default")
        session.add(settings_row)
        session.commit()
        session.refresh(settings_row)
    return settings_row


@router.get("/action")
def get_action_settings(session: Session = Depends(get_session)):
    """Publiek, geen teamcode nodig — de thermometer mag iedereen zien."""
    return _get_action_settings(session)


@router.patch("/action")
def update_action_settings(
    body: ActionSettingsUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    settings_row = _get_action_settings(session)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(settings_row, key, value)
    settings_row.updated_at = datetime.utcnow()
    session.add(settings_row)
    session.commit()
    session.refresh(settings_row)
    return settings_row
