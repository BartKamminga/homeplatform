"""Hockey — clublocaties vullen (item 1184). Eenmalig na de deploy aanroepen,
daarna opnieuw voor nieuw ontdekte clubs (alleen clubs zonder locatie, tenzij force)."""

import httpx
from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from core.auth import get_current_user
from core.database import get_session
from models.hockey_discovery import HockeyClub
from services.hockey_club_geo import geocode

router = APIRouter(prefix="/api/hockey", tags=["hockey-club-geo"])


@router.post("/clubs/geocode")
def geocode_clubs(
    force: bool = False,
    limit: int = 500,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    clubs = session.exec(select(HockeyClub)).all()
    todo = [c for c in clubs if force or c.latitude is None][:max(1, min(limit, 1000))]
    found, not_found, errors = 0, [], []
    with httpx.Client(timeout=10) as client:
        for club in todo:
            if not club.zipcode and not club.city:
                not_found.append(club.name)
                continue
            try:
                point = geocode(client, club.zipcode, club.city)
            except httpx.HTTPError as exc:
                errors.append(f"{club.name}: {exc.__class__.__name__}")
                continue
            if point is None:
                not_found.append(club.name)
                continue
            club.latitude, club.longitude = point
            session.add(club)
            found += 1
    session.commit()
    return {
        "checked": len(todo), "geocoded": found,
        "not_found": not_found, "errors": errors[:20],
        "remaining_without_location": sum(1 for c in clubs if c.latitude is None),
    }
