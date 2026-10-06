"""Speelster van de week (item 1200): de beheerder zet max 1 speelster in de
kijker; ze staat bovenaan de "In de kijker"-sectie op de homepagina tot er
een nieuwe gekozen wordt (een nieuwe kiezen beeindigt de vorige). De kaart
toont haar bio - geen eigen tekst - en klikt door naar haar spelerspagina."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.crud import get_or_404
from core.database import get_session
from models.core import User
from models.yearof import YearOfPlayer, YearOfPlayerSpotlight

from ._shared import require_team_access

router = APIRouter(tags=["yearof-mo14"])

# Wat de homepagina van de speelster nodig heeft (kaart + doorklik).
SPOTLIGHT_PLAYER_FIELDS = ("id", "name", "nickname", "shirt_number", "role_title", "position", "photo_url", "bio")


def _active(session: Session) -> list[YearOfPlayerSpotlight]:
    return session.exec(
        select(YearOfPlayerSpotlight).where(col(YearOfPlayerSpotlight.ended_at).is_(None))
    ).all()


@router.get("/player-spotlight")
def get_player_spotlight(
    session: Session = Depends(get_session),
    _: None = Depends(require_team_access),
):
    """Publiek (teamcode) - de huidige speelster van de week, of null."""
    spot = max(_active(session), key=lambda s: s.started_at, default=None)
    player = session.get(YearOfPlayer, spot.player_id) if spot else None
    if not spot or not player or player.archived_at is not None:
        return None
    return {
        "started_at": spot.started_at,
        "player": {field: getattr(player, field) for field in SPOTLIGHT_PLAYER_FIELDS},
    }


class SpotlightIn(BaseModel):
    player_id: Optional[str] = None  # None = niemand meer in de kijker


@router.put("/player-spotlight")
def set_player_spotlight(
    body: SpotlightIn,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder-only. Zet een speelster in de kijker; de vorige gaat er
    automatisch uit (max 1). player_id leeg = niemand in de kijker."""
    if body.player_id:
        get_or_404(session, YearOfPlayer, body.player_id, "Speler")
    now = datetime.utcnow()
    for row in _active(session):
        row.ended_at = now
        session.add(row)
    if body.player_id:
        session.add(YearOfPlayerSpotlight(player_id=body.player_id, started_at=now))
    session.commit()
    return {"ok": True, "player_id": body.player_id}
