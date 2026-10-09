"""Doelpunten per speler per wedstrijd (beheerder houdt dit handmatig bij) en
de positie van het foto-blok op de wedstrijdpagina (WYSIWYG-editor). Zie
__init__.py voor hoe dit sub-router samengevoegd wordt onder /api/yearof-mo14."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import get_current_user, require_admin
from core.crud import get_or_404
from core.database import get_session
from models.core import User
from models.hockey_discovery import HockeyClub
from models.yearof import YearOfMatchGoal, YearOfMatchPhotoBlock, YearOfReport
from services.club_colors import HEX_RE, effective_color

from ._shared import require_team_access

router = APIRouter(tags=["yearof-mo14"])


# ---------------------------------------------------------------------------
# Doelpunten per speler per wedstrijd (beheerder houdt dit handmatig bij)
# ---------------------------------------------------------------------------

class MatchGoalIn(BaseModel):
    goals: int


# ---------------------------------------------------------------------------
# Positie van het foto-blok op de wedstrijdpagina (WYSIWYG-editor) - zelfde
# spaced-sort_order-schema/swap-met-sibling-aanpak als YearOfReport.sort_order.
# ---------------------------------------------------------------------------

class PhotoBlockMove(BaseModel):
    direction: str  # "up" | "down"


def _photo_block_sort_order(session: Session, match_ref: str) -> int:
    block = session.get(YearOfMatchPhotoBlock, match_ref)
    if block:
        return block.sort_order
    lowest_report = session.exec(
        select(YearOfReport).where(YearOfReport.match_ref == match_ref, col(YearOfReport.archived_at).is_(None)).order_by(YearOfReport.sort_order)
    ).first()
    return (lowest_report.sort_order - 500) if lowest_report else -500


@router.get("/matches/{match_ref}/photo-block")
def get_photo_block_position(match_ref: str, session: Session = Depends(get_session)):
    return {"sort_order": _photo_block_sort_order(session, match_ref)}


@router.post("/matches/{match_ref}/photo-block/move")
def move_photo_block(
    match_ref: str,
    body: PhotoBlockMove,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    photo_sort = _photo_block_sort_order(session, match_ref)
    reports = session.exec(
        select(YearOfReport).where(YearOfReport.match_ref == match_ref, col(YearOfReport.archived_at).is_(None)).order_by(YearOfReport.sort_order)
    ).all()
    merged = sorted([("photos", None, photo_sort)] + [("report", r.id, r.sort_order) for r in reports], key=lambda t: t[2])
    idx = next(i for i, m in enumerate(merged) if m[0] == "photos")
    swap_idx = idx - 1 if body.direction == "up" else idx + 1
    if swap_idx < 0 or swap_idx >= len(merged):
        return {"ok": True}
    _, other_id, other_sort = merged[swap_idx]
    other_report = get_or_404(session, YearOfReport, other_id, "Verslag")

    block = session.get(YearOfMatchPhotoBlock, match_ref)
    if not block:
        block = YearOfMatchPhotoBlock(match_ref=match_ref, sort_order=photo_sort)
    block.sort_order = other_sort
    other_report.sort_order = photo_sort
    session.add(block)
    session.add(other_report)
    session.commit()
    return {"ok": True}


@router.get("/matches/{match_ref}/goals")
def list_match_goals(match_ref: str, session: Session = Depends(get_session), _: None = Depends(require_team_access)):
    rows = session.exec(select(YearOfMatchGoal).where(YearOfMatchGoal.match_ref == match_ref)).all()
    return [{"player_id": r.player_id, "goals": r.goals} for r in rows if r.goals]


@router.put("/matches/{match_ref}/goals/{player_id}")
def set_match_goal(
    match_ref: str,
    player_id: str,
    body: MatchGoalIn,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    row = session.exec(
        select(YearOfMatchGoal)
        .where(YearOfMatchGoal.match_ref == match_ref)
        .where(YearOfMatchGoal.player_id == player_id)
    ).first()
    if body.goals <= 0:
        if row:
            session.delete(row)
            session.commit()
        return {"player_id": player_id, "goals": 0}
    if not row:
        row = YearOfMatchGoal(match_ref=match_ref, player_id=player_id, goals=body.goals)
    else:
        row.goals = body.goals
    session.add(row)
    session.commit()
    return {"player_id": player_id, "goals": row.goals}


# ---------------------------------------------------------------------------
# Clubkleur voor de wedstrijdkop: automatisch uit het logo (services/club_colors),
# hier handmatig te overschrijven. color None = terug naar automatisch.
# ---------------------------------------------------------------------------

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
