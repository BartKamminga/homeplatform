import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.capture import DataCapture, new_uuid
from models.hockey_discovery import HockeyClub, HockeyCompetition, HockeyPoule, HockeyTeam

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


# ── Youth poule queue ────────────────────────────────────
_AGE_RE = re.compile(r"[JM][OZ](1[1-8])-")


def _is_target_age(short_name: str) -> bool:
    return bool(_AGE_RE.search(short_name or ""))


@router.get("/youth-queue")
def get_youth_queue(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Unique poule_ids for Junioren O11-O18, with capture status."""
    teams = session.exec(
        select(HockeyTeam)
        .where(HockeyTeam.category_group_name == "Junioren")
        .where(col(HockeyTeam.recent_poule_id).is_not(None))
        .where(col(HockeyTeam.name).not_like("z%"))
        .order_by(col(HockeyTeam.short_name))
    ).all()

    seen: Dict[int, dict] = {}
    for t in teams:
        if not t.recent_poule_id or not _is_target_age(t.short_name):
            continue
        pid = t.recent_poule_id
        if pid not in seen:
            seen[pid] = {
                "poule_id": pid,
                "team_id": t.team_id,
                "team_name": t.name,
                "short_name": t.short_name,
                "club_external_id": t.club_external_id,
                "hockey_type": t.hockey_type,
                "captured": False,
                "imported": False,
            }

    if not seen:
        return {"total": 0, "captured": 0, "imported": 0, "missing": 0, "stale": 0, "poules": []}

    target_season = "2026-2027"

    # Check HockeyPoule voor captured status + seizoencheck
    captured_poules = session.exec(
        select(HockeyPoule).where(col(HockeyPoule.poule_id).in_(list(seen.keys())))
    ).all()
    captured_map: Dict[int, str] = {p.poule_id: p.season for p in captured_poules}

    for pid, info in seen.items():
        if pid in captured_map:
            info["captured"] = True
            info["stale"] = captured_map[pid] != target_season
        else:
            info["captured"] = False
            info["stale"] = False

    def _age_key(short_name):
        m = _AGE_RE.search(short_name or "")
        return int(m.group(1)) if m else 0

    result = list(seen.values())
    result.sort(key=lambda x: (-_age_key(x["short_name"]), x["short_name"]))
    total = len(result)
    n_captured = sum(1 for r in result if r["captured"] and not r["stale"])
    n_stale    = sum(1 for r in result if r["stale"])

    return {
        "total":    total,
        "captured": n_captured,
        "imported": 0,
        "missing":  total - n_captured - n_stale,
        "stale":    n_stale,
        "poules":   result,
    }



# ── Generieke poule-queue ────────────────────────────────
_AGE_RE_GENERIC = re.compile(r"[JMjm][OZoz](\d+)-")


def _age_in_range(short_name: str, age_min: int, age_max: int) -> bool:
    m = _AGE_RE_GENERIC.search(short_name or "")
    if not m:
        return False
    age = int(m.group(1))
    return age_min <= age <= age_max


@router.get("/poule-queue")
def get_poule_queue(
    category:   Optional[str] = "Junioren",
    hockey_type: Optional[str] = None,
    age_min:    Optional[int] = 11,
    age_max:    Optional[int] = 18,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Unieke poule_ids voor teams met recent_poule_id, met capture-status.
    Standaard: Junioren O11-O18 (zelfde als youth-queue)."""
    q = (select(HockeyTeam)
         .where(col(HockeyTeam.recent_poule_id).is_not(None))
         .where(col(HockeyTeam.name).not_like("z%")))
    if category and category != "all":
        q = q.where(HockeyTeam.category_group_name == category)
    if hockey_type:
        q = q.where(HockeyTeam.hockey_type == hockey_type)
    q = q.order_by(col(HockeyTeam.short_name))
    teams = session.exec(q).all()

    seen: Dict[int, dict] = {}
    for t in teams:
        if not t.recent_poule_id:
            continue
        if age_min is not None and age_max is not None:
            if not _age_in_range(t.short_name, age_min, age_max):
                continue
        pid = t.recent_poule_id
        if pid not in seen:
            seen[pid] = {
                "poule_id":        pid,
                "team_id":         t.team_id,
                "team_name":       t.name,
                "short_name":      t.short_name,
                "club_external_id": t.club_external_id,
                "hockey_type":     t.hockey_type,
                "captured":        False,
                "imported":        False,
            }

    if not seen:
        return {"total": 0, "captured": 0, "missing": 0, "stale": 0, "poules": []}

    target_season = "2026-2027"
    captured_poules = session.exec(
        select(HockeyPoule).where(col(HockeyPoule.poule_id).in_(list(seen.keys())))
    ).all()
    captured_map2: Dict[int, str] = {p.poule_id: p.season for p in captured_poules}

    for pid, info in seen.items():
        if pid in captured_map2:
            info["captured"] = True
            info["stale"] = captured_map2[pid] != target_season
        else:
            info["captured"] = False
            info["stale"] = False

    result = sorted(seen.values(), key=lambda x: x["short_name"])
    n_captured = sum(1 for r in result if r["captured"] and not r["stale"])
    n_stale    = sum(1 for r in result if r["stale"])
    return {
        "total":    len(result),
        "captured": n_captured,
        "missing":  len(result) - n_captured - n_stale,
        "stale":    n_stale,
        "poules":   result,
    }


# ── Poule capture: structureer competitie + poule ────────
class PouleCaptureIn(BaseModel):
    poule_id:         int
    poule_name:       str
    competition_name: str
    class_name:       str
    hockey_type:      str = ""
    season:           str = "2026-2027"
    session_id:       Optional[str] = None


@router.post("/poule-capture")
def upsert_poule_capture(
    body: PouleCaptureIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Competition upsert
    ext_id = body.competition_name + "|" + body.season
    comp = session.exec(
        select(HockeyCompetition).where(HockeyCompetition.external_id == ext_id)
    ).first()
    if comp:
        comp.class_name  = body.class_name
        comp.updated_at  = now
        if body.hockey_type:
            comp.hockey_type = body.hockey_type
        session.add(comp)
    else:
        comp = HockeyCompetition(
            external_id  = ext_id,
            name         = body.competition_name,
            class_name   = body.class_name,
            hockey_type  = body.hockey_type,
            season       = body.season,
            discovered_at = now,
            updated_at   = now,
        )
        session.add(comp)
    session.flush()

    # Poule upsert
    poule = session.exec(
        select(HockeyPoule).where(HockeyPoule.poule_id == body.poule_id)
    ).first()
    status = "updated" if poule else "created"
    if poule:
        poule.name           = body.poule_name
        poule.competition_id = comp.id
        poule.updated_at     = now
        session.add(poule)
    else:
        poule = HockeyPoule(
            poule_id       = body.poule_id,
            name           = body.poule_name,
            competition_id = comp.id,
            season         = body.season,
            discovered_at  = now,
            updated_at     = now,
        )
        session.add(poule)

    # DataCapture per sessie (idempotent)
    if body.session_id:
        ext_cap = "poule_capture_" + str(body.poule_id)
        already = session.exec(
            select(DataCapture)
            .where(DataCapture.session_id == body.session_id)
            .where(DataCapture.external_id == ext_cap)
        ).first()
        if not already:
            session.add(DataCapture(
                id=new_uuid(),
                source="hockey-vanger",
                capture_type="poule_capture",
                external_id=ext_cap,
                session_id=body.session_id,
                payload=json.dumps(body.model_dump(exclude={"session_id"}), ensure_ascii=False),
                meta=json.dumps({
                    "poule_id":    body.poule_id,
                    "poule_name":  body.poule_name,
                    "competition": body.competition_name,
                    "season":      body.season,
                }, ensure_ascii=False),
                captured_at=now,
            ))

    session.commit()
    return {
        "poule_id":        body.poule_id,
        "competition_name": body.competition_name,
        "competition_id":  comp.id,
        "status":          status,
    }


# ── Poule reset (bijsturen queue) ────────────────────────
@router.delete("/poules/{poule_id}")
def delete_poule_capture(
    poule_id: int,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Verwijdert de HockeyPoule capture, zodat het team als 'missing' terug in de queue komt."""
    row = session.exec(select(HockeyPoule).where(HockeyPoule.poule_id == poule_id)).first()
    if not row:
        return {"deleted": False}
    session.delete(row)
    session.commit()
    return {"deleted": True}


# ── Competitions query ───────────────────────────────────
@router.get("/competitions")
def list_competitions(
    season: Optional[str] = "2026-2027",
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    q = select(HockeyCompetition).order_by(col(HockeyCompetition.name))
    if season and season != "all":
        q = q.where(HockeyCompetition.season == season)
    comps = session.exec(q).all()
    poules_all = session.exec(select(HockeyPoule)).all()
    poule_counts: Dict[int, int] = {}
    for p in poules_all:
        poule_counts[p.competition_id] = poule_counts.get(p.competition_id, 0) + 1

    return {
        "total": len(comps),
        "competitions": [
            {
                "id":           c.id,
                "name":         c.name,
                "class_name":   c.class_name,
                "district":     c.district,
                "hockey_type":  c.hockey_type,
                "season":       c.season,
                "poule_count":  poule_counts.get(c.id, 0),
                "updated_at":   c.updated_at.isoformat(),
            }
            for c in comps
        ],
    }


# ── Plugin errors ────────────────────────────────────────
class PluginErrorIn(BaseModel):
    message:    str
    context:    Optional[str] = None   # e.g. "club-detail push", "poule-capture"
    url:        Optional[str] = None
    session_id: Optional[str] = None


@router.post("/plugin-error")
def log_plugin_error(
    body: PluginErrorIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    session.add(DataCapture(
        id=new_uuid(),
        source="hockey-vanger",
        capture_type="plugin_error",
        external_id="plugin_error",
        session_id=body.session_id,
        payload=body.message,
        meta=json.dumps({
            "context": body.context,
            "url":     body.url,
        }, ensure_ascii=False),
        captured_at=now,
    ))
    session.commit()
    return {"ok": True}


@router.get("/plugin-errors")
def get_plugin_errors(
    limit: int = 50,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    rows = session.exec(
        select(DataCapture)
        .where(DataCapture.source == "hockey-vanger")
        .where(DataCapture.capture_type == "plugin_error")
        .order_by(col(DataCapture.captured_at).desc())
        .limit(limit)
    ).all()
    return {
        "total": len(rows),
        "errors": [
            {
                "id":         r.id,
                "message":    r.payload,
                "meta":       json.loads(r.meta or "{}"),
                "session_id": r.session_id,
                "captured_at": r.captured_at.isoformat(),
            }
            for r in rows
        ],
    }


@router.delete("/plugin-errors")
def clear_plugin_errors(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    rows = session.exec(
        select(DataCapture)
        .where(DataCapture.source == "hockey-vanger")
        .where(DataCapture.capture_type == "plugin_error")
    ).all()
    count = len(rows)
    for r in rows:
        session.delete(r)
    session.commit()
    return {"deleted": count}


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
