"""Spelers — CRUD/archive/restore/photo-upload, player-edits (submit/
moderation/apply/reject), en profiellinkjes (create/list/context/photo-upload).
Zie __init__.py voor hoe dit sub-router samengevoegd wordt onder
/api/yearof-mo14."""

import io
import random
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
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
    YearOfMatchGoal,
    YearOfPhotoPlayerTag,
    YearOfPlayer,
    YearOfPlayerEdit,
    YearOfProfileLink,
    YearOfReportPlayerTag,
)

from ._shared import (
    PHOTO_ALLOWED_EXTENSIONS,
    PHOTO_ALLOWED_TYPES,
    PHOTO_MAX_SIZE_MB,
    TEAM_LINK_CHARS,
    require_team_access,
)

router = APIRouter(tags=["yearof-mo14"])


# ---------------------------------------------------------------------------
# Spelers
# ---------------------------------------------------------------------------

class PlayerIn(BaseModel):
    name: str
    nickname: Optional[str] = None
    shirt_number: Optional[int] = None
    role_title: Optional[str] = None
    position: Optional[str] = None
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    fun_facts: Optional[str] = None  # JSON-string


class PlayerUpdate(BaseModel):
    name: Optional[str] = None
    nickname: Optional[str] = None
    shirt_number: Optional[int] = None
    role_title: Optional[str] = None
    position: Optional[str] = None
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    fun_facts: Optional[str] = None


@router.get("/players")
def list_players(session: Session = Depends(get_session), _: None = Depends(require_team_access)):
    """Publiek - toont geen gearchiveerde spelers (zie /players/moderation voor de beheerder-lijst)."""
    rows = session.exec(
        select(YearOfPlayer).where(col(YearOfPlayer.archived_at).is_(None))
        .order_by(col(YearOfPlayer.shirt_number).is_(None), YearOfPlayer.shirt_number)
    ).all()
    return rows


@router.get("/players/moderation")
def list_players_moderation(session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    """Beheerder-only - inclusief gearchiveerde spelers. Moet vóór /players/{player_id}
    gedeclareerd staan, anders vangt die route 'moderation' als player_id weg."""
    rows = session.exec(
        select(YearOfPlayer).order_by(col(YearOfPlayer.shirt_number).is_(None), YearOfPlayer.shirt_number)
    ).all()
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
