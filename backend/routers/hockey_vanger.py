"""Hockey — queue helpers, vanger cmd-queue, smart scan, gap analysis."""

import json
from datetime import datetime, timedelta, timezone
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
from routers.hockey_capture import _get_target_season
from services.hockey_vanger_filters import (
    DISC_FILTER_AGE, DISC_FILTER_CLUB, DISC_FILTER_CAT, DISC_FILTER_HT, DISC_FILTER_GENDER,
    _AGE_RE_GENERIC, _GENDER_PREFIX, _age_group_of, _apply_gender_filter, _get_queue_filter,
)
from services.hockey_vanger_ingest import (
    _parse_raw_poule, _parse_raw_club, _call_poule_capture, _call_club_detail,
    _call_clubs_list, _call_competition_detail, _call_competitions_list,
)
from services.hockey_vanger_smartscan import (
    _smart_scan_get_state, _smart_scan_set_state, _smart_scan_discovery_next,
    _smart_scan_try_advance, SMART_SCAN_MAX_CMDS,
)
from services.hockey_vanger_scanplan import run_scan_plan_pass

router = APIRouter(prefix="/api/hockey", tags=["hockey-vanger"])

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




# ── Vanger heartbeat / live status ──────────────────────
# Scout (Chrome-extensie) en Ghost (headless server-worker) kunnen tegelijk
# draaien en bedienen dezelfde cmd-queue — elk krijgt daarom een eigen
# status-sleutel i.p.v. elkaars heartbeat te overschrijven.

VANGER_STATUS_KEYS = {"scout": "vanger_status_scout", "ghost": "vanger_status_ghost"}
_EMPTY_STATUS = {"running": False, "mode": None, "task": None, "state": "offline",
                  "done_count": 0, "queue_total": 0, "last_seen": None}


class VangerHeartbeatIn(BaseModel):
    running:     bool
    mode:        Optional[str] = None
    task:        Optional[str] = None
    done_count:  int = 0
    queue_total: int = 0
    client:      str = "scout"  # "scout" (Chrome-extensie) of "ghost" (headless server-worker)
    # "online" | "ingelogd" | "wachten_op_queue" — door de client zelf bepaald,
    # "offline" wordt hieronder altijd afgeleid uit het ontbreken van een
    # recente heartbeat, nooit door de client zelf gerapporteerd.
    state:       str = "online"


