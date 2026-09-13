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

Single-tenant, bewust hardcoded voor Victoria MO14-1 (poule_id 551, Topklasse
Zuid-Holland poule B, seizoen 2026-2027) - zie roadmap item 1142/1143.
Publieke content/tokens (teamlinkje, foto's, verslagen) komen in latere fases.
"""

import io
import random
import shutil
import string
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.crud import get_or_404
from core.database import get_session
from core.settings import settings
from models.core import User
from models.hockey_discovery import HockeyPoule
from models.yearof import (
    YearOfContributorLink,
    YearOfCustomEntry,
    YearOfPhoto,
    YearOfPhotoPlayerTag,
    YearOfPlayer,
    YearOfReport,
    YearOfReportPlayerTag,
    YearOfTeamLink,
)
from routers.hockey_public import _serialize_poule_matches

router = APIRouter(prefix="/api/yearof-mo14", tags=["yearof-mo14"])

TEAM_NAME = "Victoria MO14-1"
POULE_ID = 551  # HockeyPoule.id, single-tenant hardcoded (zie item 1143 architectuurbeslissing)


@router.get("/status")
def status():
    """Publiek, geen auth — bewijst dat de site/router leeft."""
    return {"site": "yearof-mo14", "fase": 5, "status": "verslagen en interviews"}


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


def _require_valid_team_code(code: str, session: Session) -> YearOfTeamLink:
    link = session.get(YearOfTeamLink, code.strip().lower())
    if not link or link.revoked_at is not None:
        raise HTTPException(status_code=403, detail="Ongeldige of verlopen teamcode")
    return link


# ---------------------------------------------------------------------------
# Foto-bijdragen — publieke upload (via teamlinkje, geen homeplatform-account),
# server-side 3 beeldvarianten, concept/published + beheerder-moderatie.
# ---------------------------------------------------------------------------

PHOTO_ROOT = Path(settings.UPLOAD_ROOT).resolve() / "yearof-mo14" / "photos"
PHOTO_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
PHOTO_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
PHOTO_MAX_SIZE_MB = 15
PHOTO_VARIANT_MAX_DIM = {"thumb": 400, "medium": 1600}  # "full" = ongeschaald (client had al gecomprimeerd)


def _photo_safe_path(photo_id: str, variant: str) -> Path:
    candidate = (PHOTO_ROOT / photo_id / f"{variant}.jpg").resolve()
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


class PhotoUpdate(BaseModel):
    status: Optional[str] = None
    photo_type: Optional[str] = None
    caption: Optional[str] = None


@router.post("/photos", status_code=201)
async def upload_photo(
    file: UploadFile = File(...),
    match_ref: str = Form(...),
    photo_type: str = Form("actie"),
    code: str = Form(...),
    session: Session = Depends(get_session),
):
    """Publiek — vereist een geldig teamlinkje (geen homeplatform-login)."""
    link = _require_valid_team_code(code, session)

    ext = Path(file.filename or "upload").suffix.lower() or ".jpg"
    if ext not in PHOTO_ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Bestandsextensie niet toegestaan: {ext}")
    base_type = (file.content_type or "").split(";")[0].strip()
    if base_type not in PHOTO_ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Bestandstype niet toegestaan: {file.content_type}")

    content = await file.read()
    if len(content) > PHOTO_MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Bestand te groot. Maximum is {PHOTO_MAX_SIZE_MB}MB")

    photo = YearOfPhoto(match_ref=match_ref, photo_type=photo_type, uploader_code=link.id)
    session.add(photo)
    session.commit()
    session.refresh(photo)

    try:
        _save_photo_variants(photo.id, content)
    except Exception:
        session.delete(photo)
        session.commit()
        raise HTTPException(status_code=400, detail="Kon foto niet verwerken (ongeldig beeldbestand)")

    return photo


@router.get("/photos/{photo_id}/{variant}.jpg")
def get_photo_file(photo_id: str, variant: str):
    """Publiek, geen auth — zelfde principe als /api/uploads (img src stuurt geen Authorization-header)."""
    if variant not in {"thumb", "medium", "full"}:
        raise HTTPException(status_code=404, detail="Onbekende variant")
    path = _photo_safe_path(photo_id, variant)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Bestand niet gevonden")
    return FileResponse(str(path))


@router.get("/photos")
def list_photos(
    match_ref: Optional[str] = None,
    player_id: Optional[str] = None,
    session: Session = Depends(get_session),
):
    """Publiek — toont alleen gepubliceerde fotos (concepten zijn beheerder-only, zie /photos/moderation)."""
    q = select(YearOfPhoto).where(YearOfPhoto.status == "published")
    if match_ref:
        q = q.where(YearOfPhoto.match_ref == match_ref)
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
    return session.exec(select(YearOfContributorLink).order_by(YearOfContributorLink.created_at.desc())).all()


@router.get("/contributor-links/{code}")
def get_contributor_link_context(code: str, session: Session = Depends(get_session)):
    """Publiek — het invulformulier haalt hiermee de context op (welke wedstrijd,
    voor wie) en checkt meteen of de link nog geldig is."""
    link = session.get(YearOfContributorLink, code.strip().lower())
    if not link or link.revoked_at is not None or link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=403, detail="Deze invullink is verlopen of ongeldig")

    player = session.get(YearOfPlayer, link.player_id) if link.player_id else None
    items = _competition_timeline_items(session) + _custom_timeline_items(session)
    match = next((it for it in items if it["match_ref"] == link.match_ref), None)

    return {
        "match_ref": link.match_ref,
        "match_title": match["title"] if match else link.match_ref,
        "player_id": link.player_id,
        "player_name": (player.nickname or player.name) if player else None,
    }


# ---------------------------------------------------------------------------
# Verslagen & interviews
# ---------------------------------------------------------------------------

class ReportSubmit(BaseModel):
    contributor_code: str
    title: str
    body: str
    author_name: Optional[str] = None
    insta_url: Optional[str] = None
    youtube_url: Optional[str] = None


class ReportCreate(BaseModel):
    match_ref: str
    report_type: str = "wedstrijdverslag"
    title: str
    body: str
    author_name: Optional[str] = None
    insta_url: Optional[str] = None
    youtube_url: Optional[str] = None
    status: str = "published"


class ReportUpdate(BaseModel):
    report_type: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    author_name: Optional[str] = None
    insta_url: Optional[str] = None
    youtube_url: Optional[str] = None
    status: Optional[str] = None


@router.post("/reports", status_code=201)
def submit_report(body: ReportSubmit, session: Session = Depends(get_session)):
    """Publiek — via een wedstrijd-invullink, geen homeplatform-login. Komt
    altijd als concept binnen, ongeacht wat er verder wordt meegestuurd."""
    code = body.contributor_code.strip().lower()
    link = session.get(YearOfContributorLink, code)
    if not link or link.revoked_at is not None or link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=403, detail="Deze invullink is verlopen of ongeldig")

    report = YearOfReport(
        match_ref=link.match_ref,
        report_type="interview",
        status="concept",
        title=body.title,
        body=body.body,
        author_name=body.author_name,
        insta_url=body.insta_url,
        youtube_url=body.youtube_url,
        contributor_code=code,
    )
    session.add(report)
    session.commit()
    session.refresh(report)

    if link.player_id:
        session.add(YearOfReportPlayerTag(report_id=report.id, player_id=link.player_id))
        session.commit()

    return report


@router.post("/reports/direct", status_code=201)
def create_report_direct(
    body: ReportCreate,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder-only — een verslag direct schrijven (bv. het officiele
    wedstrijdverslag), mag standaard meteen published zijn."""
    report = YearOfReport(**body.model_dump())
    session.add(report)
    session.commit()
    session.refresh(report)
    return report


@router.get("/reports")
def list_reports(match_ref: Optional[str] = None, session: Session = Depends(get_session)):
    """Publiek — toont alleen gepubliceerde verslagen."""
    q = select(YearOfReport).where(YearOfReport.status == "published")
    if match_ref:
        q = q.where(YearOfReport.match_ref == match_ref)
    return session.exec(q.order_by(YearOfReport.created_at.desc())).all()


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
    return [
        {**report.model_dump(), "player_ids": tags_by_report.get(report.id, [])}
        for report in reports
    ]


@router.patch("/reports/{report_id}")
def update_report(
    report_id: str,
    body: ReportUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    report = get_or_404(session, YearOfReport, report_id, "Verslag")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(report, key, value)
    session.add(report)
    session.commit()
    session.refresh(report)
    return report


@router.delete("/reports/{report_id}")
def delete_report(
    report_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    report = get_or_404(session, YearOfReport, report_id, "Verslag")
    for tag in session.exec(select(YearOfReportPlayerTag).where(YearOfReportPlayerTag.report_id == report_id)).all():
        session.delete(tag)
    session.delete(report)
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
