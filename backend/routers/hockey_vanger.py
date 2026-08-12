"""Hockey — queue helpers, vanger cmd-queue, smart scan, gap analysis."""

import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, col, func, select

from core.auth import get_current_user, require_admin
from core.database import get_session
from models.capture import DataCapture, new_uuid
from models.hockey_discovery import (
    HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch,
    HockeyPouleStanding, HockeyTeam, VangerCmd,
)
from models.settings import AppSetting
from routers.hockey_capture import (
    DISC_TARGET_SEASON, MatchIn, PouleCaptureIn, StandingIn, TeamInPoule,
    _derive_category, _get_target_season,
)
from routers.hockey_clubs import ClubDetailIn, TeamIn

router = APIRouter(prefix="/api/hockey", tags=["hockey-vanger"])


# ── Queue helper constants + filters ────────────────────
_AGE_RE         = re.compile(r"[JM][OZ](1[1-8])-")
_AGE_RE_GENERIC = re.compile(r"[JMjm][OZoz](\d+)-")

DISC_FILTER_AGE    = "disc_queue_age_groups"
DISC_FILTER_CLUB   = "disc_queue_club"
DISC_FILTER_CAT    = "disc_queue_category"
DISC_FILTER_HT     = "disc_queue_hockey_type"
DISC_FILTER_GENDER = "disc_queue_gender"

SMART_SCAN_MODE       = "smart_scan_mode"
SMART_SCAN_STARTED_AT = "smart_scan_started_at"
SMART_SCAN_CMD_COUNT  = "smart_scan_cmd_count"
SMART_SCAN_MAX_CMDS   = 200

_GENDER_PREFIX = {"Jongens": "J", "Meisjes": "M", "Heren": "H", "Dames": "D"}


def _is_target_age(short_name: str) -> bool:
    return bool(_AGE_RE.search(short_name or ""))


def _age_group_of(short_name: str) -> str:
    m = _AGE_RE_GENERIC.search(short_name or "")
    return "O" + m.group(1) if m else "?"


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


def _age_in_range(short_name: str, age_min: int, age_max: int) -> bool:
    m = _AGE_RE_GENERIC.search(short_name or "")
    if not m:
        return False
    age = int(m.group(1))
    return age_min <= age <= age_max


# ── Queue filter endpoints ───────────────────────────────

class QueueFilterBody(BaseModel):
    age_groups:       List[str] = []
    club_external_id: Optional[str] = None
    categories:       List[str] = []
    hockey_types:     List[str] = []
    genders:          List[str] = []


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


# ── Poule-queue + club-scan-queue ────────────────────────

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
    """Volgende niet-gecaptured poule item (hoog leeftijdsgetal eerst)."""
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