@router.post("/vanger/heartbeat")
def vanger_heartbeat(
    body: VangerHeartbeatIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    key = VANGER_STATUS_KEYS.get(body.client, VANGER_STATUS_KEYS["scout"])
    payload = json.dumps({
        "running":     body.running,
        "mode":        body.mode,
        "task":        body.task,
        "state":       body.state,
        "done_count":  body.done_count,
        "queue_total": body.queue_total,
        "client":      body.client,
        "last_seen":   now.isoformat(),
    }, ensure_ascii=False)
    row = session.get(AppSetting, key)
    if row:
        row.value = payload
        session.add(row)
    else:
        session.add(AppSetting(key=key, value=payload))
    session.commit()
    return {"ok": True}


@router.get("/vanger/status")
def get_vanger_status(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    result = {}
    for client, key in VANGER_STATUS_KEYS.items():
        row = session.get(AppSetting, key)
        result[client] = json.loads(row.value) if row and row.value else {**_EMPTY_STATUS, "client": client}
    ghost_row = session.get(AppSetting, GHOST_ENABLED_KEY)
    result["ghost_enabled"] = ghost_row.value != "0" if ghost_row else True
    return result


# ── Vanger instellingen (idle-timeout + navigatie-delay per client) ──
# Eén centrale plek (AppSetting) i.p.v. lokaal per browser/container, zodat
# je 'm op één plek kunt bijstellen voor zowel Scout als Ghost.

SCOUT_IDLE_TIMEOUT_KEY   = "scout_idle_timeout_min"
GHOST_IDLE_TIMEOUT_KEY   = "ghost_idle_timeout_min"
DEFAULT_IDLE_TIMEOUT_MIN = 20

DELAY_KEYS = {
    "scout_delay_min_sec": "scout_delay_min_sec",
    "scout_delay_max_sec": "scout_delay_max_sec",
    "ghost_delay_min_sec": "ghost_delay_min_sec",
    "ghost_delay_max_sec": "ghost_delay_max_sec",
}
DEFAULT_DELAY_MIN_SEC = 10
DEFAULT_DELAY_MAX_SEC = 15

# ── Scan-plan instellingen (item 720: scan-profielen) ────
SCAN_PLAN_DEFAULTS = {
    "club_list_scan_days":         7,
    "club_scan_days":              1,
    "profile_scan_interval_min":   20,
    "match_duration_min":          90,
    "active_daily_fallback_hours": 24,
    "active_matchday_interval_min": 45,
}


def _get_int_setting(session: Session, key: str, default: int) -> int:
    row = session.get(AppSetting, key)
    if row and row.value and row.value.lstrip("-").isdigit():
        return int(row.value)
    return default


def _vanger_settings(session: Session) -> dict:
    result = {
        "scout_idle_timeout_min": _get_int_setting(session, SCOUT_IDLE_TIMEOUT_KEY, DEFAULT_IDLE_TIMEOUT_MIN),
        "ghost_idle_timeout_min": _get_int_setting(session, GHOST_IDLE_TIMEOUT_KEY, DEFAULT_IDLE_TIMEOUT_MIN),
    }
    for key in DELAY_KEYS:
        default = DEFAULT_DELAY_MIN_SEC if key.endswith("_min_sec") else DEFAULT_DELAY_MAX_SEC
        result[key] = _get_int_setting(session, key, default)
    for key, default in SCAN_PLAN_DEFAULTS.items():
        result[key] = _get_int_setting(session, key, default)
    return result


class VangerSettingsIn(BaseModel):
    scout_idle_timeout_min: Optional[int] = None
    ghost_idle_timeout_min: Optional[int] = None
    scout_delay_min_sec:    Optional[int] = None
    scout_delay_max_sec:    Optional[int] = None
    ghost_delay_min_sec:    Optional[int] = None
    ghost_delay_max_sec:    Optional[int] = None
    club_list_scan_days:           Optional[int] = None
    club_scan_days:                Optional[int] = None
    profile_scan_interval_min:     Optional[int] = None
    match_duration_min:            Optional[int] = None
    active_daily_fallback_hours:   Optional[int] = None
    active_matchday_interval_min:  Optional[int] = None


@router.get("/vanger/settings")
def get_vanger_settings(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    return _vanger_settings(session)


@router.post("/vanger/settings")
def update_vanger_settings(
    body: VangerSettingsIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    pairs = [
        (SCOUT_IDLE_TIMEOUT_KEY, body.scout_idle_timeout_min),
        (GHOST_IDLE_TIMEOUT_KEY, body.ghost_idle_timeout_min),
        ("scout_delay_min_sec", body.scout_delay_min_sec),
        ("scout_delay_max_sec", body.scout_delay_max_sec),
        ("ghost_delay_min_sec", body.ghost_delay_min_sec),
        ("ghost_delay_max_sec", body.ghost_delay_max_sec),
        ("club_list_scan_days", body.club_list_scan_days),
        ("club_scan_days", body.club_scan_days),
        ("profile_scan_interval_min", body.profile_scan_interval_min),
        ("match_duration_min", body.match_duration_min),
        ("active_daily_fallback_hours", body.active_daily_fallback_hours),
        ("active_matchday_interval_min", body.active_matchday_interval_min),
    ]
    for key, val in pairs:
        if val is None:
            continue
        val = max(1, int(val))
        row = session.get(AppSetting, key)
        if row:
            row.value = str(val); session.add(row)
        else:
            session.add(AppSetting(key=key, value=str(val)))
    session.commit()
    return _vanger_settings(session)


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
    # Meta wordt hieronder verrijkt met geparste velden (competitie, poule-
    # naam, teamtelling, ...) zodra de parse-stap succesvol was — anders
    # toont het Archief-tabblad voor elke capture alleen een generieke titel
    # (item 708). Basisversie hier, aangevuld/geschreven na de parse-stap.
    archive_meta = {"label": result_label, "cmd_id": cmd_id}

    try:
        if cmd.cmd_type == "get_poule":
            capture_body = _parse_raw_poule(body.raw, params, _get_target_season(session))
            if capture_body:
                poule_sum = _call_poule_capture(capture_body, session)
                if poule_sum:
                    summary_data.update(poule_sum)
                archive_meta.update({
                    "competition":       capture_body.competition_name,
                    "poule_name":        capture_body.poule_name,
                    "class_name":        capture_body.class_name,
                    "team_count":        len(capture_body.teams_in_poule),
                    "matches_played":    sum(1 for m in (capture_body.matches_data or []) if m.status == "finished"),
                    "matches_remaining": sum(1 for m in (capture_body.matches_data or []) if m.status != "finished"),
                })
            else:
                summary_data["parse_failed"] = True
        elif cmd.cmd_type == "scan_club":
            detail_body = _parse_raw_club(body.raw, params)
            if detail_body:
                club_sum = _call_club_detail(detail_body, session)
                if club_sum:
                    summary_data.update(club_sum)
                archive_meta.update({
                    "name":     detail_body.friendly_name or detail_body.name,
                    "city":     detail_body.city,
                    "district": detail_body.district,
                    "teams":    len(detail_body.teams),
                })
            else:
                summary_data["parse_failed"] = True
        elif cmd.cmd_type == "get_clubs":
            clubs_raw  = body.raw if isinstance(body.raw, dict) else {}
            clubs_list = clubs_raw.get("clubs") or clubs_raw.get("data")
            if isinstance(clubs_list, list):
                clubs_sum = _call_clubs_list(clubs_list, session)
                if clubs_sum:
                    summary_data.update(clubs_sum)
                archive_meta["clubs_count"] = len(clubs_list)
            else:
                summary_data["parse_failed"] = True
        elif cmd.cmd_type == "get_competition_detail":
            comp_raw = body.raw if isinstance(body.raw, dict) else {}
            comp_sum = _call_competition_detail(comp_raw, session, params)
            if comp_sum:
                summary_data.update(comp_sum)
                archive_meta.update({
                    "competition":  comp_sum.get("competition"),
                    "poule_count":  comp_sum.get("poules_processed"),
                })
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

    if not already:
        session.add(DataCapture(
            id=new_uuid(),
            source="hockey-vanger",
            capture_type=archive_type,
            external_id=archive_ext,
            session_id=session_key,
            payload=json.dumps(body.raw, ensure_ascii=False),
            meta=json.dumps(archive_meta, ensure_ascii=False),
            captured_at=now,
        ))

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


# ── Ghost (headless server-worker) trigger ────────────────
# De Ghost-container draait continu maar doet pas een login+scan-sessie zodra
# hij hier een trigger vindt. Los van de Scout (Chrome-extensie): beide praten
# met dezelfde cmd-queue/heartbeat-endpoints, wie er het eerst bij is pakt het
# volgende commando op.

GHOST_TRIGGER_KEY        = "ghost_run_requested"
GHOST_ENABLED_KEY        = "ghost_enabled"
SCAN_PLAN_LAST_RUN_KEY   = "profile_scan_last_run_at"


def _ghost_enabled(session: Session) -> bool:
    row = session.get(AppSetting, GHOST_ENABLED_KEY)
    return row.value != "0" if row else True


def _set_ghost_trigger(session: Session, now: datetime):
    row = session.get(AppSetting, GHOST_TRIGGER_KEY)
    if row:
        row.value = now.isoformat(); session.add(row)
    else:
        session.add(AppSetting(key=GHOST_TRIGGER_KEY, value=now.isoformat()))


def _maybe_run_scan_plan_pass(session: Session):
    """Draait de scan-plan-pass (item 720) op eigen cadans, los van de handmatige
    Ghost-trigger. Piggybackt op de al-bestaande poll van Ghost (elke ~15s) omdat dat
    de enige continu actieve component in dit systeem is — geen aparte scheduler nodig."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    interval_min = _get_int_setting(session, "profile_scan_interval_min", 20)
    row = session.get(AppSetting, SCAN_PLAN_LAST_RUN_KEY)
    last_run = None
    if row and row.value:
        try:
            last_run = datetime.fromisoformat(row.value)
        except ValueError:
            last_run = None
    if last_run and now - last_run < timedelta(minutes=interval_min):
        return
    if row:
        row.value = now.isoformat(); session.add(row)
    else:
        session.add(AppSetting(key=SCAN_PLAN_LAST_RUN_KEY, value=now.isoformat()))
    session.commit()

    result = run_scan_plan_pass(session)
    if result.get("added", 0) > 0 and _ghost_enabled(session):
        _set_ghost_trigger(session, now)
        session.commit()


@router.post("/vanger/ghost/trigger")
def ghost_trigger(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    row = session.get(AppSetting, GHOST_TRIGGER_KEY)
    if row:
        row.value = now.isoformat(); session.add(row)
    else:
        session.add(AppSetting(key=GHOST_TRIGGER_KEY, value=now.isoformat()))
    session.commit()
    return {"ok": True}


@router.get("/vanger/ghost/should-run")
def ghost_should_run(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    _maybe_run_scan_plan_pass(session)
    if not _ghost_enabled(session):
        # Trigger blijft staan tot Ghost weer aangezet wordt — geen run
        # "verliezen" alleen omdat hij tijdelijk uitgeschakeld was.
        return {"should_run": False}
    row = session.get(AppSetting, GHOST_TRIGGER_KEY)
    if row and row.value:
        row.value = ""
        session.add(row)
        session.commit()
        return {"should_run": True}
    return {"should_run": False}


@router.post("/vanger/ghost/toggle")
def ghost_toggle(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    enabled = not _ghost_enabled(session)
    row = session.get(AppSetting, GHOST_ENABLED_KEY)
    value = "1" if enabled else "0"
    if row:
        row.value = value; session.add(row)
    else:
        session.add(AppSetting(key=GHOST_ENABLED_KEY, value=value))
    session.commit()
    return {"enabled": enabled}


# ── Scout (Chrome-extensie) remote-start ──────────────────
# Zelfde trigger-patroon als Ghost, zodat de webpagina de Scout ook kan
# starten zodra die online is. De bestaande "Start Vanger"-knop in de
# popup zelf blijft gewoon werken — dit is een tweede manier, geen vervanging.

SCOUT_TRIGGER_KEY = "scout_run_requested"


@router.post("/vanger/scout/trigger")
def scout_trigger(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    row = session.get(AppSetting, SCOUT_TRIGGER_KEY)
    if row:
        row.value = now.isoformat(); session.add(row)
    else:
        session.add(AppSetting(key=SCOUT_TRIGGER_KEY, value=now.isoformat()))
    session.commit()
    return {"ok": True}


@router.get("/vanger/scout/should-run")
def scout_should_run(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    row = session.get(AppSetting, SCOUT_TRIGGER_KEY)
    if row and row.value:
        row.value = ""
        session.add(row)
        session.commit()
        return {"should_run": True}
    return {"should_run": False}


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

    standing_ids = set(session.exec(
        select(HockeyPouleStanding.poule_id).where(col(HockeyPouleStanding.poule_id).in_(list(poule_ids)))
    ).all())
    match_ids = set(session.exec(
        select(HockeyPouleMatch.poule_id).where(col(HockeyPouleMatch.poule_id).in_(list(poule_ids)))
    ).all())

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
