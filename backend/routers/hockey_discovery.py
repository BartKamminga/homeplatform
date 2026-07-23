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
from models.hockey_discovery import HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyPouleStanding, HockeyTeam, VangerCmd
from models.settings import AppSetting

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

    if body.name: club.name = body.name
    if body.friendly_name: club.friendly_name = body.friendly_name
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
            if team_in.name: existing_team.name = team_in.name
            if team_in.short_name: existing_team.short_name = team_in.short_name
            existing_team.logo_url = team_in.logo
            existing_team.hockey_type = team_in.hockey_type
            existing_team.category_group_name = team_in.category_group_name
            if team_in.recent_poule_id != existing_team.recent_poule_id:
                existing_team.recent_poule_id = team_in.recent_poule_id
                existing_team.no_new_poule_confirmed = False
                existing_team.season_pending = False
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


# ── Queue helpers ────────────────────────────────────────
_AGE_RE         = re.compile(r"[JM][OZ](1[1-8])-")
_AGE_RE_GENERIC = re.compile(r"[JMjm][OZoz](\d+)-")


def _is_target_age(short_name: str) -> bool:
    return bool(_AGE_RE.search(short_name or ""))


def _age_group_of(short_name: str) -> str:
    m = _AGE_RE_GENERIC.search(short_name or "")
    return "O" + m.group(1) if m else "?"


DISC_FILTER_AGE    = "disc_queue_age_groups"
DISC_FILTER_CLUB   = "disc_queue_club"
DISC_FILTER_CAT    = "disc_queue_category"
DISC_FILTER_HT     = "disc_queue_hockey_type"
DISC_FILTER_GENDER = "disc_queue_gender"
DISC_TARGET_SEASON = "disc_target_season"

_GENDER_PREFIX = {"Jongens": "J", "Meisjes": "M", "Heren": "H", "Dames": "D"}


def _get_queue_filter(session: Session):
    age_row    = session.get(AppSetting, DISC_FILTER_AGE)
    club_row   = session.get(AppSetting, DISC_FILTER_CLUB)
    cat_row    = session.get(AppSetting, DISC_FILTER_CAT)
    ht_row     = session.get(AppSetting, DISC_FILTER_HT)
    gender_row = session.get(AppSetting, DISC_FILTER_GENDER)
    ages    = [a for a in (age_row.value    if age_row    else "").split(",") if a]
    club    = (club_row.value or None)       if club_row   else None
    cats    = [c for c in (cat_row.value    if cat_row    else "Junioren").split(",") if c]
    hts     = [h for h in (ht_row.value     if ht_row     else "VE"      ).split(",") if h]
    genders = [g for g in (gender_row.value if gender_row else ""         ).split(",") if g]
    return ages, club, cats, hts, genders


def _apply_gender_filter(q, genders):
    """Filter op geslacht via LIKE-prefix op short_name (J/M/H/D)."""
    if not genders:
        return q
    conds = [col(HockeyTeam.short_name).like(f"{_GENDER_PREFIX[g]}%")
             for g in genders if g in _GENDER_PREFIX]
    if not conds:
        return q
    combined = conds[0]
    for c in conds[1:]:
        combined = combined | c
    return q.where(combined)


def _get_target_season(session: Session) -> str:
    row = session.get(AppSetting, DISC_TARGET_SEASON)
    return row.value if row and row.value else "2026-2027"


class QueueFilterBody(BaseModel):
    age_groups: List[str] = []
    club_external_id: Optional[str] = None
    categories: List[str] = []
    hockey_types: List[str] = []
    genders: List[str] = []


