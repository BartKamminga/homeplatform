import json
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.capture import DataCapture, new_uuid
from models.hockey_discovery import HockeyClub, HockeyTeam

router = APIRouter(prefix="/api/tournix/discovery", tags=["hockey-discovery"])


# ── Clubs list ────────────────────────────────────────────
class ClubIn(BaseModel):
    federation_reference_id: str
    name: str
    friendly_name: str
    city: Optional[str] = None
    logo: Optional[str] = None
    type: str = "regular"


class ClubsBody(BaseModel):
    clubs: List[ClubIn]
    session_id: Optional[str] = None


@router.post("/clubs")
def upsert_clubs(
    body: ClubsBody,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    created = 0
    updated = 0
    for club_in in body.clubs:
        existing = session.exec(
            select(HockeyClub).where(HockeyClub.external_id == club_in.federation_reference_id)
        ).first()
        if existing:
            existing.name = club_in.name
            existing.friendly_name = club_in.friendly_name
            existing.city = club_in.city
            existing.logo_url = club_in.logo
            existing.club_type = club_in.type
            existing.updated_at = now
            session.add(existing)
            updated += 1
        else:
            club = HockeyClub(
                external_id=club_in.federation_reference_id,
                name=club_in.name,
                friendly_name=club_in.friendly_name,
                city=club_in.city,
                logo_url=club_in.logo,
                club_type=club_in.type,
                discovered_at=now,
                updated_at=now,
            )
            session.add(club)
            created += 1

    # Archive: one entry per session (idempotent)
    if body.session_id:
        already = session.exec(
            select(DataCapture)
            .where(DataCapture.session_id == body.session_id)
            .where(DataCapture.external_id == "clubs_list")
        ).first()
        if not already:
            session.add(DataCapture(
                id=new_uuid(),
                source="hockey-vanger",
                capture_type="clubs_list",
                external_id="clubs_list",
                session_id=body.session_id,
                payload=json.dumps([c.model_dump() for c in body.clubs], ensure_ascii=False),
                meta=json.dumps({"count": len(body.clubs)}, ensure_ascii=False),
                captured_at=now,
            ))

    session.commit()
    return {"created": created, "updated": updated, "total": created + updated}


@router.get("/clubs")
def list_clubs(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    clubs = session.exec(select(HockeyClub).order_by(col(HockeyClub.name))).all()
    return {
        "total": len(clubs),
        "detail_loaded": sum(1 for c in clubs if c.detail_loaded),
        "clubs": [
            {
                "id": c.id,
                "external_id": c.external_id,
                "name": c.name,
                "friendly_name": c.friendly_name,
                "city": c.city,
                "logo_url": c.logo_url,
                "club_type": c.club_type,
                "detail_loaded": c.detail_loaded,
                "discovered_at": c.discovered_at.isoformat(),
                "updated_at": c.updated_at.isoformat(),
            }
            for c in clubs
        ],
    }


# ── Club detail + teams ───────────────────────────────────
class TeamIn(BaseModel):
    id: int
    name: str
    short_name: str
    logo: Optional[str] = None
    hockey_type: str = ""
    category_group_name: str = ""
    federation_reference_id: Optional[str] = None
    recent_poule_id: Optional[int] = None


class ClubDetailIn(BaseModel):
    federation_reference_id: str
    name: str
    friendly_name: str
    logo: Optional[str] = None
    address: Optional[str] = None
    zipcode: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    tenue: Optional[str] = None
    district: Optional[str] = None
    payment_options: Optional[Any] = None
    parking: Optional[str] = None
    hockey_types: Optional[Any] = None
    teams: List[TeamIn] = []
    session_id: Optional[str] = None


@router.post("/club-detail")
def upsert_club_detail(
    body: ClubDetailIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    existing = session.exec(
        select(HockeyClub).where(HockeyClub.external_id == body.federation_reference_id)
    ).first()
    club = existing or HockeyClub(external_id=body.federation_reference_id, discovered_at=now)

    club.name = body.name
    club.friendly_name = body.friendly_name
    club.city = body.city
    club.logo_url = body.logo
    club.address = body.address
    club.zipcode = body.zipcode
    club.phone = body.phone
    club.email = body.email
    club.website = body.website
    club.tenue = body.tenue
    club.district = body.district
    club.payment_options = (
        json.dumps(body.payment_options, ensure_ascii=False)
        if isinstance(body.payment_options, list)
        else body.payment_options
    )
    club.parking = body.parking
    club.hockey_types = (
        json.dumps(body.hockey_types, ensure_ascii=False)
        if isinstance(body.hockey_types, list)
        else body.hockey_types
    )
    club.detail_loaded = True
    club.updated_at = now
    session.add(club)

    teams_created = 0
    teams_updated = 0
    youth_count = 0
    for team_in in body.teams:
        if team_in.category_group_name == "Junioren":
            youth_count += 1
        existing_team = session.exec(
            select(HockeyTeam).where(HockeyTeam.team_id == team_in.id)
        ).first()
        if existing_team:
            existing_team.name = team_in.name
            existing_team.short_name = team_in.short_name
            existing_team.logo_url = team_in.logo
            existing_team.hockey_type = team_in.hockey_type
            existing_team.category_group_name = team_in.category_group_name
            existing_team.recent_poule_id = team_in.recent_poule_id
            existing_team.updated_at = now
            session.add(existing_team)
            teams_updated += 1
        else:
            team = HockeyTeam(
                team_id=team_in.id,
                club_external_id=body.federation_reference_id,
                name=team_in.name,
                short_name=team_in.short_name,
                logo_url=team_in.logo,
                hockey_type=team_in.hockey_type,
                category_group_name=team_in.category_group_name,
                recent_poule_id=team_in.recent_poule_id,
                discovered_at=now,
                updated_at=now,
            )
            session.add(team)
            teams_created += 1

    # Archive per session (idempotent per club)
    if body.session_id:
        ext_id = "club_detail_" + body.federation_reference_id
        already = session.exec(
            select(DataCapture)
            .where(DataCapture.session_id == body.session_id)
            .where(DataCapture.external_id == ext_id)
        ).first()
        if not already:
            payload_dict = body.model_dump(exclude={"session_id"})
            session.add(DataCapture(
                id=new_uuid(),
                source="hockey-vanger",
                capture_type="club_detail",
                external_id=ext_id,
                session_id=body.session_id,
                payload=json.dumps(payload_dict, ensure_ascii=False, default=str),
                meta=json.dumps({
                    "club": body.federation_reference_id,
                    "name": body.friendly_name,
                    "teams": len(body.teams),
                    "youth_teams": youth_count,
                }, ensure_ascii=False),
                captured_at=now,
            ))

    session.commit()
    return {
        "club": body.federation_reference_id,
        "teams_created": teams_created,
        "teams_updated": teams_updated,
        "total_teams": teams_created + teams_updated,
        "youth_teams": youth_count,
    }


# ── Teams query ───────────────────────────────────────────
@router.get("/teams")
def list_youth_teams(
    category: Optional[str] = None,
    club_external_id: Optional[str] = None,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    q = select(HockeyTeam)
    if category:
        q = q.where(HockeyTeam.category_group_name == category)
    if club_external_id:
        q = q.where(HockeyTeam.club_external_id == club_external_id)
    q = q.order_by(col(HockeyTeam.name))
    teams = session.exec(q).all()
    return {
        "total": len(teams),
        "teams": [
            {
                "id": t.id,
                "team_id": t.team_id,
                "club_external_id": t.club_external_id,
                "name": t.name,
                "short_name": t.short_name,
                "hockey_type": t.hockey_type,
                "category_group_name": t.category_group_name,
                "recent_poule_id": t.recent_poule_id,
            }
            for t in teams
        ],
    }
