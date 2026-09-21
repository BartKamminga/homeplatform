"""Foto-bijdragen — publieke upload (via teamlinkje, geen homeplatform-account),
server-side 3 beeldvarianten, video-serving, concept/published + beheerder-
moderatie, tags, like/unlike. Zie __init__.py voor hoe dit sub-router
samengevoegd wordt onder /api/yearof-mo14."""

import io
import shutil
from datetime import datetime
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
from models.yearof import (
    YearOfContributorLink,
    YearOfPhoto,
    YearOfPhotoPlayerTag,
    YearOfPlayer,
    YearOfReport,
)

from ._shared import (
    PHOTO_ALLOWED_EXTENSIONS,
    PHOTO_ALLOWED_TYPES,
    PHOTO_MAX_SIZE_MB,
    VIDEO_ALLOWED_EXTENSIONS,
    VIDEO_ALLOWED_TYPES,
    VIDEO_MAX_SIZE_MB,
    _valid_team_link,
    require_team_access,
)

router = APIRouter(tags=["yearof-mo14"])

PHOTO_ROOT = Path(settings.UPLOAD_ROOT).resolve() / "yearof-mo14" / "photos"
PHOTO_VARIANT_MAX_DIM = {"thumb": 400, "medium": 1600}  # "full" = ongeschaald (client had al gecomprimeerd)


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
    match_highlight: Optional[bool] = None


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
        published_at=datetime.utcnow() if status == "published" else None,
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
    highlights_only: bool = False,
    session: Session = Depends(get_session),
    _: None = Depends(require_team_access),
):
    """Publiek — toont alleen gepubliceerde fotos (concepten zijn beheerder-only,
    zie /photos/moderation). highlights_only (de losse wedstrijdlink, buiten de
    volledige app om) laat alleen de gecureerde match_highlight-subset zien."""
    q = select(YearOfPhoto).where(YearOfPhoto.status == "published")
    if match_ref:
        q = q.where(YearOfPhoto.match_ref == match_ref)
    if highlights_only:
        q = q.where(YearOfPhoto.match_highlight == True)  # noqa: E712
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
    if photo.status == "published" and photo.published_at is None:
        photo.published_at = datetime.utcnow()
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


@router.post("/photos/{photo_id}/like")
def like_photo(photo_id: str, session: Session = Depends(get_session), _: None = Depends(require_team_access)):
    """Publiek - alleen positieve reactie (hartje), geen aparte like-rijen per
    bezoeker. Dedupe (niet meerdere keren liken) gebeurt client-side via
    localStorage, zelfde vertrouwensmodel als de rest van de anonieme site."""
    photo = get_or_404(session, YearOfPhoto, photo_id, "Foto")
    photo.like_count += 1
    session.add(photo)
    session.commit()
    return {"like_count": photo.like_count}


@router.delete("/photos/{photo_id}/like")
def unlike_photo(photo_id: str, session: Session = Depends(get_session), _: None = Depends(require_team_access)):
    photo = get_or_404(session, YearOfPhoto, photo_id, "Foto")
    photo.like_count = max(0, photo.like_count - 1)
    session.add(photo)
    session.commit()
    return {"like_count": photo.like_count}


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