@router.get("/queue-filter")
def get_queue_filter(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    ages, club, cats, hts, genders = _get_queue_filter(session)
    return {"age_groups": ages, "club_external_id": club, "categories": cats, "hockey_types": hts, "genders": genders}


@router.patch("/queue-filter")
def update_queue_filter(
    body: QueueFilterBody,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for key, val in [
        (DISC_FILTER_AGE,    ",".join(body.age_groups)),
        (DISC_FILTER_CLUB,   body.club_external_id or ""),
        (DISC_FILTER_CAT,    ",".join(body.categories)   if body.categories   else "Junioren"),
        (DISC_FILTER_HT,     ",".join(body.hockey_types) if body.hockey_types else "VE"),
        (DISC_FILTER_GENDER, ",".join(body.genders)),
    ]:
        row = session.get(AppSetting, key)
        if row:
            row.value = val
            row.updated_at = now
            session.add(row)
        else:
            session.add(AppSetting(key=key, value=val, updated_at=now))
    session.commit()
    ages, club, cats, hts, genders = _get_queue_filter(session)
    return {"age_groups": ages, "club_external_id": club, "categories": cats, "hockey_types": hts, "genders": genders}


@router.get("/youth-queue")
def get_youth_queue(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Alias for /poule-queue — kept for backward compatibility."""
    return get_poule_queue(session=session, _=_)


@router.get("/youth-queue/next")
def get_youth_queue_next(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Alias for /poule-queue/next — kept for backward compatibility."""
    return get_poule_queue_next(session=session, _=_)


# ── Generieke poule-queue ────────────────────────────────

def _age_in_range(short_name: str, age_min: int, age_max: int) -> bool:
    m = _AGE_RE_GENERIC.search(short_name or "")
    if not m:
        return False
    age = int(m.group(1))
    return age_min <= age <= age_max


@router.get("/poule-queue")
def get_poule_queue(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Generieke poule-queue — filter volledig vanuit AppSettings."""
    target_season = _get_target_season(session)
    ages, club, cats, hts, genders = _get_queue_filter(session)

    def _age_key(short_name):
        m = _AGE_RE_GENERIC.search(short_name or "")
        return int(m.group(1)) if m else 0

    q = select(HockeyTeam).where(col(HockeyTeam.recent_poule_id).is_not(None))
    if cats:
        q = q.where(col(HockeyTeam.category_group_name).in_(cats))
    if hts:
        q = q.where(col(HockeyTeam.hockey_type).in_(hts))
    q = _apply_gender_filter(q, genders)
    q = q.order_by(col(HockeyTeam.short_name))
    teams_with = session.exec(q).all()

    by_poule: Dict[int, list] = {}
    for t in teams_with:
        if not t.recent_poule_id:
            continue
        pid = t.recent_poule_id
        if pid not in by_poule:
            by_poule[pid] = []
        by_poule[pid].append(t)

    seen: Dict[int, dict] = {}
    for pid, team_list in by_poule.items():
        rep = team_list[0]
        clubs_ordered: list = []
        clubs_set: set = set()
        for t in team_list:
            if t.club_external_id not in clubs_set:
                clubs_ordered.append(t.club_external_id)
                clubs_set.add(t.club_external_id)
        seen[pid] = {
            "poule_id":         pid,
            "team_id":          rep.team_id,
            "team_name":        rep.name,
            "short_name":       rep.short_name,
            "club_external_id": rep.club_external_id,
            "hockey_type":      rep.hockey_type,
            "has_poule":        True,
            "captured":         False,
            "stale":            False,
            "clubs_in_poule":   clubs_ordered,
        }

    if seen:
        captured_poules = session.exec(
            select(HockeyPoule).where(col(HockeyPoule.poule_id).in_(list(seen.keys())))
        ).all()
        captured_map: Dict[int, str] = {p.poule_id: p.season for p in captured_poules}
        for pid, info in seen.items():
            if pid in captured_map:
                info["captured"] = True
                info["stale"]    = captured_map[pid] != target_season
            else:
                info["captured"] = False
                info["stale"]    = False

    result = list(seen.values())
    result.sort(key=lambda x: (-_age_key(x["short_name"]), x["short_name"]))
    total      = len(result)
    n_captured = sum(1 for r in result if r["captured"] and not r["stale"])
    n_stale    = sum(1 for r in result if r["stale"])

    q2 = select(HockeyTeam).where(col(HockeyTeam.recent_poule_id).is_(None))
    if cats:
        q2 = q2.where(col(HockeyTeam.category_group_name).in_(cats))
    if hts:
        q2 = q2.where(col(HockeyTeam.hockey_type).in_(hts))
    q2 = _apply_gender_filter(q2, genders)
    q2 = q2.order_by(col(HockeyTeam.short_name))
    teams_waiting = session.exec(q2).all()

    waiting = [
        {
            "poule_id":         None,
            "team_id":          t.team_id,
            "team_name":        t.name,
            "short_name":       t.short_name,
            "club_external_id": t.club_external_id,
            "hockey_type":      t.hockey_type,
            "has_poule":        False,
            "captured":         False,
            "stale":            False,
        }
        for t in teams_waiting
    ]

    filter_active = bool(ages or club)
    if filter_active:
        filtered = [r for r in result if
            (not ages or _age_group_of(r["short_name"]) in ages) and
            (not club or r["club_external_id"] == club
             or club in r.get("clubs_in_poule", []))
        ]
        f_cap   = sum(1 for r in filtered if r["captured"] and not r["stale"])
        f_stale = sum(1 for r in filtered if r["stale"])
    else:
        filtered = result
        f_cap    = n_captured
        f_stale  = n_stale

    return {
        "total":             total,
        "captured":          n_captured,
        "missing":           total - n_captured - n_stale,
        "stale":             n_stale,
        "waiting":           len(waiting),
        "target_season":     target_season,
        "poules":            result + waiting,
        "filter_active":     filter_active,
        "filtered_poules":   filtered if filter_active else [],
        "filtered_total":    len(filtered),
        "filtered_captured": f_cap,
        "filtered_missing":  len(filtered) - f_cap - f_stale,
        "filtered_stale":    f_stale,
    }


@router.get("/poule-queue/next")
def get_poule_queue_next(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Volgende niet-gecaptured poule item (hoog leeftijdsgetal eerst). Live — altijd actueel."""
    target_season = _get_target_season(session)
    ages, club, cats, hts, genders = _get_queue_filter(session)

    captured_ids = {p.poule_id for p in session.exec(
        select(HockeyPoule).where(HockeyPoule.season == target_season)
    ).all()}

    q = select(HockeyTeam).where(col(HockeyTeam.recent_poule_id).is_not(None))
    if cats:
        q = q.where(col(HockeyTeam.category_group_name).in_(cats))
    if hts:
        q = q.where(col(HockeyTeam.hockey_type).in_(hts))
    q = _apply_gender_filter(q, genders)
    q = q.order_by(col(HockeyTeam.short_name))
    teams = session.exec(q).all()

    skip_ids = {
        t.recent_poule_id
        for t in teams
        if t.recent_poule_id and (t.no_new_poule_confirmed or t.season_pending)
    }

    seen: set = set()
    candidates = []
    for t in teams:
        if not t.recent_poule_id:
            continue
        pid = t.recent_poule_id
        if pid in captured_ids or pid in seen or pid in skip_ids:
            continue
        seen.add(pid)
        candidates.append({
            "poule_id":         pid,
            "team_id":          t.team_id,
            "team_name":        t.name,
            "short_name":       t.short_name,
            "club_external_id": t.club_external_id,
            "hockey_type":      t.hockey_type,
        })

    if ages:
        candidates = [c for c in candidates if _age_group_of(c["short_name"]) in ages]
    if club:
        club_poule_ids = {
            t.recent_poule_id for t in teams
            if t.club_external_id == club and t.recent_poule_id
        }
        candidates = [c for c in candidates if c["poule_id"] in club_poule_ids]

    if not candidates:
        return {"done": True}

    def _age_key(item):
        m = _AGE_RE_GENERIC.search(item["short_name"] or "")
        return int(m.group(1)) if m else 0

    candidates.sort(key=lambda x: -_age_key(x))
    return {"done": False, **candidates[0]}


# ── Club-scan queue ──────────────────────────────────────
@router.get("/club-scan-queue")
def get_club_scan_queue(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Clubs waarvan teams no_new_poule_confirmed of season_pending hebben — kandidaten voor herscanning."""
    _, _, cats, hts, genders = _get_queue_filter(session)
    q = select(HockeyTeam).where(
        (HockeyTeam.no_new_poule_confirmed == True) | (HockeyTeam.season_pending == True)
    )
    if cats:
        q = q.where(col(HockeyTeam.category_group_name).in_(cats))
    if hts:
        q = q.where(col(HockeyTeam.hockey_type).in_(hts))
    q = _apply_gender_filter(q, genders)
    teams = session.exec(q).all()

    counts: Dict[str, int] = {}
    for t in teams:
        counts[t.club_external_id] = counts.get(t.club_external_id, 0) + 1

    if not counts:
        return {"total": 0, "clubs": []}

    clubs = session.exec(
        select(HockeyClub).where(col(HockeyClub.external_id).in_(list(counts.keys())))
    ).all()

    result = [
        {
            "club_external_id": c.external_id,
            "name":             c.name,
            "friendly_name":    c.friendly_name,
            "city":             c.city,
            "pending_teams":    counts[c.external_id],
        }
        for c in clubs
    ]
    result.sort(key=lambda x: (-x["pending_teams"], x["friendly_name"] or x["name"]))
    return {"total": len(result), "clubs": result}


@router.get("/club-scan-queue/next")
def get_club_scan_queue_next(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Volgende club om te scannen (meeste pending teams eerst)."""
    _, _, cats, hts, genders = _get_queue_filter(session)
    q = select(HockeyTeam).where(
        (HockeyTeam.no_new_poule_confirmed == True) | (HockeyTeam.season_pending == True)
    )
    if cats:
        q = q.where(col(HockeyTeam.category_group_name).in_(cats))
    if hts:
        q = q.where(col(HockeyTeam.hockey_type).in_(hts))
    q = _apply_gender_filter(q, genders)
    teams = session.exec(q).all()

    if not teams:
        return {"done": True}

    counts: Dict[str, int] = {}
    for t in teams:
        counts[t.club_external_id] = counts.get(t.club_external_id, 0) + 1

    best_id = max(counts, key=lambda k: counts[k])
    club = session.exec(select(HockeyClub).where(HockeyClub.external_id == best_id)).first()
    if not club:
        return {"done": True}

    return {
        "done":             False,
        "club_external_id": club.external_id,
        "name":             club.name,
        "friendly_name":    club.friendly_name,
        "city":             club.city,
        "pending_teams":    counts[best_id],
    }


# ── Poule capture: structureer competitie + poule ────────
_CAT_JUNIOR_RE = re.compile(r"^[zZ]?[JjMm][OoZz]\d")

def _derive_category(name: str) -> str:
    """Leidt category_group_name af uit teamnaam (J/M prefix = Junioren, H/D = Senioren)."""
    n = name.lstrip("z").lstrip("Z")
    if _CAT_JUNIOR_RE.match(name):
        return "Junioren"
    if n and n[0] in ("H", "h", "D", "d"):
        return "Senioren"
    return ""


class TeamInPoule(BaseModel):
    id:                      int
    name:                    str
    short_name:              str = ""
    logo:                    Optional[str] = None
    federation_reference_id: Optional[str] = None


class StandingIn(BaseModel):
    team_id:       int
    team_name:     str = ""
    position:      Optional[int] = None
    played:        int = 0
    won:           int = 0
    drawn:         int = 0
    lost:          int = 0
    goals_for:     int = 0
    goals_against: int = 0
    points:        int = 0


class MatchIn(BaseModel):
    match_id:       Optional[int] = None
    home_team_id:   Optional[int] = None
    home_team_name: str = ""
    away_team_id:   Optional[int] = None
    away_team_name: str = ""
    match_date:     Optional[str] = None
    status:         str = ""
    home_score:     Optional[int] = None
    away_score:     Optional[int] = None
    round:          Optional[int] = None


class PouleCaptureIn(BaseModel):
    poule_id:         int
    poule_name:       str
    competition_name: str
    class_name:       str
    hockey_type:      str = ""
    season:           str = "2026-2027"
    session_id:       Optional[str] = None
    teams_in_poule:   List[TeamInPoule] = []
    standings_data:   List[StandingIn]  = []
    matches_data:     List[MatchIn]     = []


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

    # ── Standings opslaan (381) ─────────────────────────────
    if body.standings_data:
        for old in session.exec(
            select(HockeyPouleStanding).where(HockeyPouleStanding.poule_id == body.poule_id)
        ).all():
            session.delete(old)
        for sd in body.standings_data:
            session.add(HockeyPouleStanding(
                poule_id=body.poule_id, team_id=sd.team_id, team_name=sd.team_name,
                position=sd.position, played=sd.played, won=sd.won, drawn=sd.drawn,
                lost=sd.lost, goals_for=sd.goals_for, goals_against=sd.goals_against,
                points=sd.points, updated_at=now,
            ))

    # ── Wedstrijden opslaan (381) ────────────────────────────
    if body.matches_data:
        for old in session.exec(
            select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == body.poule_id)
        ).all():
            session.delete(old)
        for md in body.matches_data:
            session.add(HockeyPouleMatch(
                poule_id=body.poule_id, match_id=md.match_id,
                home_team_id=md.home_team_id, home_team_name=md.home_team_name,
                away_team_id=md.away_team_id, away_team_name=md.away_team_name,
                match_date=md.match_date, status=md.status,
                home_score=md.home_score, away_score=md.away_score,
                round=md.round, updated_at=now,
            ))

    # ── Teams uit standings verwerken (378 + 379) ──────────
    target_season = _get_target_season(session)
    is_target     = body.season == target_season
    teams_updated = 0
    teams_created = 0

    for t_in in body.teams_in_poule:
        existing = session.exec(
            select(HockeyTeam).where(HockeyTeam.team_id == t_in.id)
        ).first()
        if existing:
            if is_target and existing.recent_poule_id != body.poule_id:
                existing.recent_poule_id        = body.poule_id
                existing.season_pending         = False
                existing.no_new_poule_confirmed = False
                existing.updated_at             = now
                session.add(existing)
                teams_updated += 1
        else:
            hockey_type = body.hockey_type or "VE"
            if not hockey_type and t_in.name.startswith(("z", "Z")):
                hockey_type = "ZA"
            session.add(HockeyTeam(
                team_id              = t_in.id,
                club_external_id     = t_in.federation_reference_id or "",
                name                 = t_in.name,
                short_name           = t_in.short_name or t_in.name,
                logo_url             = t_in.logo,
                hockey_type          = hockey_type,
                category_group_name  = _derive_category(t_in.name),
                recent_poule_id      = body.poule_id,
                season_pending       = not is_target,
                discovered_at        = now,
                updated_at           = now,
            ))
            teams_created += 1

    if not is_target:
        stale_teams = session.exec(
            select(HockeyTeam).where(HockeyTeam.recent_poule_id == body.poule_id)
        ).all()
        for t in stale_teams:
            t.season_pending = True
            session.add(t)

    session.commit()
    return {
        "poule_id":          body.poule_id,
        "competition_name":  body.competition_name,
        "competition_id":    comp.id,
        "status":            status,
        "teams_updated":     teams_updated,
        "teams_created":     teams_created,
        "standings_saved":   len(body.standings_data),
        "matches_saved":     len(body.matches_data),
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


# ── Poule skip (geen data gevonden door interceptor) ─────
@router.post("/poule-skip")
def skip_poule(
    poule_id: int,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Markeert alle teams met recent_poule_id == poule_id als no_new_poule_confirmed."""
    teams = session.exec(
        select(HockeyTeam).where(HockeyTeam.recent_poule_id == poule_id)
    ).all()
    for t in teams:
        t.no_new_poule_confirmed = True
        t.updated_at = datetime.utcnow()
        session.add(t)
    session.commit()
    return {"poule_id": poule_id, "marked": len(teams)}


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
                "hl_comp_id":   c.hl_comp_id,
                "poule_count":  poule_counts.get(c.id, 0),
                "updated_at":   c.updated_at.isoformat(),
            }
            for c in comps
        ],
    }


# ── Poules query ─────────────────────────────────────────
@router.get("/poules")
def list_poules(
    season: Optional[str] = "2026-2027",
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    q = select(HockeyPoule).order_by(col(HockeyPoule.name))
    if season and season != "all":
        q = q.where(HockeyPoule.season == season)
    poules = session.exec(q).all()
    return {
        "total": len(poules),
        "poules": [
            {
                "poule_id":      p.poule_id,
                "name":          p.name,
                "competition_id": p.competition_id,
                "season":        p.season,
            }
            for p in poules
        ],
    }


# ── Poule ID-reeksen per seizoen ─────────────────────────
@router.get("/poule-ranges")
def get_poule_ranges(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Berekent min/max poule-ID per seizoen uit gecaptured HockeyPoules."""
    poules = session.exec(select(HockeyPoule)).all()
    ranges: Dict[str, dict] = {}
    for p in poules:
        if p.season not in ranges:
            ranges[p.season] = {"min_id": p.poule_id, "max_id": p.poule_id, "count": 0}
        ranges[p.season]["min_id"] = min(ranges[p.season]["min_id"], p.poule_id)
        ranges[p.season]["max_id"] = max(ranges[p.season]["max_id"], p.poule_id)
        ranges[p.season]["count"] += 1

    seasons = sorted(ranges.items())
    result = []
    for i, (season, r) in enumerate(seasons):
        gap_before = None
        if i > 0:
            prev_max = seasons[i - 1][1]["max_id"]
            gap_before = r["min_id"] - prev_max - 1
        result.append({
            "season":     season,
            "min_id":     r["min_id"],
            "max_id":     r["max_id"],
            "count":      r["count"],
            "span":       r["max_id"] - r["min_id"],
            "gap_before": gap_before,
        })

    return {"seasons": result}


# ── Seizoeninferentie op basis van ID-reeks ──────────────
@router.post("/infer-season-pending")
def infer_season_pending(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Markeert teams als season_pending als hun recent_poule_id in een oud seizoen valt."""
    target_season = _get_target_season(session)

    poules = session.exec(select(HockeyPoule)).all()
    season_ranges: Dict[str, dict] = {}
    for p in poules:
        if p.season not in season_ranges:
            season_ranges[p.season] = {"min_id": p.poule_id, "max_id": p.poule_id}
        season_ranges[p.season]["min_id"] = min(season_ranges[p.season]["min_id"], p.poule_id)
        season_ranges[p.season]["max_id"] = max(season_ranges[p.season]["max_id"], p.poule_id)

    if not season_ranges:
        return {"marked_pending": 0, "cleared_pending": 0, "target_season": target_season}

    global_max = max(r["max_id"] for r in season_ranges.values())

    def _infer(poule_id: int) -> str:
        for season, r in season_ranges.items():
            if r["min_id"] <= poule_id <= r["max_id"]:
                return season
        # Boven alle bekende maxima → waarschijnlijk target season
        if poule_id > global_max:
            return target_season
        # In een gat tussen seizoenen → conservatief: target season
        return target_season

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    teams = session.exec(
        select(HockeyTeam).where(col(HockeyTeam.recent_poule_id).is_not(None))
    ).all()

    marked_pending = 0
    cleared_pending = 0

    for t in teams:
        if t.no_new_poule_confirmed:
            continue
        inferred = _infer(t.recent_poule_id)
        if inferred != target_season and not t.season_pending:
            t.season_pending = True
            t.updated_at = now
            session.add(t)
            marked_pending += 1
        elif inferred == target_season and t.season_pending:
            t.season_pending = False
            t.updated_at = now
            session.add(t)
            cleared_pending += 1

    session.commit()
    return {
        "marked_pending":  marked_pending,
        "cleared_pending": cleared_pending,
        "target_season":   target_season,
        "season_ranges":   [
            {"season": s, **r} for s, r in sorted(season_ranges.items())
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


# ── Vanger heartbeat / live status ───────────────────────
VANGER_STATUS_KEY = "vanger_status"


class VangerHeartbeatIn(BaseModel):
    running: bool
    mode: Optional[str] = None   # poule_scan | club_rescan | idle
    task: Optional[str] = None   # huidige item label
    done_count: int = 0
    queue_total: int = 0


@router.post("/vanger/heartbeat")
def vanger_heartbeat(
    body: VangerHeartbeatIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    payload = json.dumps({
        "running":     body.running,
        "mode":        body.mode,
        "task":        body.task,
        "done_count":  body.done_count,
        "queue_total": body.queue_total,
        "last_seen":   now.isoformat(),
    }, ensure_ascii=False)
    row = session.get(AppSetting, VANGER_STATUS_KEY)
    if row:
        row.value = payload
        session.add(row)
    else:
        session.add(AppSetting(key=VANGER_STATUS_KEY, value=payload))
    session.commit()
    return {"ok": True}


@router.get("/vanger/status")
def get_vanger_status(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    row = session.get(AppSetting, VANGER_STATUS_KEY)
    if not row or not row.value:
        return {"running": False, "mode": None, "task": None, "done_count": 0, "queue_total": 0, "last_seen": None}
    return json.loads(row.value)


# ── Vanger cmd-queue ──────────────────────────────────────

def _parse_raw_poule(raw: dict, params: dict) -> Optional["PouleCaptureIn"]:
    """Zet een __hw_poules localStorage-entry om naar PouleCaptureIn."""
    try:
        poule_data = raw["data"]["data"]["poule"]
        comp       = poule_data.get("competition") or {}
        subcomp    = comp.get("subcompetition") or {}

        teams_list: List[TeamInPoule] = []
        standings_list: List[StandingIn] = []
        matches_list: List[MatchIn] = []

        for s in poule_data.get("standings") or []:
            st = s.get("team") or {}
            if not st.get("id"):
                continue
            teams_list.append(TeamInPoule(
                id=st["id"],
                name=st.get("name", ""),
                short_name=st.get("short_name") or st.get("name", ""),
                logo=st.get("logo"),
                federation_reference_id=st.get("federation_reference_id"),
            ))
            standings_list.append(StandingIn(
                team_id=st["id"],
                team_name=st.get("name", ""),
                position=s.get("position") or s.get("rank"),
                played=s.get("played") or s.get("games_played") or 0,
                won=s.get("won") or s.get("wins") or 0,
                drawn=s.get("draw") or s.get("drawn") or s.get("draws") or 0,
                lost=s.get("lost") or s.get("losses") or 0,
                goals_for=s.get("goals_for") or s.get("gf") or s.get("goals_scored") or 0,
                goals_against=s.get("goals_against") or s.get("ga") or s.get("goals_conceded") or 0,
                points=s.get("points") or s.get("pts") or 0,
            ))

        for m in poule_data.get("matches") or []:
            ht = m.get("home_team") or m.get("homeTeam") or {}
            at = m.get("away_team") or m.get("awayTeam") or {}
            sc = m.get("score") or {}
            home_score = m["home_score"] if m.get("home_score") is not None else sc.get("home")
            away_score = m["away_score"] if m.get("away_score") is not None else sc.get("away")
            matches_list.append(MatchIn(
                match_id=m.get("id"),
                home_team_id=ht.get("id"),
                home_team_name=ht.get("name", ""),
                away_team_id=at.get("id"),
                away_team_name=at.get("name", ""),
                match_date=m.get("date"),
                status=m.get("status", ""),
                home_score=home_score,
                away_score=away_score,
                round=m.get("round") or m.get("round_number"),
            ))

        hockey_type = raw.get("hockey_type", "")
        if not hockey_type:
            name = poule_data.get("name", "")
            hockey_type = "ZA" if name.lower().startswith("z") else "VE"

        return PouleCaptureIn(
            poule_id=params["poule_id"],
            poule_name=poule_data.get("name", ""),
            competition_name=comp.get("name", ""),
            class_name=subcomp.get("class") or comp.get("class_name", ""),
            hockey_type=hockey_type,
            season=raw.get("seizoen", "2026-2027"),
            teams_in_poule=teams_list,
            standings_data=standings_list,
            matches_data=matches_list,
        )
    except Exception:
        return None


def _parse_raw_club(raw: dict, params: dict) -> Optional["ClubDetailIn"]:
    """Zet een __hw_clubs localStorage-entry om naar ClubDetailIn."""
    try:
        teams: List[TeamIn] = []
        for t in raw.get("teams") or []:
            teams.append(TeamIn(
                id=t["id"],
                name=t.get("name", ""),
                short_name=t.get("short_name") or t.get("name", ""),
                logo=t.get("logo"),
                hockey_type=t.get("hockey_type", ""),
                category_group_name=t.get("category_group_name", ""),
                recent_poule_id=t.get("recent_poule_id"),
            ))
        return ClubDetailIn(
            federation_reference_id=raw.get("federation_reference_id") or params.get("external_id", ""),
            name=raw.get("name", ""),
            friendly_name=raw.get("friendly_name") or raw.get("name", ""),
            city=raw.get("city"),
            logo=raw.get("logo"),
            address=raw.get("address"),
            zipcode=raw.get("zipcode"),
            phone=raw.get("phone"),
            email=raw.get("email"),
            website=raw.get("website"),
            tenue=raw.get("tenue"),
            district=raw.get("district"),
            payment_options=raw.get("payment_options"),
            parking=raw.get("parking"),
            hockey_types=raw.get("hockey_types"),
            teams=teams,
        )
    except Exception:
        return None


class CmdResultIn(BaseModel):
    raw:        Optional[Any] = None
    error:      Optional[str] = None
    session_id: Optional[str] = None


class CmdFillIn(BaseModel):
    type: str  # "poules" | "clubs"


@router.get("/vanger/cmd-queue")
def get_cmd_queue(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    counts: Dict[str, int] = {}
    for status in ("pending", "in_progress", "done", "failed", "skipped"):
        counts[status] = len(session.exec(
            select(VangerCmd).where(VangerCmd.status == status)
        ).all())

    recent = session.exec(
        select(VangerCmd).order_by(col(VangerCmd.id).desc()).limit(200)
    ).all()

    return {
        "counts": counts,
        "recent": [
            {
                "id":             c.id,
                "cmd_type":       c.cmd_type,
                "params":         json.loads(c.params),
                "status":         c.status,
                "created_at":     c.created_at.isoformat() if c.created_at else None,
                "started_at":     c.started_at.isoformat() if c.started_at else None,
                "finished_at":    c.finished_at.isoformat() if c.finished_at else None,
                "error":          c.error,
                "result_summary": json.loads(c.result_summary) if c.result_summary else None,
            }
            for c in recent
        ],
    }


@router.post("/vanger/cmd-queue/fill")
def fill_cmd_queue(
    body: CmdFillIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # IDs al in de queue (pending of in_progress)
    pending_cmds = session.exec(
        select(VangerCmd).where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).all()
    pending_params = {json.loads(c.params).get("poule_id") or json.loads(c.params).get("external_id") for c in pending_cmds}

    added = 0

    if body.type == "poules":
        target_season = _get_target_season(session)
        ages, club, cats, hts, genders = _get_queue_filter(session)

        captured_ids = {p.poule_id for p in session.exec(
            select(HockeyPoule).where(HockeyPoule.season == target_season)
        ).all()}

        q = select(HockeyTeam).where(col(HockeyTeam.recent_poule_id).is_not(None))
        if cats:
            q = q.where(col(HockeyTeam.category_group_name).in_(cats))
        if hts:
            q = q.where(col(HockeyTeam.hockey_type).in_(hts))
        q = _apply_gender_filter(q, genders)
        q = q.order_by(col(HockeyTeam.short_name))
        teams = session.exec(q).all()

        skip_ids = {
            t.recent_poule_id for t in teams
            if t.recent_poule_id and (t.no_new_poule_confirmed or t.season_pending)
        }

        seen: set = set()
        candidates = []
        for t in teams:
            pid = t.recent_poule_id
            if not pid or pid in captured_ids or pid in seen or pid in skip_ids:
                continue
            seen.add(pid)
            candidates.append({
                "poule_id":   pid,
                "team_id":    t.team_id,
                "label":      t.name + " (#" + str(pid) + ")",
                "hockey_type": t.hockey_type,
            })

        if ages:
            candidates = [c for c in candidates if _age_group_of(c["label"]) in ages]
        if club:
            club_poule_ids = {t.recent_poule_id for t in teams if t.club_external_id == club and t.recent_poule_id}
            candidates = [c for c in candidates if c["poule_id"] in club_poule_ids]

        def _age_key(item):
            m = _AGE_RE_GENERIC.search(item["label"] or "")
            return int(m.group(1)) if m else 0

        candidates.sort(key=lambda x: -_age_key(x))

        for c in candidates:
            if c["poule_id"] not in pending_params:
                session.add(VangerCmd(
                    cmd_type=  "get_poule",
                    params=    json.dumps({"poule_id": c["poule_id"], "team_id": c["team_id"], "label": c["label"]}),
                    created_at=now,
                ))
                added += 1

    elif body.type == "clubs":
        _, _, cats, hts, genders = _get_queue_filter(session)
        q = select(HockeyTeam).where(
            (HockeyTeam.no_new_poule_confirmed == True) | (HockeyTeam.season_pending == True)
        )
        if cats:
            q = q.where(col(HockeyTeam.category_group_name).in_(cats))
        if hts:
            q = q.where(col(HockeyTeam.hockey_type).in_(hts))
        q = _apply_gender_filter(q, genders)
        teams = session.exec(q).all()

        counts_by_club: Dict[str, int] = {}
        for t in teams:
            counts_by_club[t.club_external_id] = counts_by_club.get(t.club_external_id, 0) + 1

        club_rows = session.exec(
            select(HockeyClub).where(col(HockeyClub.external_id).in_(list(counts_by_club.keys())))
        ).all()
        club_map = {c.external_id: c for c in club_rows}

        for ext_id, cnt in sorted(counts_by_club.items(), key=lambda x: -x[1]):
            if ext_id not in pending_params:
                c = club_map.get(ext_id)
                label = (c.friendly_name or c.name) if c else ext_id
                session.add(VangerCmd(
                    cmd_type=  "scan_club",
                    params=    json.dumps({"external_id": ext_id, "label": label, "pending_teams": cnt}),
                    created_at=now,
                ))
                added += 1

    session.commit()
    return {"added": added, "type": body.type}


class CmdAddIn(BaseModel):
    cmd_type: str           # "get_poule" | "scan_club"
    params:   Dict[str, Any]


@router.post("/vanger/cmd-queue/add")
def add_single_cmd(
    body: CmdAddIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    from fastapi import HTTPException
    valid = ("get_poule", "scan_club", "get_clubs", "get_competition_detail", "get_competitions")
    if body.cmd_type not in valid:
        raise HTTPException(status_code=400, detail="Ongeldig cmd_type")

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Single-instance cmds (max 1 pending tegelijk)
    if body.cmd_type in ("get_clubs", "get_competitions"):
        existing = session.exec(
            select(VangerCmd).where(
                VangerCmd.cmd_type == body.cmd_type,
                col(VangerCmd.status).in_(["pending", "in_progress"]),
            )
        ).first()
        if existing:
            return {"added": False, "reason": "already_queued"}
        default_label = "Alle clubs" if body.cmd_type == "get_clubs" else "Nationale competities"
        session.add(VangerCmd(
            cmd_type=body.cmd_type,
            params=json.dumps({"label": body.params.get("label", default_label)}),
            created_at=now,
        ))
        session.commit()
        return {"added": True}

    # Key-based dedup
    key_field = {"get_poule": "poule_id", "scan_club": "external_id", "get_competition_detail": "comp_id"}.get(body.cmd_type)
    target_id = body.params.get(key_field)

    pending = session.exec(
        select(VangerCmd).where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).all()
    for e in pending:
        ep = json.loads(e.params)
        if e.cmd_type == body.cmd_type and ep.get(key_field) == target_id:
            return {"added": False, "reason": "already_queued"}

    session.add(VangerCmd(cmd_type=body.cmd_type, params=json.dumps(body.params), created_at=now))
    session.commit()
    return {"added": True}


@router.get("/vanger/cmd-queue/next")
def get_cmd_queue_next(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    cmd = session.exec(
        select(VangerCmd).where(VangerCmd.status == "pending").order_by(col(VangerCmd.id).asc()).limit(1)
    ).first()
    if not cmd:
        return {"done": True}
    cmd.status = "in_progress"
    cmd.started_at = now
    session.add(cmd)
    session.commit()
    return {
        "done":     False,
        "id":       cmd.id,
        "cmd_type": cmd.cmd_type,
        "params":   json.loads(cmd.params),
    }


@router.post("/vanger/cmd-queue/{cmd_id}/result")
def post_cmd_result(
    cmd_id: int,
    body: CmdResultIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    from fastapi import HTTPException
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    cmd = session.get(VangerCmd, cmd_id)
    if not cmd:
        raise HTTPException(status_code=404, detail="Cmd niet gevonden")

    params = json.loads(cmd.params)

    # Geen data of expliciete fout
    if body.error or body.raw is None:
        cmd.status     = "failed" if body.error else "skipped"
        cmd.error      = body.error
        cmd.finished_at = now
        session.add(cmd)

        # Poule skip → mark teams als no_new_poule_confirmed
        if cmd.cmd_type == "get_poule" and not body.error:
            poule_id = params.get("poule_id")
            if poule_id:
                stale = session.exec(
                    select(HockeyTeam).where(HockeyTeam.recent_poule_id == poule_id)
                ).all()
                for t in stale:
                    t.no_new_poule_confirmed = True
                    session.add(t)

        session.commit()
        return {"ok": True, "status": cmd.status}

    # Verwerk op basis van cmd_type
    result_label = params.get("label", "")
    raw_bytes = len(json.dumps(body.raw).encode("utf-8")) if body.raw else 0
    duration_ms = round((now - cmd.started_at).total_seconds() * 1000) if cmd.started_at else None
    summary_data: Dict[str, Any] = {"raw_bytes": raw_bytes}
    if duration_ms is not None:
        summary_data["duration_ms"] = duration_ms

    session_key = body.session_id if body.session_id else "vanger_cmd_" + str(cmd_id)
    if cmd.cmd_type == "get_poule":
        archive_ext  = "poule_capture_" + str(params.get("poule_id", cmd_id))
        archive_type = "poule_capture"
    elif cmd.cmd_type == "scan_club":
        archive_ext  = "club_detail_" + str(params.get("external_id", cmd_id))
        archive_type = "club_detail"
    elif cmd.cmd_type == "get_clubs":
        archive_ext  = "clubs_list_" + str(cmd_id)
        archive_type = "clubs_list"
    elif cmd.cmd_type == "get_competition_detail":
        archive_ext  = "comp_detail_" + str(params.get("comp_id", cmd_id))
        archive_type = "comp_detail"
    else:
        archive_ext  = "comp_list_" + str(cmd_id)
        archive_type = "comp_list"
    already = session.exec(select(DataCapture).where(DataCapture.external_id == archive_ext).where(DataCapture.session_id == session_key)).first()
    if not already:
        session.add(DataCapture(
            id=new_uuid(),
            source="hockey-vanger",
            capture_type=archive_type,
            external_id=archive_ext,
            session_id=session_key,
            payload=json.dumps(body.raw, ensure_ascii=False),
            meta=json.dumps({"label": result_label, "cmd_id": cmd_id}, ensure_ascii=False),
            captured_at=now,
        ))

    try:
        if cmd.cmd_type == "get_poule":
            capture_body = _parse_raw_poule(body.raw, params)
            if capture_body:
                poule_sum = _call_poule_capture(capture_body, session)
                if poule_sum:
                    summary_data.update(poule_sum)
            else:
                summary_data["parse_failed"] = True
        elif cmd.cmd_type == "scan_club":
            detail_body = _parse_raw_club(body.raw, params)
            if detail_body:
                club_sum = _call_club_detail(detail_body, session)
                if club_sum:
                    summary_data.update(club_sum)
            else:
                summary_data["parse_failed"] = True
        elif cmd.cmd_type == "get_clubs":
            clubs_raw = body.raw if isinstance(body.raw, dict) else {}
            clubs_list = clubs_raw.get("clubs") or clubs_raw.get("data")
            if isinstance(clubs_list, list):
                clubs_sum = _call_clubs_list(clubs_list, session)
                if clubs_sum:
                    summary_data.update(clubs_sum)
            else:
                summary_data["parse_failed"] = True
        elif cmd.cmd_type == "get_competition_detail":
            comp_raw = body.raw if isinstance(body.raw, dict) else {}
            comp_sum = _call_competition_detail(comp_raw, session, params)
            if comp_sum:
                summary_data.update(comp_sum)
            else:
                summary_data["parse_failed"] = True
        elif cmd.cmd_type == "get_competitions":
            comps_raw = body.raw if isinstance(body.raw, dict) else {}
            comps_sum = _call_competitions_list(comps_raw, session)
            if comps_sum:
                summary_data.update(comps_sum)
            else:
                summary_data["parse_failed"] = True
    except Exception as e:
        cmd.status         = "failed"
        cmd.error          = str(e)
        cmd.finished_at    = now
        cmd.result_summary = json.dumps(summary_data)
        session.add(cmd)
        session.commit()
        return {"ok": False, "status": "failed", "error": str(e)}

    cmd.status         = "done"
    cmd.finished_at    = now
    cmd.result_summary = json.dumps(summary_data)
    session.add(cmd)
    session.commit()
    return {"ok": True, "status": "done", "label": result_label}


def _call_poule_capture(body: PouleCaptureIn, session: Session):
    """Direct de poule-capture logica aanroepen zonder HTTP-laag."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    ext_id = body.competition_name + "|" + body.season
    comp = session.exec(select(HockeyCompetition).where(HockeyCompetition.external_id == ext_id)).first()
    if comp:
        comp.class_name = body.class_name
        comp.updated_at = now
        if body.hockey_type:
            comp.hockey_type = body.hockey_type
        session.add(comp)
    else:
        comp = HockeyCompetition(
            external_id=ext_id, name=body.competition_name, class_name=body.class_name,
            hockey_type=body.hockey_type, season=body.season, discovered_at=now, updated_at=now,
        )
        session.add(comp)
    session.flush()

    poule = session.exec(select(HockeyPoule).where(HockeyPoule.poule_id == body.poule_id)).first()
    if poule:
        poule.name = body.poule_name; poule.competition_id = comp.id; poule.updated_at = now
        session.add(poule)
    else:
        session.add(HockeyPoule(
            poule_id=body.poule_id, name=body.poule_name, competition_id=comp.id,
            season=body.season, discovered_at=now, updated_at=now,
        ))

    if body.standings_data:
        for old in session.exec(select(HockeyPouleStanding).where(HockeyPouleStanding.poule_id == body.poule_id)).all():
            session.delete(old)
        for sd in body.standings_data:
            session.add(HockeyPouleStanding(
                poule_id=body.poule_id, team_id=sd.team_id, team_name=sd.team_name,
                position=sd.position, played=sd.played, won=sd.won, drawn=sd.drawn,
                lost=sd.lost, goals_for=sd.goals_for, goals_against=sd.goals_against,
                points=sd.points, updated_at=now,
            ))

    if body.matches_data:
        for old in session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == body.poule_id)).all():
            session.delete(old)
        for md in body.matches_data:
            session.add(HockeyPouleMatch(
                poule_id=body.poule_id, match_id=md.match_id,
                home_team_id=md.home_team_id, home_team_name=md.home_team_name,
                away_team_id=md.away_team_id, away_team_name=md.away_team_name,
                match_date=md.match_date, status=md.status,
                home_score=md.home_score, away_score=md.away_score,
                round=md.round, updated_at=now,
            ))

    target_season = _get_target_season(session)
    is_target = body.season == target_season
    for t_in in body.teams_in_poule:
        existing = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == t_in.id)).first()
        if existing:
            if is_target and existing.recent_poule_id != body.poule_id:
                existing.recent_poule_id = body.poule_id
                existing.season_pending = False
                existing.no_new_poule_confirmed = False
                existing.updated_at = now
                session.add(existing)
        else:
            ht = body.hockey_type or ("ZA" if t_in.name.startswith(("z", "Z")) else "VE")
            session.add(HockeyTeam(
                team_id=t_in.id, club_external_id=t_in.federation_reference_id or "",
                name=t_in.name, short_name=t_in.short_name or t_in.name,
                logo_url=t_in.logo, hockey_type=ht,
                category_group_name=_derive_category(t_in.name),
                recent_poule_id=body.poule_id, season_pending=not is_target,
                discovered_at=now, updated_at=now,
            ))

    if not is_target:
        for t in session.exec(select(HockeyTeam).where(HockeyTeam.recent_poule_id == body.poule_id)).all():
            t.season_pending = True
            session.add(t)

    matches_played = sum(1 for m in (body.matches_data or []) if m.home_score is not None)
    return {
        "teams":          len(body.teams_in_poule),
        "standings":      len(body.standings_data or []),
        "matches_total":  len(body.matches_data or []),
        "matches_played": matches_played,
        "competition":    body.competition_name,
        "season":         body.season,
    }


def _call_club_detail(body: "ClubDetailIn", session: Session):
    """Direct de club-detail logica aanroepen zonder HTTP-laag."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    existing = session.exec(select(HockeyClub).where(HockeyClub.external_id == body.federation_reference_id)).first()
    club = existing or HockeyClub(external_id=body.federation_reference_id, discovered_at=now)
    if body.name: club.name = body.name
    if body.friendly_name: club.friendly_name = body.friendly_name
    club.city = body.city
    club.logo_url = body.logo; club.address = body.address; club.zipcode = body.zipcode
    club.phone = body.phone; club.email = body.email; club.website = body.website
    club.tenue = body.tenue; club.district = body.district
    club.payment_options = json.dumps(body.payment_options, ensure_ascii=False) if isinstance(body.payment_options, list) else body.payment_options
    club.parking = body.parking
    club.hockey_types = json.dumps(body.hockey_types, ensure_ascii=False) if isinstance(body.hockey_types, list) else body.hockey_types
    club.detail_loaded = True; club.updated_at = now
    session.add(club)

    known_team_ids = {
        t.team_id for t in session.exec(
            select(HockeyTeam).where(HockeyTeam.club_external_id == body.federation_reference_id)
        ).all()
    }
    incoming_team_ids = {team_in.id for team_in in body.teams}

    teams_added = 0
    teams_new_poule = 0
    for team_in in body.teams:
        existing_team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == team_in.id)).first()
        if existing_team:
            if team_in.name: existing_team.name = team_in.name
            if team_in.short_name: existing_team.short_name = team_in.short_name
            existing_team.logo_url = team_in.logo; existing_team.hockey_type = team_in.hockey_type
            existing_team.category_group_name = team_in.category_group_name
            if team_in.recent_poule_id and team_in.recent_poule_id != existing_team.recent_poule_id:
                existing_team.recent_poule_id = team_in.recent_poule_id
                existing_team.no_new_poule_confirmed = False
                existing_team.season_pending = False
                teams_new_poule += 1
            existing_team.updated_at = now
            session.add(existing_team)
        else:
            teams_added += 1
            session.add(HockeyTeam(
                team_id=team_in.id, club_external_id=body.federation_reference_id,
                name=team_in.name, short_name=team_in.short_name,
                logo_url=team_in.logo, hockey_type=team_in.hockey_type,
                category_group_name=team_in.category_group_name,
                recent_poule_id=team_in.recent_poule_id,
                discovered_at=now, updated_at=now,
            ))

    teams_disappeared = len(known_team_ids - incoming_team_ids)

    return {
        "teams_found":       len(body.teams),
        "teams_added":       teams_added,
        "teams_new_poule":   teams_new_poule,
        "teams_disappeared": teams_disappeared,
    }


def _call_clubs_list(clubs: list, session: Session):
    """Upsert clubs uit de hockey.nl clubs-lijst. Overschrijft alleen basis-velden; detail_loaded blijft intact."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    clubs_added = 0
    clubs_updated = 0
    for item in clubs:
        ext_id = item.get("federation_reference_id")
        if not ext_id:
            continue
        existing = session.exec(select(HockeyClub).where(HockeyClub.external_id == ext_id)).first()
        if existing:
            changed = False
            if existing.name != item.get("name"):
                existing.name = item.get("name"); changed = True
            if existing.friendly_name != item.get("friendly_name"):
                existing.friendly_name = item.get("friendly_name"); changed = True
            if existing.city != item.get("city"):
                existing.city = item.get("city"); changed = True
            if existing.logo_url != item.get("logo"):
                existing.logo_url = item.get("logo"); changed = True
            if changed:
                existing.updated_at = now
                session.add(existing)
                clubs_updated += 1
        else:
            session.add(HockeyClub(
                external_id=ext_id,
                name=item.get("name"),
                friendly_name=item.get("friendly_name"),
                city=item.get("city"),
                logo_url=item.get("logo"),
                discovered_at=now,
                updated_at=now,
            ))
            clubs_added += 1
    return {
        "clubs_found":   len(clubs),
        "clubs_added":   clubs_added,
        "clubs_updated": clubs_updated,
    }


def _call_competition_detail(raw: dict, session: Session, params: dict):
    """Verwerk competition detail: sla alle poules op en queue get_poule cmds voor current-season poules."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    try:
        data = raw.get("data") or {}
        inner = data.get("data") or {}
        comp_name = inner.get("name") or params.get("label", "Onbekend")
        poules_list = inner.get("poules") or []
    except Exception:
        return None

    if not isinstance(poules_list, list) or not poules_list:
        return None

    poules_processed = 0
    teams_found_set: set = set()
    current_poule_map: Dict[int, int] = {}  # recent_poule_id → een team_id

    for poule_data in poules_list:
        poule_id = poule_data.get("id")
        poule_name = poule_data.get("name", "")
        comp_info = poule_data.get("competition") or {}
        class_name = comp_info.get("class_name", "Landelijk")

        matches = poule_data.get("matches") or []
        season = ""
        for m in matches:
            d_str = (m.get("date") or "")[:10]
            if len(d_str) >= 7:
                try:
                    y, mo = int(d_str[:4]), int(d_str[5:7])
                    season = f"{y}-{y+1}" if mo >= 8 else f"{y-1}-{y}"
                    break
                except Exception:
                    pass

        # HockeyCompetition upsert
        ext_id  = comp_name + "|" + (season or "onbekend")
        hl_cid  = params.get("comp_id")
        comp_row = session.exec(select(HockeyCompetition).where(HockeyCompetition.external_id == ext_id)).first()
        if comp_row:
            comp_row.class_name = class_name or comp_row.class_name
            if hl_cid:
                comp_row.hl_comp_id = hl_cid
            comp_row.updated_at = now
            session.add(comp_row)
        else:
            comp_row = HockeyCompetition(
                external_id=ext_id, name=comp_name, class_name=class_name,
                hockey_type="VE", season=season or "onbekend",
                hl_comp_id=hl_cid, discovered_at=now, updated_at=now,
            )
            session.add(comp_row)
        session.flush()

        # HockeyPoule upsert
        if poule_id:
            poule_row = session.exec(select(HockeyPoule).where(HockeyPoule.poule_id == poule_id)).first()
            if poule_row:
                poule_row.name = poule_name
                poule_row.competition_id = comp_row.id
                poule_row.updated_at = now
                session.add(poule_row)
            else:
                session.add(HockeyPoule(
                    poule_id=poule_id, name=poule_name, competition_id=comp_row.id,
                    season=season or "onbekend", discovered_at=now, updated_at=now,
                ))

        # Standings opslaan
        standings = poule_data.get("standings") or []
        if standings and poule_id:
            for old in session.exec(select(HockeyPouleStanding).where(HockeyPouleStanding.poule_id == poule_id)).all():
                session.delete(old)
            for s in standings:
                team = s.get("team") or {}
                tid = team.get("id")
                if tid:
                    teams_found_set.add(tid)
                    ht_row = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == tid)).first()
                    if not ht_row:
                        session.add(HockeyTeam(
                            team_id=tid,
                            club_external_id=team.get("federation_reference_id") or "",
                            name=team.get("name", ""),
                            short_name=team.get("short_name") or team.get("name", ""),
                            logo_url=team.get("logo"),
                            hockey_type=team.get("hockey_type") or "VE",
                            category_group_name=_derive_category(team.get("name", "")),
                            discovered_at=now, updated_at=now,
                        ))
                    elif not ht_row.club_external_id and team.get("federation_reference_id"):
                        ht_row.club_external_id = team["federation_reference_id"]
                        ht_row.updated_at = now
                        session.add(ht_row)
                session.add(HockeyPouleStanding(
                    poule_id=poule_id, team_id=tid or 0, team_name=team.get("name", ""),
                    position=s.get("rank"), played=s.get("played", 0),
                    won=s.get("wins", 0), drawn=s.get("draws", 0), lost=s.get("losses", 0),
                    goals_for=s.get("goals_for", 0), goals_against=s.get("goals_against", 0),
                    points=s.get("points", 0), updated_at=now,
                ))

        # Wedstrijden opslaan (inclusief locatie en veldtype)
        if matches and poule_id:
            for old in session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule_id)).all():
                session.delete(old)
            for m in matches:
                home = m.get("home") or {}
                away = m.get("away") or {}
                # Verzamel current-season poule IDs via recent_poule_id
                for side in [home, away]:
                    rpid = side.get("recent_poule_id")
                    tid = side.get("id")
                    if rpid and tid and rpid not in current_poule_map:
                        current_poule_map[rpid] = tid
                score = m.get("score") or {}
                is_final = m.get("status") == "final"
                loc = (m.get("location") or {})
                facility = (loc.get("facility") or {})
                field = (loc.get("field") or {})
                session.add(HockeyPouleMatch(
                    poule_id=poule_id, match_id=m.get("id"),
                    home_team_id=home.get("id"), home_team_name=home.get("name", ""),
                    away_team_id=away.get("id"), away_team_name=away.get("name", ""),
                    match_date=m.get("date"), status=m.get("status", ""),
                    home_score=score.get("home") if is_final else None,
                    away_score=score.get("away") if is_final else None,
                    round=m.get("round"),
                    location_name=facility.get("name"),
                    field_type=field.get("type"),
                    updated_at=now,
                ))

        poules_processed += 1

    # Queue get_poule cmds voor current-season poules (die nog niet gecaptured of al in queue zijn)
    captured_poule_ids = {p.poule_id for p in session.exec(select(HockeyPoule)).all()}
    pending_cmds = session.exec(
        select(VangerCmd).where(
            VangerCmd.cmd_type == "get_poule",
            col(VangerCmd.status).in_(["pending", "in_progress"]),
        )
    ).all()
    pending_poule_ids = set()
    for c in pending_cmds:
        try:
            pending_poule_ids.add(json.loads(c.params).get("poule_id"))
        except Exception:
            pass

    cmds_queued = 0
    for rpid, team_id in current_poule_map.items():
        if rpid in captured_poule_ids or rpid in pending_poule_ids:
            continue
        session.add(VangerCmd(
            cmd_type="get_poule",
            params=json.dumps({"poule_id": rpid, "team_id": team_id, "label": comp_name + " #" + str(rpid)}),
            created_at=now,
        ))
        cmds_queued += 1

    return {
        "poules_processed":       poules_processed,
        "teams_found":            len(teams_found_set),
        "get_poule_cmds_queued":  cmds_queued,
        "competition":            comp_name,
    }


def _call_competitions_list(raw: dict, session: Session):
    """Verwerk nationale competities lijst: upsert HockeyCompetition records (geen auto-queue)."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    try:
        competitions = raw.get("competitions") or raw.get("data") or []
        if not isinstance(competitions, list):
            return None
    except Exception:
        return None

    target_season = _get_target_season(session)
    upserted = 0
    for item in competitions:
        comp_id = item.get("id")
        if not comp_id:
            continue
        name       = item.get("name") or ("Comp " + str(comp_id))
        class_name = item.get("class_name") or ""
        ht         = "ZA" if "Zaal" in name else "VE"
        ext_id     = name + "|" + target_season

        existing = session.exec(
            select(HockeyCompetition).where(HockeyCompetition.external_id == ext_id)
        ).first()
        if existing:
            existing.hl_comp_id = comp_id
            existing.updated_at = now
            session.add(existing)
        else:
            session.add(HockeyCompetition(
                external_id=ext_id,
                name=name,
                class_name=class_name,
                hockey_type=ht,
                season=target_season,
                hl_comp_id=comp_id,
                discovered_at=now,
                updated_at=now,
            ))
        upserted += 1

    session.commit()
    return {
        "competitions_found": len(competitions),
        "upserted":           upserted,
    }


@router.delete("/vanger/cmd-queue")
def clear_cmd_queue(
    scope: str = "pending",  # "pending" = pending+in_progress, "done" = done+skipped, "all" = alles
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    if scope == "done":
        statuses = ["done", "skipped"]
    elif scope == "all":
        statuses = ["pending", "in_progress", "done", "failed", "skipped"]
    else:
        statuses = ["pending", "in_progress"]

    deleted = 0
    for cmd in session.exec(
        select(VangerCmd).where(col(VangerCmd.status).in_(statuses))
    ).all():
        session.delete(cmd)
        deleted += 1
    session.commit()
    return {"deleted": deleted}


@router.post("/vanger/cmd-queue/{cmd_id}/retry")
def retry_cmd(
    cmd_id: int,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    from fastapi import HTTPException
    cmd = session.get(VangerCmd, cmd_id)
    if not cmd:
        raise HTTPException(status_code=404, detail="Cmd niet gevonden")
    cmd.status         = "pending"
    cmd.error          = None
    cmd.started_at     = None
    cmd.finished_at    = None
    cmd.result_summary = None
    session.add(cmd)
    session.commit()
    return {"ok": True}
