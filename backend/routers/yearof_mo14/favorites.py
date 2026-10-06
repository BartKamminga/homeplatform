"""Favoriete fotos per speelster (item 1199): de beheerder kiest max 6
gepubliceerde fotos (geen filmpjes) waarop de speelster getagd is. Ze staan
als blok Favorieten op haar spelerspagina en - als enige fotos - op de
spelerslink voor vrienden. De favoriet hangt aan de foto-speler-tag, zodat
een teamfoto favoriet kan zijn voor 1 speelster zonder de anderen."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.crud import get_or_404
from core.database import get_session
from models.core import User
from models.yearof import YearOfPhoto, YearOfPhotoPlayerTag, YearOfPlayer

from ._shared import require_team_access

router = APIRouter(tags=["yearof-mo14"])

MAX_FAVORITES = 6

# Wat publiek over een favoriete foto meegaat (spelerslink): genoeg voor
# grid + lightbox, geen interne velden.
PUBLIC_PHOTO_FIELDS = ("id", "media_type", "caption", "created_at", "published_at")


def favorite_photos(session: Session, player_id: str) -> list[YearOfPhoto]:
    """Gepubliceerde favoriete fotos van 1 speelster, nieuwste eerst."""
    return session.exec(
        select(YearOfPhoto)
        .join(YearOfPhotoPlayerTag, YearOfPhotoPlayerTag.photo_id == YearOfPhoto.id)
        .where(
            YearOfPhotoPlayerTag.player_id == player_id,
            YearOfPhotoPlayerTag.favorite == True,  # noqa: E712
            YearOfPhoto.status == "published",
            col(YearOfPhoto.archived_at).is_(None),
            YearOfPhoto.media_type == "photo",
        )
        .order_by(YearOfPhoto.created_at.desc())
    ).all()


def public_photo(photo: YearOfPhoto) -> dict:
    return {field: getattr(photo, field) for field in PUBLIC_PHOTO_FIELDS}


@router.get("/players/{player_id}/favorites")
def list_player_favorites(
    player_id: str,
    session: Session = Depends(get_session),
    _: None = Depends(require_team_access),
):
    """Publiek (teamcode) - blok Favorieten op de spelerspagina."""
    return [public_photo(p) for p in favorite_photos(session, player_id)]


@router.get("/players/{player_id}/photos/moderation")
def list_player_photos_for_favorites(
    player_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder-only - alle fotos waarop de speelster getagd is, met
    favorite-vlag, om favorieten aan te vinken. Concept-fotos komen mee
    (gemarkeerd) maar tellen publiek pas mee zodra ze gepubliceerd zijn."""
    get_or_404(session, YearOfPlayer, player_id, "Speler")
    rows = session.exec(
        select(YearOfPhoto, YearOfPhotoPlayerTag.favorite)
        .join(YearOfPhotoPlayerTag, YearOfPhotoPlayerTag.photo_id == YearOfPhoto.id)
        .where(YearOfPhotoPlayerTag.player_id == player_id, YearOfPhoto.media_type == "photo", col(YearOfPhoto.archived_at).is_(None))
        .order_by(YearOfPhoto.created_at.desc())
    ).all()
    return [{**photo.model_dump(), "favorite": favorite} for photo, favorite in rows]


class FavoriteIn(BaseModel):
    favorite: bool


@router.put("/players/{player_id}/favorites/{photo_id}")
def set_player_favorite(
    player_id: str,
    photo_id: str,
    body: FavoriteIn,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    tag: Optional[YearOfPhotoPlayerTag] = session.exec(
        select(YearOfPhotoPlayerTag).where(
            YearOfPhotoPlayerTag.player_id == player_id, YearOfPhotoPlayerTag.photo_id == photo_id,
        )
    ).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Speelster staat niet op deze foto getagd")
    photo = get_or_404(session, YearOfPhoto, photo_id, "Foto")
    if body.favorite and photo.media_type != "photo":
        raise HTTPException(status_code=400, detail="Alleen fotos kunnen favoriet zijn, geen filmpjes")
    if body.favorite and not tag.favorite:
        # Gearchiveerde fotos tellen niet mee voor het maximum (item 1214).
        count = len(session.exec(
            select(YearOfPhotoPlayerTag)
            .join(YearOfPhoto, YearOfPhoto.id == YearOfPhotoPlayerTag.photo_id)
            .where(
                YearOfPhotoPlayerTag.player_id == player_id, YearOfPhotoPlayerTag.favorite == True,  # noqa: E712
                col(YearOfPhoto.archived_at).is_(None),
            )
        ).all())
        if count >= MAX_FAVORITES:
            raise HTTPException(status_code=400, detail=f"Maximaal {MAX_FAVORITES} favorieten per speelster")
    tag.favorite = body.favorite
    session.add(tag)
    session.commit()
    return {"ok": True, "favorite": tag.favorite}
