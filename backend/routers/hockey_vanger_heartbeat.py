"""Hockey vanger — Scout/Ghost heartbeat + live-status + vanger-instellingen
(idle-timeout/navigatie-delay/scan-plan-tuning) - opgesplitst uit
hockey_vanger.py (refactor-plan hockey-inside Fase 3, RFTR-B3)."""

import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session

from core.auth import get_current_user
from core.database import get_session
from models.settings import AppSetting
from routers.hockey_vanger_smartscan_control import (
    GHOST_ENABLED_KEY, SCAN_PLAN_ENABLED_KEY,
)
from services.hockey_vanger_scanplan import ACTIVE_MATCHDAY_ENABLED_KEY
from services.hockey_vanger_settings import NOTIFY_TEAM_IDS_KEY, _get_int_setting, _get_str_setting

router = APIRouter(prefix="/api/hockey", tags=["hockey-vanger"])

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
    scan_plan_row = session.get(AppSetting, SCAN_PLAN_ENABLED_KEY)
    result["scan_plan_enabled"] = scan_plan_row.value != "0" if scan_plan_row else True
    matchday_row = session.get(AppSetting, ACTIVE_MATCHDAY_ENABLED_KEY)
    result["active_matchday_enabled"] = matchday_row.value != "0" if matchday_row else True
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
    "stale_cmd_timeout_min":       10,
}


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
    result["notify_team_ids"] = _get_str_setting(session, NOTIFY_TEAM_IDS_KEY, "")
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
    stale_cmd_timeout_min:         Optional[int] = None
    notify_team_ids:               Optional[str] = None  # item 1001: comma-gescheiden hockey.nl team_ids


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
        ("stale_cmd_timeout_min", body.stale_cmd_timeout_min),
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

    if body.notify_team_ids is not None:
        cleaned = ",".join(p.strip() for p in body.notify_team_ids.split(",") if p.strip())
        row = session.get(AppSetting, NOTIFY_TEAM_IDS_KEY)
        if row:
            row.value = cleaned; session.add(row)
        else:
            session.add(AppSetting(key=NOTIFY_TEAM_IDS_KEY, value=cleaned))

    session.commit()
    return _vanger_settings(session)
