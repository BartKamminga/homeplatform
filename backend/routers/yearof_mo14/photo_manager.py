"""Fotobeheer als werkbak (item 1213): 1 beheerlijst met alles wat de
PhotoManager nodig heeft om client-side te filteren/sorteren/groeperen, en
1 bulk-endpoint zodat acties op honderden fotos in 1 transactie gaan i.p.v.
honderden losse PATCH-requests. Gebruikt door de tab Foto's en het
fotobeheer op de wedstrijdpagina (zelfde component)."""

import shutil
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.core import User
from models.yearof import (
    YearOfContributorLink,
    YearOfPhoto,
    YearOfPhotoPlayerTag,
    YearOfPlayer,
    YearOfReport,
    YearOfTeamLink,
)

from .photos import PHOTO_ROOT

router = APIRouter(tags=["yearof-mo14"])

PHOTO_TYPES = ("actie", "team", "sfeer")
REPORT_TYPE_LABEL = {"interview": "Interview", "wedstrijdverslag": "Verslag", "nieuws": "Algemeen", "foto": "Foto's"}


@router.get("/photos/manager")
def list_photos_for_manager(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder-only - alle fotos/filmpjes met tags, favorieten, bron van de
    upload en het verslag waar ze bij horen."""
    photos = session.exec(select(YearOfPhoto).order_by(YearOfPhoto.created_at.desc())).all()

    tags: dict[str, list[str]] = {}
    favorites: dict[str, list[str]] = {}
    for t in session.exec(select(YearOfPhotoPlayerTag)).all():
        tags.setdefault(t.photo_id, []).append(t.player_id)
        if t.favorite:
            favorites.setdefault(t.photo_id, []).append(t.player_id)

    names = {p.id: (p.nickname or p.name) for p in session.exec(select(YearOfPlayer)).all()}
    team_codes = {t.id for t in session.exec(select(YearOfTeamLink)).all()}
    contributors = {c.id: c for c in session.exec(select(YearOfContributorLink)).all()}
    reports = {r.id: r for r in session.exec(select(YearOfReport)).all()}

    def source(code: Optional[str]) -> dict:
        if code and code in contributors:
            c = contributors[code]
            who = names.get(c.player_id, "team") if c.player_id else "team"
            return {"kind": "invullink", "label": f"Invullink {REPORT_TYPE_LABEL.get(c.report_type, c.report_type)} · {who}"}
        if code and code in team_codes:
            return {"kind": "sitelink", "label": "Upload via de site"}
        return {"kind": "beheer", "label": "Beheerder"}

    out = []
    for p in photos:
        report = reports.get(p.report_id) if p.report_id else None
        out.append({
            **p.model_dump(exclude={"uploader_code"}),
            "player_ids": tags.get(p.id, []),
            "favorite_player_ids": favorites.get(p.id, []),
            "source": source(p.uploader_code),
            "report": {"id": report.id, "title": report.title, "status": report.status} if report else None,
        })
    return out


class BulkIn(BaseModel):
    ids: list[str]
    action: Literal["publish", "concept", "delete", "type", "highlight_on", "highlight_off", "move", "tag", "untag"]
    value: Optional[str] = None  # type / match_ref / player_id, afhankelijk van action


@router.post("/photos/bulk")
def bulk_photos(
    body: BulkIn,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder-only - 1 actie op veel fotos in 1 transactie. Verplaatsen
    slaat fotos over die bij een verslag horen (hun wedstrijd volgt het
    verslag); highlight alleen voor fotos bij een wedstrijd."""
    if body.action == "type" and body.value not in PHOTO_TYPES:
        raise HTTPException(status_code=400, detail="Onbekend type")
    if body.action in ("move", "tag", "untag") and not body.value:
        raise HTTPException(status_code=400, detail="Kies eerst een wedstrijd/speelster")
    if body.action in ("tag", "untag") and not session.get(YearOfPlayer, body.value):
        raise HTTPException(status_code=404, detail="Speler niet gevonden")

    photos = session.exec(select(YearOfPhoto).where(col(YearOfPhoto.id).in_(body.ids))).all() if body.ids else []
    now = datetime.utcnow()
    updated, skipped, deleted_dirs = 0, 0, []

    for photo in photos:
        if body.action == "publish":
            photo.status = "published"
            photo.published_at = photo.published_at or now
        elif body.action == "concept":
            photo.status = "concept"
        elif body.action == "type":
            photo.photo_type = body.value
        elif body.action in ("highlight_on", "highlight_off"):
            if not photo.match_ref:
                skipped += 1
                continue
            photo.match_highlight = body.action == "highlight_on"
        elif body.action == "move":
            if photo.report_id:
                skipped += 1
                continue
            photo.match_ref = body.value
            photo.match_highlight = False  # highlight hoorde bij de oude wedstrijd
        elif body.action in ("tag", "untag"):
            existing = session.exec(
                select(YearOfPhotoPlayerTag)
                .where(YearOfPhotoPlayerTag.photo_id == photo.id, YearOfPhotoPlayerTag.player_id == body.value)
            ).first()
            if body.action == "tag" and not existing:
                session.add(YearOfPhotoPlayerTag(photo_id=photo.id, player_id=body.value))
            elif body.action == "untag" and existing:
                session.delete(existing)
            updated += 1
            continue
        elif body.action == "delete":
            for tag in session.exec(select(YearOfPhotoPlayerTag).where(YearOfPhotoPlayerTag.photo_id == photo.id)).all():
                session.delete(tag)
            session.delete(photo)
            deleted_dirs.append(photo.id)
            updated += 1
            continue
        photo.updated_at = now
        session.add(photo)
        updated += 1

    session.commit()
    for photo_id in deleted_dirs:
        shutil.rmtree(PHOTO_ROOT / photo_id, ignore_errors=True)
    return {"updated": updated, "skipped": skipped}