@router.get("/club-scan-queue")
def get_club_scan_queue(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Clubs waarvan teams no_new_poule_confirmed of season_pending hebben."""
    _, _, cats, hts, genders = _get_queue_filter(session)
    q = select(HockeyTeam).where(
        (HockeyTeam.no_new_poule_confirmed == True) | (HockeyTeam.season_pending == True)  # noqa: E712
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
        (HockeyTeam.no_new_poule_confirmed == True) | (HockeyTeam.season_pending == True)  # noqa: E712
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


# ── Raw-data parsers (vanger plugin → domain schemas) ───

def _parse_raw_poule(raw: dict, params: dict) -> Optional[PouleCaptureIn]:
    try:
        poule_data = raw["data"]["data"]["poule"]
        comp       = poule_data.get("competition") or {}
        subcomp    = comp.get("subcompetition") or {}

        teams_list:    List[TeamInPoule] = []
        standings_list: List[StandingIn] = []
        matches_list:   List[MatchIn]    = []

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
            ht  = m.get("home_team") or m.get("homeTeam") or m.get("home") or {}
            at  = m.get("away_team") or m.get("awayTeam") or m.get("away") or {}
            sc  = m.get("score") or {}
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
            district=comp.get("district_name") or comp.get("district") or "",
            hockey_type=hockey_type,
            season=raw.get("seizoen", "2026-2027"),
            teams_in_poule=teams_list,
            standings_data=standings_list,
            matches_data=matches_list,
        )
    except Exception:
        return None


def _parse_raw_club(raw: dict, params: dict) -> Optional[ClubDetailIn]:
    try:
        d = raw.get("data") or raw
        teams: List[TeamIn] = []
        for t in d.get("teams") or []:
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
            federation_reference_id=d.get("federation_reference_id") or params.get("external_id", ""),
            name=d.get("name", ""),
            friendly_name=d.get("friendly_name") or d.get("name", ""),
            city=d.get("city"),
            logo=d.get("logo"),
            address=d.get("address"),
            zipcode=d.get("zipcode"),
            phone=d.get("phone"),
            email=d.get("email"),
            website=d.get("website"),
            tenue=d.get("tenue"),
            district=d.get("district"),
            payment_options=d.get("payment_options"),
            parking=d.get("parking"),
            hockey_types=d.get("hockey_types"),
            teams=teams,
        )
    except Exception:
        return None


# ── Internal _call_* helpers (no HTTP layer) ─────────────

def _call_poule_capture(body: PouleCaptureIn, session: Session):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    ext_id = body.competition_name + "|" + (body.class_name or "") + "|" + (body.district or "") + "|" + body.season
    comp = session.exec(select(HockeyCompetition).where(HockeyCompetition.external_id == ext_id)).first()
    if comp:
        comp.class_name = body.class_name
        comp.district   = body.district or comp.district
        comp.updated_at = now
        if body.hockey_type:
            comp.hockey_type = body.hockey_type
        session.add(comp)
    else:
        base_prefix = body.competition_name + "|" + (body.class_name or "") + "|" + (body.district or "") + "|"
        prev_comp = session.exec(
            select(HockeyCompetition)
            .where(HockeyCompetition.external_id.like(base_prefix + "%"))
            .where(HockeyCompetition.season != body.season)
            .order_by(HockeyCompetition.season.desc())
        ).first()
        if prev_comp:
            prev_comp.external_id = ext_id
            prev_comp.season      = body.season
            prev_comp.updated_at  = now
            if body.hockey_type:
                prev_comp.hockey_type = body.hockey_type
            if body.district:
                prev_comp.district = body.district
            comp = prev_comp
            session.add(comp)
        else:
            comp = HockeyCompetition(
                external_id=ext_id, name=body.competition_name, class_name=body.class_name,
                district=body.district or None,
                hockey_type=body.hockey_type, season=body.season, discovered_at=now, updated_at=now,
            )
            session.add(comp)
    session.flush()

    poule = session.exec(select(HockeyPoule).where(HockeyPoule.poule_id == body.poule_id)).first()
    if poule:
        poule.name = body.poule_name
        poule.competition_id = comp.id
        poule.updated_at = now
        poule.last_scanned_at = now
        session.add(poule)
    else:
        prev_poule = session.exec(
            select(HockeyPoule)
            .where(HockeyPoule.name == body.poule_name)
            .where(HockeyPoule.competition_id == comp.id)
        ).first()
        if prev_poule:
            prev_poule.poule_id        = body.poule_id
            prev_poule.season          = body.season
            prev_poule.updated_at      = now
            prev_poule.last_scanned_at = now
            session.add(prev_poule)
        else:
            session.add(HockeyPoule(
                poule_id=body.poule_id, name=body.poule_name, competition_id=comp.id,
                season=body.season, discovered_at=now, updated_at=now, last_scanned_at=now,
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
            is_fin = md.status == "finished"
            session.add(HockeyPouleMatch(
                poule_id=body.poule_id, match_id=md.match_id,
                home_team_id=md.home_team_id, home_team_name=md.home_team_name,
                away_team_id=md.away_team_id, away_team_name=md.away_team_name,
                match_date=md.match_date, status=md.status,
                home_score=md.home_score if is_fin else None,
                away_score=md.away_score if is_fin else None,
                round=md.round, updated_at=now,
            ))

    target_season = _get_target_season(session)
    is_target = body.season == target_season
    for t_in in body.teams_in_poule:
        existing = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == t_in.id)).first()
        if existing:
            if is_target and existing.recent_poule_id != body.poule_id:
                existing.recent_poule_id        = body.poule_id
                existing.season_pending         = False
                existing.no_new_poule_confirmed = False
                existing.updated_at             = now
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

    matches_played = sum(1 for m in (body.matches_data or []) if m.status == "finished")
    return {
        "teams":          len(body.teams_in_poule),
        "standings":      len(body.standings_data or []),
        "matches_total":  len(body.matches_data or []),
        "matches_played": matches_played,
        "competition":    body.competition_name,
        "season":         body.season,
    }


def _call_club_detail(body: ClubDetailIn, session: Session):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    existing = session.exec(select(HockeyClub).where(HockeyClub.external_id == body.federation_reference_id)).first()
    club = existing or HockeyClub(external_id=body.federation_reference_id, discovered_at=now)
    if body.name:         club.name          = body.name
    if body.friendly_name: club.friendly_name = body.friendly_name
    club.city = body.city
    club.logo_url = body.logo
    club.address  = body.address
    club.zipcode  = body.zipcode
    club.phone    = body.phone
    club.email    = body.email
    club.website  = body.website
    club.tenue    = body.tenue
    club.district = body.district
    club.payment_options = (
        json.dumps(body.payment_options, ensure_ascii=False)
        if isinstance(body.payment_options, list) else body.payment_options
    )
    club.parking = body.parking
    club.hockey_types = (
        json.dumps(body.hockey_types, ensure_ascii=False)
        if isinstance(body.hockey_types, list) else body.hockey_types
    )
    club.detail_loaded = True
    club.updated_at = now
    club.last_scanned_at = now
    session.add(club)

    known_team_ids    = {t.team_id for t in session.exec(
        select(HockeyTeam).where(HockeyTeam.club_external_id == body.federation_reference_id)
    ).all()}
    incoming_team_ids = {ti.id for ti in body.teams}

    teams_added = teams_new_poule = 0
    for team_in in body.teams:
        existing_team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == team_in.id)).first()
        if existing_team:
            if team_in.name:       existing_team.name       = team_in.name
            if team_in.short_name: existing_team.short_name = team_in.short_name
            existing_team.logo_url             = team_in.logo
            existing_team.hockey_type          = team_in.hockey_type
            existing_team.category_group_name  = team_in.category_group_name
            if team_in.recent_poule_id and team_in.recent_poule_id != existing_team.recent_poule_id:
                existing_team.recent_poule_id        = team_in.recent_poule_id
                existing_team.no_new_poule_confirmed = False
                existing_team.season_pending         = False
                teams_new_poule += 1
            existing_team.updated_at      = now
            existing_team.last_scanned_at = now
            session.add(existing_team)
        else:
            teams_added += 1
            session.add(HockeyTeam(
                team_id=team_in.id, club_external_id=body.federation_reference_id,
                name=team_in.name, short_name=team_in.short_name,
                logo_url=team_in.logo, hockey_type=team_in.hockey_type,
                category_group_name=team_in.category_group_name,
                recent_poule_id=team_in.recent_poule_id,
                discovered_at=now, updated_at=now, last_scanned_at=now,
            ))

    return {
        "teams_found":       len(body.teams),
        "teams_added":       teams_added,
        "teams_new_poule":   teams_new_poule,
        "teams_disappeared": len(known_team_ids - incoming_team_ids),
    }


def _call_clubs_list(clubs: list, session: Session):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    clubs_added = clubs_updated = 0
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
    return {"clubs_found": len(clubs), "clubs_added": clubs_added, "clubs_updated": clubs_updated}


def _call_competition_detail(raw: dict, session: Session, params: dict):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    try:
        data  = raw.get("data") or {}
        inner = data.get("data") or {}
        comp_name   = inner.get("name") or params.get("label", "Onbekend")
        poules_list = inner.get("poules") or []
    except Exception:
        return None

    if not isinstance(poules_list, list) or not poules_list:
        return None

    fallback_season = ""
    for _pd in poules_list:
        for _m in (_pd.get("matches") or []):
            _d = ((_m.get("date") or ""))[:10]
            if len(_d) >= 7:
                try:
                    _y, _mo = int(_d[:4]), int(_d[5:7])
                    fallback_season = f"{_y}-{_y+1}" if _mo >= 8 else f"{_y-1}-{_y}"
                except Exception:
                    pass
            if fallback_season:
                break
        if fallback_season:
            break

    _canonical_class = _canonical_district = ""
    for _pd in poules_list:
        _ci = _pd.get("competition") or {}
        if _ci.get("class_name"):
            _canonical_class    = _ci.get("class_name", "")
            _canonical_district = _ci.get("district_name") or _ci.get("district") or ""
            break

    poules_processed = 0
    teams_found_set: set = set()
    current_poule_map: Dict[int, int] = {}

    for poule_data in poules_list:
        poule_id   = poule_data.get("id")
        poule_name = poule_data.get("name", "")
        class_name = _canonical_class or "Landelijk"
        district   = _canonical_district

        matches = poule_data.get("matches") or []
        season  = ""
        for m in matches:
            d_str = (m.get("date") or "")[:10]
            if len(d_str) >= 7:
                try:
                    y, mo = int(d_str[:4]), int(d_str[5:7])
                    season = f"{y}-{y+1}" if mo >= 8 else f"{y-1}-{y}"
                    break
                except Exception:
                    pass
        if not season:
            season = fallback_season

        ext_id   = comp_name + "|" + (class_name or "") + "|" + (district or "") + "|" + (season or "onbekend")
        hl_cid   = params.get("comp_id")
        comp_row = session.exec(select(HockeyCompetition).where(HockeyCompetition.external_id == ext_id)).first()
        if comp_row:
            comp_row.class_name = class_name or comp_row.class_name
            comp_row.district   = district or comp_row.district
            if hl_cid:
                comp_row.hl_comp_id = hl_cid
            comp_row.updated_at = now
            session.add(comp_row)
        else:
            comp_row = HockeyCompetition(
                external_id=ext_id, name=comp_name, class_name=class_name,
                district=district or None,
                hockey_type="VE", season=season or "onbekend",
                hl_comp_id=hl_cid, discovered_at=now, updated_at=now,
            )
            session.add(comp_row)
        session.flush()

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

        standings = poule_data.get("standings") or []
        if standings and poule_id:
            for old in session.exec(select(HockeyPouleStanding).where(HockeyPouleStanding.poule_id == poule_id)).all():
                session.delete(old)
            for s in standings:
                team = s.get("team") or {}
                tid  = team.get("id")
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

        if matches and poule_id:
            for old in session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule_id)).all():
                session.delete(old)
            for m in matches:
                home = m.get("home") or {}
                away = m.get("away") or {}
                for side in [home, away]:
                    rpid = side.get("recent_poule_id")
                    tid  = side.get("id")
                    if rpid and tid and rpid not in current_poule_map:
                        current_poule_map[rpid] = tid
                score    = m.get("score") or {}
                is_final = m.get("status") == "final"
                loc      = (m.get("location") or {})
                facility = (loc.get("facility") or {})
                field    = (loc.get("field") or {})
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

    captured_poule_ids = {p.poule_id for p in session.exec(select(HockeyPoule)).all()}
    pending_cmds = session.exec(
        select(VangerCmd).where(
            VangerCmd.cmd_type == "get_poule",
            col(VangerCmd.status).in_(["pending", "in_progress"]),
        )
    ).all()
    pending_poule_ids: set = set()
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
        "poules_processed":      poules_processed,
        "teams_found":           len(teams_found_set),
        "get_poule_cmds_queued": cmds_queued,
        "competition":           comp_name,
    }


def _call_competitions_list(raw: dict, session: Session):
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
    return {"competitions_found": len(competitions), "upserted": upserted}


def _call_clubs_list_raw(raw_list: list, session: Session):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    created = updated = 0
    for club_in in raw_list:
        if not isinstance(club_in, dict):
            continue
        ref_id = club_in.get("federation_reference_id") or club_in.get("external_id")
        if not ref_id:
            continue
        existing = session.exec(select(HockeyClub).where(HockeyClub.external_id == ref_id)).first()
        if existing:
            if club_in.get("name"):          existing.name          = club_in["name"]
            if club_in.get("friendly_name"): existing.friendly_name = club_in["friendly_name"]
            existing.city      = club_in.get("city")
            existing.logo_url  = club_in.get("logo") or club_in.get("logo_url")
            existing.club_type = club_in.get("type") or club_in.get("club_type")
            existing.updated_at = now
            session.add(existing)
            updated += 1
        else:
            session.add(HockeyClub(
                external_id=ref_id,
                name=club_in.get("name", ""),
                friendly_name=club_in.get("friendly_name"),
                city=club_in.get("city"),
                logo_url=club_in.get("logo") or club_in.get("logo_url"),
                club_type=club_in.get("type") or club_in.get("club_type"),
                discovered_at=now,
                updated_at=now,
            ))
            created += 1
    return {"created": created, "updated": updated}


def _call_club_detail_raw(raw: dict, session: Session):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    ref_id = raw.get("federation_reference_id")
    if not ref_id:
        return None

    existing = session.exec(select(HockeyClub).where(HockeyClub.external_id == ref_id)).first()
    club = existing or HockeyClub(external_id=ref_id, discovered_at=now)
    if raw.get("name"):          club.name          = raw["name"]
    if raw.get("friendly_name"): club.friendly_name = raw["friendly_name"]
    club.city     = raw.get("city")
    club.logo_url = raw.get("logo")
    club.address  = raw.get("address")
    club.zipcode  = raw.get("zipcode")
    club.phone    = raw.get("phone")
    club.email    = raw.get("email")
    club.website  = raw.get("website")
    club.tenue    = raw.get("tenue")
    club.district = raw.get("district")
    club.detail_loaded   = True
    club.updated_at      = now
    club.last_scanned_at = now
    _po = raw.get("payment_options")
    club.payment_options = json.dumps(_po, ensure_ascii=False) if isinstance(_po, list) else _po
    _ht = raw.get("hockey_types")
    club.hockey_types    = json.dumps(_ht, ensure_ascii=False) if isinstance(_ht, list) else _ht
    session.add(club)

    teams_created = teams_updated = 0
    for team_in in (raw.get("teams") or []):
        if not isinstance(team_in, dict):
            continue
        tid = team_in.get("id")
        if not tid:
            continue
        existing_team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == tid)).first()
        if existing_team:
            if team_in.get("name"):       existing_team.name       = team_in["name"]
            if team_in.get("short_name"): existing_team.short_name = team_in["short_name"]
            existing_team.logo_url            = team_in.get("logo")
            existing_team.hockey_type         = team_in.get("hockey_type", "")
            existing_team.category_group_name = team_in.get("category_group_name", "")
            if team_in.get("recent_poule_id") != existing_team.recent_poule_id:
                existing_team.recent_poule_id        = team_in.get("recent_poule_id")
                existing_team.no_new_poule_confirmed = False
                existing_team.season_pending         = False
            existing_team.updated_at      = now
            existing_team.last_scanned_at = now
            session.add(existing_team)
            teams_updated += 1
        else:
            session.add(HockeyTeam(
                team_id=tid,
                club_external_id=ref_id,
                name=team_in.get("name", ""),
                short_name=team_in.get("short_name", ""),
                logo_url=team_in.get("logo"),
                hockey_type=team_in.get("hockey_type", ""),
                category_group_name=team_in.get("category_group_name", ""),
                recent_poule_id=team_in.get("recent_poule_id"),
                discovered_at=now, updated_at=now, last_scanned_at=now,
            ))
            teams_created += 1

    return {"club": ref_id, "teams_created": teams_created, "teams_updated": teams_updated}


# ── Vanger heartbeat / live status ──────────────────────

VANGER_STATUS_KEY = "vanger_status"


class VangerHeartbeatIn(BaseModel):
    running:     bool
    mode:        Optional[str] = None
    task:        Optional[str] = None
    done_count:  int = 0
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


# ── Vanger cmd-queue ─────────────────────────────────────

class CmdResultIn(BaseModel):
    raw:        Optional[Any] = None
    error:      Optional[str] = None
    session_id: Optional[str] = None


class CmdFillIn(BaseModel):
    type:         str            # "poules" | "clubs" | "poules_refresh"
    max_age_days: Optional[int] = 7


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

    pending_cmds = session.exec(
        select(VangerCmd).where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).all()
    pending_params = {
        json.loads(c.params).get("poule_id") or json.loads(c.params).get("external_id")
        for c in pending_cmds
    }

    added       = 0
    stale_poule_ids: set = set()

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

        stale_poule_ids = {t.recent_poule_id for t in teams if t.recent_poule_id and t.season_pending}
        skip_ids = stale_poule_ids | {
            t.recent_poule_id for t in teams
            if t.recent_poule_id and t.no_new_poule_confirmed
        }

        seen: set = set()
        candidates = []
        for t in teams:
            pid = t.recent_poule_id
            if not pid or pid in captured_ids or pid in seen or pid in skip_ids:
                continue
            seen.add(pid)
            candidates.append({
                "poule_id":    pid,
                "team_id":     t.team_id,
                "label":       t.name + " (#" + str(pid) + ")",
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
                    cmd_type="get_poule",
                    params=json.dumps({"poule_id": c["poule_id"], "team_id": c["team_id"], "label": c["label"]}),
                    created_at=now,
                ))
                added += 1

    elif body.type == "clubs":
        _, _, cats, hts, genders = _get_queue_filter(session)
        q = select(HockeyTeam).where(
            (HockeyTeam.no_new_poule_confirmed == True) | (HockeyTeam.season_pending == True)  # noqa: E712
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

        unscanned = session.exec(
            select(HockeyClub).where(HockeyClub.detail_loaded == False)  # noqa: E712
        ).all()
        for c in unscanned:
            if c.external_id not in counts_by_club:
                counts_by_club[c.external_id] = 0

        all_club_ids = list(counts_by_club.keys())
        club_rows = session.exec(
            select(HockeyClub).where(col(HockeyClub.external_id).in_(all_club_ids))
        ).all()
        club_map = {c.external_id: c for c in club_rows}

        for ext_id, cnt in sorted(counts_by_club.items(), key=lambda x: -x[1]):
            if ext_id not in pending_params:
                c = club_map.get(ext_id)
                label = (c.friendly_name or c.name) if c else ext_id
                session.add(VangerCmd(
                    cmd_type="scan_club",
                    params=json.dumps({"external_id": ext_id, "label": label, "pending_teams": cnt}),
                    created_at=now,
                ))
                added += 1

    elif body.type == "poules_refresh":
        from datetime import timedelta
        max_age = body.max_age_days if body.max_age_days is not None else 7
        cutoff  = now - timedelta(days=max_age)

        target_season = _get_target_season(session)
        _, _, cats, hts, genders = _get_queue_filter(session)

        q = (
            select(HockeyPoule)
            .where(HockeyPoule.season == target_season)
            .where(
                (HockeyPoule.last_scanned_at == None)  # noqa: E711
                | (HockeyPoule.last_scanned_at < cutoff)
            )
        )
        poules = session.exec(q).all()

        team_by_poule: dict = {}
        for t in session.exec(select(HockeyTeam).where(col(HockeyTeam.recent_poule_id).is_not(None))).all():
            if t.recent_poule_id and t.recent_poule_id not in team_by_poule:
                team_by_poule[t.recent_poule_id] = t

        for poule in poules:
            t = team_by_poule.get(poule.poule_id)
            if cats and (not t or t.category_group_name not in cats):
                continue
            if hts and (not t or t.hockey_type not in hts):
                continue
            if genders and t:
                prefixes = {_GENDER_PREFIX[g] for g in genders if g in _GENDER_PREFIX}
                if not any((t.short_name or "").startswith(p) for p in prefixes):
                    continue

            pid_str = str(poule.poule_id)
            if pid_str in pending_params or poule.poule_id in pending_params:
                continue
            if not t:
                continue
            team_id = t.team_id
            label   = t.name + " — " + (poule.name or f"poule #{poule.poule_id}")

            session.add(VangerCmd(
                cmd_type="get_poule",
                params=json.dumps({"poule_id": poule.poule_id, "team_id": team_id, "label": label}),
                created_at=now,
            ))
            added += 1

    session.commit()
    extra: Dict[str, Any] = {}
    if body.type == "poules":
        extra["stale_skip"] = len(stale_poule_ids)
    return {"added": added, "type": body.type, **extra}


class CmdAddIn(BaseModel):
    cmd_type: str
    params:   Dict[str, Any]


@router.post("/vanger/cmd-queue/add")
def add_single_cmd(
    body: CmdAddIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    valid = ("get_poule", "scan_club", "get_clubs", "get_competition_detail", "get_competitions")
    if body.cmd_type not in valid:
        raise HTTPException(status_code=400, detail="Ongeldig cmd_type")

    now = datetime.now(timezone.utc).replace(tzinfo=None)

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
    cmd.status     = "in_progress"
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
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    cmd = session.get(VangerCmd, cmd_id)
    if not cmd:
        raise HTTPException(status_code=404, detail="Cmd niet gevonden")

    params = json.loads(cmd.params)

    if body.error or body.raw is None:
        cmd.status      = "failed" if body.error else "skipped"
        cmd.error       = body.error
        cmd.finished_at = now
        session.add(cmd)

        if cmd.cmd_type == "get_poule" and not body.error:
            poule_id = params.get("poule_id")
            if poule_id:
                for t in session.exec(
                    select(HockeyTeam).where(HockeyTeam.recent_poule_id == poule_id)
                ).all():
                    t.no_new_poule_confirmed = True
                    session.add(t)

        session.commit()
        return {"ok": True, "status": cmd.status}

    result_label = params.get("label", "")
    raw_bytes    = len(json.dumps(body.raw).encode("utf-8")) if body.raw else 0
    duration_ms  = round((now - cmd.started_at).total_seconds() * 1000) if cmd.started_at else None
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

    already = session.exec(
        select(DataCapture)
        .where(DataCapture.external_id == archive_ext)
        .where(DataCapture.session_id == session_key)
    ).first()
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
            clubs_raw  = body.raw if isinstance(body.raw, dict) else {}
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
    _smart_scan_try_advance(session)
    return {"ok": True, "status": "done", "label": result_label}


@router.delete("/vanger/cmd-queue")
def clear_cmd_queue(
    scope: str = "pending",
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    if scope == "done":
        statuses = ["done", "skipped", "failed"]
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


# ── Smart Scan coordinator ───────────────────────────────

def _smart_scan_get_state(session: Session) -> dict:
    mode_row  = session.get(AppSetting, SMART_SCAN_MODE)
    start_row = session.get(AppSetting, SMART_SCAN_STARTED_AT)
    count_row = session.get(AppSetting, SMART_SCAN_CMD_COUNT)
    mode      = (mode_row.value  if mode_row  else "") or ""
    started_at_str = (start_row.value if start_row else "") or ""
    raw_count = (count_row.value if count_row else "") or "0"
    cmd_count = int(raw_count) if raw_count.isdigit() else 0
    started_at = None
    if started_at_str:
        try:
            started_at = datetime.fromisoformat(started_at_str)
        except ValueError:
            pass
    return {"mode": mode, "started_at": started_at, "cmd_count": cmd_count}


def _smart_scan_set_state(session: Session, mode: str, started_at: Optional[datetime] = None, cmd_count: Optional[int] = None):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for key, val in [
        (SMART_SCAN_MODE,       mode),
        (SMART_SCAN_STARTED_AT, started_at.isoformat() if started_at else ""),
        (SMART_SCAN_CMD_COUNT,  str(cmd_count if cmd_count is not None else 0)),
    ]:
        row = session.get(AppSetting, key)
        if row:
            row.value = val; row.updated_at = now; session.add(row)
        else:
            session.add(AppSetting(key=key, value=val, updated_at=now))


def _smart_scan_discovery_next(session: Session, started_at: datetime, cmd_count: int) -> dict:
    if cmd_count >= SMART_SCAN_MAX_CMDS:
        _smart_scan_set_state(session, "")
        return {"added": 0, "reason": "max_cmds"}

    _, _, cats, hts, genders = _get_queue_filter(session)

    clubs_scanned_this_session = session.exec(
        select(HockeyClub).where(HockeyClub.last_scanned_at >= started_at)
    ).all()
    scanned_ext_ids = {c.external_id for c in clubs_scanned_this_session}

    active_cmds = session.exec(
        select(VangerCmd).where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).all()
    queued_poule_ids:    set = set()
    queued_club_ext_ids: set = set()
    for c in active_cmds:
        p = json.loads(c.params)
        if c.cmd_type == "get_poule":
            queued_poule_ids.add(p.get("poule_id"))
        elif c.cmd_type == "scan_club":
            queued_club_ext_ids.add(p.get("external_id"))

    if scanned_ext_ids:
        captured_ids = {p.poule_id for p in session.exec(select(HockeyPoule)).all()}

        tq = select(HockeyTeam).where(col(HockeyTeam.club_external_id).in_(scanned_ext_ids))
        tq = tq.where(col(HockeyTeam.recent_poule_id).is_not(None))
        tq = tq.where(HockeyTeam.no_new_poule_confirmed == False)  # noqa: E712
        tq = tq.where(HockeyTeam.season_pending == False)  # noqa: E712
        if cats:
            tq = tq.where(col(HockeyTeam.category_group_name).in_(cats))
        if hts:
            tq = tq.where(col(HockeyTeam.hockey_type).in_(hts))
        tq = _apply_gender_filter(tq, genders)
        teams = session.exec(tq).all()

        seen_pids: set = set()
        to_add = []
        for t in teams:
            pid = t.recent_poule_id
            if pid in captured_ids or pid in queued_poule_ids or pid in seen_pids:
                continue
            seen_pids.add(pid)
            to_add.append({"poule_id": pid, "team_id": t.team_id, "label": t.name})

        if to_add:
            batch = to_add[:15]
            added = 0
            for item in batch:
                if cmd_count + added >= SMART_SCAN_MAX_CMDS:
                    break
                session.add(VangerCmd(
                    cmd_type="get_poule",
                    params=json.dumps({"poule_id": item["poule_id"], "team_id": item["team_id"], "label": item["label"]}),
                    status="pending",
                ))
                added += 1
            _smart_scan_set_state(session, "discovery", started_at, cmd_count + added)
            return {"added": added, "type": "get_poule"}

    cq = select(HockeyTeam).where(
        HockeyTeam.no_new_poule_confirmed == False,  # noqa: E712
        HockeyTeam.season_pending == False,  # noqa: E712
    )
    if cats:
        cq = cq.where(col(HockeyTeam.category_group_name).in_(cats))
    if hts:
        cq = cq.where(col(HockeyTeam.hockey_type).in_(hts))
    cq = _apply_gender_filter(cq, genders)
    pending_teams = session.exec(cq).all()

    club_counts: Dict[str, int] = {}
    for t in pending_teams:
        if t.club_external_id in scanned_ext_ids:
            continue
        club_counts[t.club_external_id] = club_counts.get(t.club_external_id, 0) + 1

    if not club_counts:
        _smart_scan_set_state(session, "")
        return {"added": 0, "reason": "idle"}

    best_ext = max(club_counts, key=lambda k: club_counts[k])
    if best_ext in queued_club_ext_ids:
        return {"added": 0, "reason": "already_queued"}

    club = session.exec(select(HockeyClub).where(HockeyClub.external_id == best_ext)).first()
    label = (club.friendly_name or club.name) if club else best_ext
    session.add(VangerCmd(
        cmd_type="scan_club",
        params=json.dumps({"external_id": best_ext, "label": label}),
        status="pending",
    ))
    _smart_scan_set_state(session, "discovery", started_at, cmd_count + 1)
    return {"added": 1, "type": "scan_club", "club": label, "pending_teams": club_counts[best_ext]}


def _smart_scan_try_advance(session: Session):
    state = _smart_scan_get_state(session)
    if not state["mode"] or not state["started_at"]:
        return
    remaining = session.exec(
        select(func.count(VangerCmd.id)).where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).one()
    if remaining > 0:
        return
    if state["mode"] == "discovery":
        result = _smart_scan_discovery_next(session, state["started_at"], state["cmd_count"])
        if result.get("added", 0) == 0 and result.get("reason") != "already_queued":
            _smart_scan_set_state(session, "")
    session.commit()


@router.post("/smart-scan/start")
def smart_scan_start(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    _smart_scan_set_state(session, "discovery", now, 0)
    session.commit()
    result = _smart_scan_discovery_next(session, now, 0)
    session.commit()
    return {"ok": True, **result}


@router.post("/smart-scan/stop")
def smart_scan_stop(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    _smart_scan_set_state(session, "")
    session.commit()
    return {"ok": True}


@router.get("/smart-scan/status")
def smart_scan_status(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    state = _smart_scan_get_state(session)
    return {
        "active":     bool(state["mode"]),
        "mode":       state["mode"] or None,
        "started_at": state["started_at"].isoformat() if state["started_at"] else None,
        "cmd_count":  state["cmd_count"],
        "max_cmds":   SMART_SCAN_MAX_CMDS,
    }


# ── Gap-analyse ──────────────────────────────────────────

@router.get("/gap-analysis")
def gap_analysis(
    season: Optional[str] = None,
    stale_days: int = 7,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Analyse welke data ontbreekt of verouderd is; geeft queue-aanbeveling."""
    from datetime import timedelta
    target = season or _get_target_season(session)
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=stale_days)

    poules    = session.exec(select(HockeyPoule).where(HockeyPoule.season == target)).all()
    poule_ids = {p.poule_id for p in poules}

    standing_ids = {
        r[0] for r in session.exec(
            select(HockeyPouleStanding.poule_id).where(col(HockeyPouleStanding.poule_id).in_(list(poule_ids)))
        ).all()
    }
    match_ids = {
        r[0] for r in session.exec(
            select(HockeyPouleMatch.poule_id).where(col(HockeyPouleMatch.poule_id).in_(list(poule_ids)))
        ).all()
    }

    stale        = [p for p in poules if p.last_scanned_at is None or p.last_scanned_at < cutoff]
    no_standings = [p for p in poules if p.poule_id not in standing_ids]
    no_matches   = [p for p in poules if p.poule_id not in match_ids]

    season_pending_teams = session.exec(
        select(HockeyTeam).where(HockeyTeam.season_pending == True)  # noqa: E712
    ).all()
    clubs_pending    = {t.club_external_id for t in season_pending_teams}
    unscanned_clubs  = session.exec(
        select(HockeyClub).where(HockeyClub.detail_loaded == False)  # noqa: E712
    ).all()

    return {
        "season":     target,
        "stale_days": stale_days,
        "poules": {
            "total":        len(poules),
            "stale":        len(stale),
            "no_standings": len(no_standings),
            "no_matches":   len(no_matches),
        },
        "clubs": {
            "total":                   len(session.exec(select(HockeyClub)).all()),
            "unscanned":               len(unscanned_clubs),
            "needs_rescan_for_new_poule": len(clubs_pending),
        },
        "queue_recommendation": {
            "get_poule_cmds": len(stale) + len(no_standings),
            "scan_club_cmds": len(unscanned_clubs) + len(clubs_pending),
        },
    }


