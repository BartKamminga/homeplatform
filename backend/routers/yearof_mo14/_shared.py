"""Gedeelde constants en dependency-functies voor de yearof_mo14-routers —
gebruikt door 2 of meer van de domeinmodules in dit package (zie __init__.py
voor hoe de sub-routers samengevoegd worden tot router/shortlink_router)."""

import random
import string
from datetime import datetime
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select

from core.auth import decode_token, hash_api_key
from core.database import get_session
from models.core import User, UserApiKey
from models.yearof import YearOfShortLink, YearOfTeamLink

TEAM_NAME = "Victoria MO14-1"
POULE_ID = 551  # HockeyPoule.id, single-tenant hardcoded (zie item 1143 architectuurbeslissing)

# ---------------------------------------------------------------------------
# Teamlinkje (viewer-toegang) — v1: simpele code, handmatig vervangen.
# Per-wedstrijd rotatie + vangnet + content-scoping volgen in fase 1149.
# ---------------------------------------------------------------------------

TEAM_LINK_CHARS = string.ascii_lowercase + string.digits


def new_link_code(session: Session) -> str:
    """Unieke 6-char code voor een teamlinkje of korte link. Beide komen als
    `code`-parameter binnen (zie check_match_access), dus de code mag in
    geen van beide tabellen al bestaan."""
    for _ in range(20):
        code = "".join(random.choices(TEAM_LINK_CHARS, k=6))
        if not session.get(YearOfTeamLink, code) and not session.get(YearOfShortLink, code):
            return code
    raise RuntimeError("Geen unieke code gevonden")


# ---------------------------------------------------------------------------
# Foto-bijdragen — publieke upload (via teamlinkje, geen homeplatform-account),
# server-side 3 beeldvarianten, concept/published + beheerder-moderatie.
# Deze constanten heten "PHOTO_*" maar worden ook hergebruikt door
# _save_profile_photo (players.py) en _save_sponsor_logo (action_sponsors.py),
# niet alleen door photos.py zelf — vandaar hier in _shared i.p.v. lokaal.
# ---------------------------------------------------------------------------

PHOTO_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
PHOTO_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
PHOTO_MAX_SIZE_MB = 15

# Filmpjes (item 1154): ruw bestand opslaan, geen transcode/thumbnail (geen
# ffmpeg beschikbaar) - frontend toont een video-icoontje in de grid en speelt
# het bestand direct af in de lightbox.
VIDEO_ALLOWED_TYPES = {"video/mp4", "video/quicktime", "video/webm"}
VIDEO_ALLOWED_EXTENSIONS = {".mp4", ".mov", ".webm"}
VIDEO_MAX_SIZE_MB = 200


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


def _valid_short_link(code: Optional[str], session: Session) -> Optional[YearOfShortLink]:
    """Wedstrijd-/spelerslink als toegangstoken (item 1186). Nieuwe links
    hebben een eigen vervaldatum; legacy wedstrijdlinks (zonder expires_at)
    blijven geldig zolang hun bevroren teamcode geldig is."""
    if not code:
        return None
    link = session.get(YearOfShortLink, code.strip().lower())
    if not link or link.revoked_at is not None:
        return None
    if link.expires_at is None:
        return link if _valid_team_link(link.team_code, session) else None
    return link if link.expires_at >= datetime.utcnow() else None


def check_match_access(
    session: Session,
    current_user: Optional[User],
    code: Optional[str],
    match_ref: Optional[str],
) -> str:
    """'full' voor beheerder/teamcode, 'match' voor een wedstrijdlink van
    precies deze wedstrijd - anders 403. Bij 'match' tonen de endpoints
    alleen de gecureerde highlights (zoals de losse wedstrijdpagina)."""
    if current_user is not None or _valid_team_link(code, session):
        return "full"
    link = _valid_short_link(code, session)
    if link and link.link_type == "match" and match_ref and link.match_ref == match_ref:
        return "match"
    raise HTTPException(status_code=403, detail="Deze link is verlopen of ongeldig")


def require_match_access(
    match_ref: Optional[str] = None,
    code: Optional[str] = None,
    current_user: Optional[User] = Depends(get_optional_user),
    session: Session = Depends(get_session),
) -> str:
    """Dependency-variant van check_match_access - match_ref komt uit het pad
    of de query van het endpoint zelf."""
    return check_match_access(session, current_user, code, match_ref)


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
