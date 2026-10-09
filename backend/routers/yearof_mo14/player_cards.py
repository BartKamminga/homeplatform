"""Spelerskaart in FIFA-stijl per speelster.

Zes waarden (SNE snelheid, TEC techniek, PAS passen, SCH schieten, VER
verdedigen, FYS fysiek), totaal = gemiddelde of door de beheerder overschreven,
stijl goud/nacht/paris en live/concept per speelster. Stijl leeg = speelster
van de week goud, anders de standaard van de Team-pagina (blokinstelling
page.team.card_style), anders nacht.
"""

import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.crud import get_or_404
from core.database import get_session
from models.core import User
from models.yearof import YearOfMatchGoal, YearOfPlayer, YearOfPlayerCard, YearOfPlayerSpotlight

from ._shared import require_team_access
from .page_blocks import load_block_settings

router = APIRouter(tags=["yearof-mo14"])

STAT_KEYS = ("SNE", "TEC", "PAS", "SCH", "VER", "FYS")
STYLES = ("goud", "nacht", "paris")
SPOTLIGHT_STYLE = "goud"
FALLBACK_STYLE = "nacht"


def _stats(card: YearOfPlayerCard) -> dict:
    try:
        raw = json.loads(card.stats) if card.stats else {}
    except ValueError:
        raw = {}
    return {k: raw[k] for k in STAT_KEYS if isinstance(raw.get(k), int)}


def _serialize(card: YearOfPlayerCard, spotlight_ids: set, default_style: str, goals: dict) -> dict:
    stats = _stats(card)
    average = round(sum(stats.values()) / len(stats)) if stats else None
    style = card.style or (SPOTLIGHT_STYLE if card.player_id in spotlight_ids else default_style)
    return {
        "player_id": card.player_id,
        "stats": stats,
        "overall": card.overall_override if card.overall_override is not None else average,
        "overall_override": card.overall_override,
        "average": average,
        "style": card.style,
        "effective_style": style,
        "live": card.live,
        "goals": goals.get(card.player_id, 0),
    }


def _context(session: Session) -> tuple[set, str, dict]:
    spotlight_ids = set(session.exec(
        select(YearOfPlayerSpotlight.player_id).where(col(YearOfPlayerSpotlight.ended_at).is_(None))
    ).all())
    default_style = load_block_settings(session).get("page.team", {}).get("card_style")
    goals = dict(session.exec(
        select(YearOfMatchGoal.player_id, func.sum(YearOfMatchGoal.goals)).group_by(YearOfMatchGoal.player_id)
    ).all())
    return spotlight_ids, default_style if default_style in STYLES else FALLBACK_STYLE, goals


@router.get("/player-cards")
def list_player_cards(session: Session = Depends(get_session), _: None = Depends(require_team_access)):
    """Publiek (teamcode) - alleen de live kaarten."""
    ctx = _context(session)
    cards = session.exec(select(YearOfPlayerCard).where(YearOfPlayerCard.live == True)).all()  # noqa: E712
    return [_serialize(c, *ctx) for c in cards]


@router.get("/player-cards/moderation/{player_id}")
def get_player_card_moderation(player_id: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    """Beheerder - de kaart van 1 speelster, ook in concept (of een lege)."""
    get_or_404(session, YearOfPlayer, player_id, "Speler")
    card = session.get(YearOfPlayerCard, player_id) or YearOfPlayerCard(player_id=player_id)
    return _serialize(card, *_context(session))


class PlayerCardIn(BaseModel):
    stats: Optional[dict[str, Optional[int]]] = None
    overall_override: Optional[int] = None
    style: Optional[str] = None
    live: Optional[bool] = None
    clear_override: bool = False


@router.put("/player-cards/{player_id}")
def save_player_card(
    player_id: str,
    body: PlayerCardIn,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    """Beheerder - waarden, eigen totaal, stijl en/of live/concept opslaan (alleen meegegeven velden)."""
    get_or_404(session, YearOfPlayer, player_id, "Speler")
    card = session.get(YearOfPlayerCard, player_id) or YearOfPlayerCard(player_id=player_id)
    if body.stats is not None:
        clean = {}
        for key, value in body.stats.items():
            if key not in STAT_KEYS:
                raise HTTPException(status_code=422, detail=f"Onbekende waarde: {key}")
            if value is not None:
                if not 1 <= value <= 99:
                    raise HTTPException(status_code=422, detail="Waarden tussen 1 en 99")
                clean[key] = value
        card.stats = json.dumps(clean)
    if body.clear_override:
        card.overall_override = None
    elif body.overall_override is not None:
        if not 1 <= body.overall_override <= 99:
            raise HTTPException(status_code=422, detail="Totaal tussen 1 en 99")
        card.overall_override = body.overall_override
    if body.style is not None:
        if body.style not in STYLES and body.style != "":
            raise HTTPException(status_code=422, detail="Onbekende stijl")
        card.style = body.style or None
    if body.live is not None:
        card.live = body.live
    card.updated_at = datetime.utcnow()
    session.add(card)
    session.commit()
    session.refresh(card)
    return _serialize(card, *_context(session))