@router.post("/gap-analysis/fill-queue")
def gap_fill_queue(
    season: Optional[str] = None,
    stale_days: int = 7,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Vul de queue automatisch op basis van de gap-analyse."""
    from datetime import timedelta
    target = season or _get_target_season(session)
    now    = datetime.now(timezone.utc).replace(tzinfo=None)

    pending_cmds = session.exec(
        select(VangerCmd).where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).all()
    pending_params = {
        json.loads(c.params).get("poule_id") or json.loads(c.params).get("external_id")
        for c in pending_cmds
    }

    cutoff = now - timedelta(days=stale_days)
    stale_poules = session.exec(
        select(HockeyPoule)
        .where(HockeyPoule.season == target)
        .where(
            (HockeyPoule.last_scanned_at == None)  # noqa: E711
            | (HockeyPoule.last_scanned_at < cutoff)
        )
    ).all()

    team_by_poule: dict = {}
    for t in session.exec(select(HockeyTeam).where(col(HockeyTeam.recent_poule_id).is_not(None))).all():
        if t.recent_poule_id and t.recent_poule_id not in team_by_poule:
            team_by_poule[t.recent_poule_id] = t

    added_poules = 0
    for poule in stale_poules:
        pid_str = str(poule.poule_id)
        if pid_str in pending_params or poule.poule_id in pending_params:
            continue
        t = team_by_poule.get(poule.poule_id)
        if not t:
            continue
        label = t.name + " — " + (poule.name or f"poule #{poule.poule_id}")
        session.add(VangerCmd(
            cmd_type="get_poule",
            params=json.dumps({"poule_id": poule.poule_id, "team_id": t.team_id, "label": label}),
            created_at=now,
        ))
        added_poules += 1

    unscanned = session.exec(
        select(HockeyClub).where(HockeyClub.detail_loaded == False)  # noqa: E712
    ).all()
    added_clubs = 0
    for c in unscanned:
        if c.external_id not in pending_params:
            session.add(VangerCmd(
                cmd_type="scan_club",
                params=json.dumps({"external_id": c.external_id, "label": c.friendly_name or c.name}),
                created_at=now,
            ))
            added_clubs += 1

    session.commit()
    return {"added_poules": added_poules, "added_clubs": added_clubs, "total": added_poules + added_clubs}


# ── Competition sync ─────────────────────────────────────

@router.post("/competitions/{cid}/sync")
def sync_competition(
    cid: int,
    session: Session = Depends(get_session),
    _=Depends(require_admin),
):
    """Voeg alle poules van een discovery-competitie toe aan de vanger-wachtrij."""
    comp = session.get(HockeyCompetition, cid)
    if not comp:
        raise HTTPException(404, "Competitie niet gevonden")
    poules = session.exec(
        select(HockeyPoule).where(HockeyPoule.competition_id == cid)
    ).all()
    if not poules:
        return {"added": 0, "skipped": 0}

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    pending = session.exec(
        select(VangerCmd).where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).all()
    pending_ids = {
        json.loads(c.params).get("poule_id")
        for c in pending if c.cmd_type == "get_poule"
    }

    added = skipped = 0
    for p in poules:
        if p.poule_id in pending_ids:
            skipped += 1
        else:
            session.add(VangerCmd(
                cmd_type="get_poule",
                params=json.dumps({"poule_id": p.poule_id, "label": p.name}),
                created_at=now,
            ))
            pending_ids.add(p.poule_id)
            added += 1

    session.commit()
    return {"added": added, "skipped": skipped}
