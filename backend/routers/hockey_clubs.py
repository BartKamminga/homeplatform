"""Hockey — clubs, club detail, teams query."""

import json
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.capture import DataCapture, new_uuid
from models.hockey_discovery import HockeyClub, HockeyTeam, HockeyTeamPoule
from services.hockey_club_capture_core import apply_club_detail, apply_clubs_list

router = APIRouter(prefix="/api/hockey", tags=["hockey-clubs"])


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
    result = apply_clubs_list(session, [c.model_dump() for c in body.clubs])

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
    return {
        "created": result.clubs_created,
        "updated": result.clubs_updated,
        "total":   result.clubs_created + result.clubs_updated,
    }


@router.get("/clubs")
def list_clubs(
    slim: bool = False,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    clubs = session.exec(select(HockeyClub).order_by(col(HockeyClub.name))).all()
    if slim:
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
                    "detail_loaded": c.detail_loaded,
                    "district": c.district,
                }
                for c in clubs
            ],
        }
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
                "address": c.address,
                "zipcode": c.zipcode,
                "phone": c.phone,
                "email": c.email,
                "website": c.website,
                "district": c.district,
                "tenue": c.tenue,
                "hockey_types": c.hockey_types,
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
    payment_options: Optional[object] = None
    parking: Optional[str] = None
    hockey_types: Optional[object] = None
    teams: List[TeamIn] = []
    session_id: Optional[str] = None


@router.post("/club-detail")
def upsert_club_detail(
    body: ClubDetailIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    result = apply_club_detail(session, body)

    # Archive per session (idempotent per club)
    if body.session_id:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
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
                    "youth_teams": result.youth_teams,
                }, ensure_ascii=False),
                captured_at=now,
            ))

    session.commit()
    return {
        "club": body.federation_reference_id,
        "teams_created": result.teams_created,
        "teams_updated": result.teams_updated,
        "total_teams": result.teams_created + result.teams_updated,
        "youth_teams": result.youth_teams,
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

    # item 990: teams die ook in een 2e competitie spelen (bv. bekertoernooi
    # naast de reguliere competitie) hebben naast recent_poule_id (primair)
    # ook 1 of meer extra koppelingen in hockey_team_poules.
    extra_by_team: Dict[int, list] = {}
    if teams:
        team_ids = {t.team_id for t in teams}
        for r in session.exec(
            select(HockeyTeamPoule).where(col(HockeyTeamPoule.team_id).in_(team_ids))
        ).all():
            extra_by_team.setdefault(r.team_id, []).append(r.poule_id)

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
                "extra_poule_ids": extra_by_team.get(t.team_id, []),
            }
            for t in teams
        ],
    }
