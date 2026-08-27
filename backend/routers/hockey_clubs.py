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
from models.hockey_discovery import HockeyClub, HockeyPoule, HockeyTeam, HockeyTeamPoule
from routers.hockey_capture import _get_target_season
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
    season: Optional[str] = None,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """item 994: optionele season-scoping. Zonder season: ongewijzigd gedrag
    (recent_poule_id + alle extra_poule_ids, seizoen-onafhankelijk - zoals de
    Competities-view dit al gebruikte). Met season: recent_poule_id wordt
    genuld als die (gecaptured) bij een ANDER seizoen hoort, en extra_poule_ids
    wordt gefilterd op HockeyTeamPoule.season - zodat "hoeveel poules heeft dit
    team in seizoen X" een betrouwbaar antwoord krijgt in de Clubs-view."""
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
        extra_q = select(HockeyTeamPoule).where(col(HockeyTeamPoule.team_id).in_(team_ids))
        if season:
            extra_q = extra_q.where(HockeyTeamPoule.season == season)
        for r in session.exec(extra_q).all():
            extra_by_team.setdefault(r.team_id, []).append(r.poule_id)

    # item 994: recent_poule_id heeft zelf geen season-veld (HockeyTeam
    # bevat geen season-kolom) - pas herleidbaar via HockeyPoule.season zodra
    # gecaptured. Nog niet gecaptured -> alleen tonen voor het actieve
    # serverdoelseizoen (dezelfde aanname als de rest van de scan-queue).
    primary_season_by_poule: Dict[int, str] = {}
    if season and teams:
        poule_ids = {t.recent_poule_id for t in teams if t.recent_poule_id}
        if poule_ids:
            for p in session.exec(select(HockeyPoule).where(col(HockeyPoule.poule_id).in_(poule_ids))).all():
                primary_season_by_poule[p.poule_id] = p.season
        target_season = _get_target_season(session)

    def _primary_for_season(t: HockeyTeam) -> Optional[int]:
        if not season or not t.recent_poule_id:
            return t.recent_poule_id
        captured_season = primary_season_by_poule.get(t.recent_poule_id)
        if captured_season is not None:
            return t.recent_poule_id if captured_season == season else None
        return t.recent_poule_id if season == target_season else None

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
                "recent_poule_id": _primary_for_season(t),
                "extra_poule_ids": extra_by_team.get(t.team_id, []),
            }
            for t in teams
        ],
    }
