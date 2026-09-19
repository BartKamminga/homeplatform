"""Actie-instellingen (fase 8, item 1150) — doelbedrag/voortgang + de simpele
betaallink-oplossing voor item 1153 — en sponsors — vermelding op de
actiepagina (logo + naam + optionele tekst/link): list/create/update/
logo-upload/move/delete. Zie __init__.py voor hoe dit sub-router
samengevoegd wordt onder /api/yearof-mo14."""

import io
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image
from pydantic import BaseModel
from sqlmodel import Session, select

from core.auth import get_current_user
from core.crud import get_or_404
from core.database import get_session
from core.settings import settings
from models.core import User
from models.yearof import YearOfActionSettings, YearOfSponsor

from ._shared import PHOTO_ALLOWED_EXTENSIONS, PHOTO_ALLOWED_TYPES, PHOTO_MAX_SIZE_MB
from .reports import MoveDirection

router = APIRouter(tags=["yearof-mo14"])


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


# ---------------------------------------------------------------------------
# Sponsors — vermelding op de actiepagina (logo + naam + optionele tekst/link).
# Publiek net als /action zelf: de actiepagina/thermometer is bewust altijd
# zichtbaar, ook zonder teamcode, dus de sponsors die erop staan ook.
# ---------------------------------------------------------------------------

SPONSOR_LOGO_ROOT = Path(settings.UPLOAD_ROOT).resolve() / "yearof-mo14" / "sponsor-logos"


async def _save_sponsor_logo(file: UploadFile) -> str:
    ext = Path(file.filename or "upload").suffix.lower() or ".png"
    if ext not in PHOTO_ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Bestandsextensie niet toegestaan: {ext}")
    base_type = (file.content_type or "").split(";")[0].strip()
    if base_type not in PHOTO_ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Bestandstype niet toegestaan: {file.content_type}")

    content = await file.read()
    if len(content) > PHOTO_MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Bestand te groot. Maximum is {PHOTO_MAX_SIZE_MB}MB")

    filename = f"{uuid.uuid4()}.png"
    try:
        image = Image.open(io.BytesIO(content))
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA")
        image.thumbnail((600, 600))
        SPONSOR_LOGO_ROOT.mkdir(parents=True, exist_ok=True)
        image.save(SPONSOR_LOGO_ROOT / filename, "PNG")  # PNG, niet JPEG - logo's hebben vaak een transparante achtergrond
    except Exception:
        raise HTTPException(status_code=400, detail="Kon logo niet verwerken (ongeldig beeldbestand)")

    return f"/api/yearof-mo14/sponsor-logos/{filename}"


@router.get("/sponsor-logos/{filename}")
def get_sponsor_logo(filename: str):
    """Publiek, geen auth — zelfde principe als /api/uploads (img src stuurt geen Authorization-header)."""
    candidate = (SPONSOR_LOGO_ROOT / filename).resolve()
    if not str(candidate).startswith(str(SPONSOR_LOGO_ROOT)) or not candidate.exists():
        raise HTTPException(status_code=404, detail="Bestand niet gevonden")
    return FileResponse(str(candidate))


class SponsorIn(BaseModel):
    name: str
    description: Optional[str] = None
    website_url: Optional[str] = None


class SponsorUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    website_url: Optional[str] = None


@router.get("/sponsors")
def list_sponsors(session: Session = Depends(get_session)):
    """Publiek, geen teamcode nodig — zelfde reden als /action."""
    return session.exec(select(YearOfSponsor).order_by(YearOfSponsor.sort_order)).all()


@router.post("/sponsors", status_code=201)
def create_sponsor(
    body: SponsorIn,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    max_sort = session.exec(select(YearOfSponsor).order_by(YearOfSponsor.sort_order.desc())).first()
    sponsor = YearOfSponsor(**body.model_dump(), sort_order=(max_sort.sort_order + 1) if max_sort else 0)
    session.add(sponsor)
    session.commit()
    session.refresh(sponsor)
    return sponsor


@router.patch("/sponsors/{sponsor_id}")
def update_sponsor(
    sponsor_id: str,
    body: SponsorUpdate,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    sponsor = get_or_404(session, YearOfSponsor, sponsor_id, "Sponsor")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(sponsor, key, value)
    session.add(sponsor)
    session.commit()
    session.refresh(sponsor)
    return sponsor


@router.post("/sponsors/{sponsor_id}/logo")
async def upload_sponsor_logo(
    sponsor_id: str,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    sponsor = get_or_404(session, YearOfSponsor, sponsor_id, "Sponsor")
    sponsor.logo_url = await _save_sponsor_logo(file)
    session.add(sponsor)
    session.commit()
    session.refresh(sponsor)
    return sponsor


@router.post("/sponsors/{sponsor_id}/move")
def move_sponsor(
    sponsor_id: str,
    body: MoveDirection,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    sponsors = session.exec(select(YearOfSponsor).order_by(YearOfSponsor.sort_order)).all()
    idx = next((i for i, s in enumerate(sponsors) if s.id == sponsor_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Sponsor niet gevonden")
    swap_idx = idx - 1 if body.direction == "up" else idx + 1
    if 0 <= swap_idx < len(sponsors):
        sponsors[idx].sort_order, sponsors[swap_idx].sort_order = sponsors[swap_idx].sort_order, sponsors[idx].sort_order
        session.add(sponsors[idx])
        session.add(sponsors[swap_idx])
        session.commit()
    return {"ok": True}


@router.delete("/sponsors/{sponsor_id}")
def delete_sponsor(
    sponsor_id: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    sponsor = get_or_404(session, YearOfSponsor, sponsor_id, "Sponsor")
    if sponsor.logo_url:
        filename = sponsor.logo_url.rsplit("/", 1)[-1]
        (SPONSOR_LOGO_ROOT / filename).unlink(missing_ok=True)
    session.delete(sponsor)
    session.commit()
    return {"ok": True}
