"""Hockey - handmatige clubkleur voor de wedstrijdkop (yearof, poulebord).

Automatisch komt de kleur uit het logo (services/club_colors); hier
overschrijft een platformbeheerder hem. color None = terug naar automatisch.
Stond tot item 1280 in de yearof-router; hockeydata schrijven hoort aan de
hockey-kant."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from core.auth import require_admin
from core.database import get_session
from models.core import User
from models.hockey_discovery import HockeyClub
from services.club_colors import HEX_RE, effective_color

router = APIRouter(prefix="/api/hockey", tags=["hockey-clubs"])


class ClubColorIn(BaseModel):
    color: Optional[str] = None


@router.put("/club-colors/{club_id}")
def set_club_color(
    club_id: str,
    body: ClubColorIn,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    club = session.exec(select(HockeyClub).where(HockeyClub.external_id == club_id)).first()
    if not club:
        raise HTTPException(status_code=404, detail="Club niet gevonden")
    if body.color is not None and not HEX_RE.fullmatch(body.color):
        raise HTTPException(status_code=422, detail="Kleur moet #rrggbb zijn")
    club.primary_color_manual = body.color.lower() if body.color else None
    session.add(club)
    session.commit()
    return {"club_id": club_id, "color": effective_color(club), "manual": club.primary_color_manual}
