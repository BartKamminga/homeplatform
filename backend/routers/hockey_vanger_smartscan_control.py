"""Hockey vanger — Smart Scan-coordinator + Ghost (headless server-worker) en
Scout (Chrome-extensie) trigger-endpoints - opgesplitst uit hockey_vanger.py
(refactor-plan hockey-inside Fase 3, RFTR-B3). Let op: bestandsnaam wijkt
bewust af van het gelijknamige services/hockey_vanger_smartscan.py om
import-verwarring (module vs. router) te voorkomen."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlmodel import Session

from core.auth import get_current_user
from core.database import get_session
from models.settings import AppSetting
from services.hockey_vanger_scanplan import SKIP_HEALTHY_DAILY_FALLBACK_KEY, run_scan_plan_pass
from services.hockey_vanger_schedule import DEFAULT_HORIZON_DAYS, promote_due_schedule_entries, rebuild_schedule
from services.hockey_vanger_settings import _get_bool_setting, _get_int_setting
from services.hockey_vanger_smartscan import (
    _smart_scan_get_state, _smart_scan_set_state, _smart_scan_discovery_next, SMART_SCAN_MAX_CMDS,
)

router = APIRouter(prefix="/api/hockey", tags=["hockey-vanger"])

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


# ── Ghost (headless server-worker) trigger ────────────────
# De Ghost-container draait continu maar doet pas een login+scan-sessie zodra
# hij hier een trigger vindt. Los van de Scout (Chrome-extensie): beide praten
# met dezelfde cmd-queue/heartbeat-endpoints, wie er het eerst bij is pakt het
# volgende commando op.

GHOST_TRIGGER_KEY        = "ghost_run_requested"
GHOST_ENABLED_KEY        = "ghost_enabled"
SCAN_PLAN_LAST_RUN_KEY   = "profile_scan_last_run_at"
SCAN_PLAN_ENABLED_KEY    = "scan_plan_enabled"


def _ghost_enabled(session: Session) -> bool:
    row = session.get(AppSetting, GHOST_ENABLED_KEY)
    return row.value != "0" if row else True


def _scan_plan_enabled(session: Session) -> bool:
    row = session.get(AppSetting, SCAN_PLAN_ENABLED_KEY)
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
    de enige continu actieve component in dit systeem is — geen aparte scheduler nodig.

    item 1091 (Bart, 4-09-2026: "de ghost had even niets te doen, queue-items
    kwamen niet op tijd binnen... ik wil promote_due_schedule_entries in
    dezelfde tijd laten plaatsvinden als de ghost-timer"): promotie
    (ScanScheduleEntry -> echte VangerCmd) draait daarom nu op ELKE
    should-run-poll, ONGEACHT profile_scan_interval_min - het is een lichte
    query (planned_at <= now, gecapt op STEP_MAX_CMDS), geen reden om 'm aan
    dezelfde trage cadans te binden als de zware rebuild_schedule-stap
    hieronder. Zonder dit kon een net due geworden scanschema-item tot
    profile_scan_interval_min (default 20 min) blijven liggen voor promotie,
    ongeacht hoe kort de onderliggende scan-cadans zelf staat ingesteld -
    ondermijnt met name live-wedstrijd-tracking (items 969/970)."""
    if not _scan_plan_enabled(session):
        return
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    promoted = promote_due_schedule_entries(session, now)
    # Ghost hoeft alleen wakker gemaakt te worden als er ECHT nieuw werk in
    # de queue is gekomen (promoted) - een gereclaimede stale cmd (terug
    # naar 'failed') levert geen nieuwe pending rij op en is dus geen reden.
    if promoted > 0 and _ghost_enabled(session):
        _set_ghost_trigger(session, now)
    session.commit()

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

    # item 1019 (Fase C, cutover): run_scan_plan_pass doet vanaf nu alleen
    # nog _reclaim_stale_in_progress (VangerCmd-hygiene) - de eigenlijke
    # ontdekking/cadans (club_list, new_or_empty, club_scan, landelijke
    # competities, active-profielen, manual_weekly) loopt volledig via het
    # scanschema hieronder (rebuild_schedule + promote_due_schedule_entries
    # hierboven) i.p.v. een parallelle schaduw-verversing naast de (nu
    # buiten dienst gestelde) _step_*-functies.
    run_scan_plan_pass(session)

    horizon_days = _get_int_setting(session, "schedule_horizon_days", DEFAULT_HORIZON_DAYS)
    rebuild_schedule(session, now, horizon_days)
    # item 1091: nogmaals promoveren direct na de rebuild - een rebuild kan
    # entries opleveren met planned_at in het (net) verleden/nu (bv. een
    # net-live-geworden wedstrijd), die anders pas bij de VOLGENDE
    # should-run-poll (~15s later) zouden worden opgepakt i.p.v. meteen.
    promoted_after_rebuild = promote_due_schedule_entries(session, now)
    if promoted_after_rebuild > 0 and _ghost_enabled(session):
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


@router.get("/vanger/ghost/enabled")
def ghost_enabled_check(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Lichtgewicht check zonder trigger-neveneffecten (item 729) - Ghost roept dit
    op elke loop-iteratie aan, ook tijdens een lopende sessie, zodat 'Ghost
    uitschakelen' meteen effect heeft i.p.v. pas na de eerstvolgende idle-timeout."""
    return {"enabled": _ghost_enabled(session)}


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


@router.post("/vanger/scan-plan/toggle")
def scan_plan_toggle(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    enabled = not _scan_plan_enabled(session)
    row = session.get(AppSetting, SCAN_PLAN_ENABLED_KEY)
    value = "1" if enabled else "0"
    if row:
        row.value = value; session.add(row)
    else:
        session.add(AppSetting(key=SCAN_PLAN_ENABLED_KEY, value=value))
    session.commit()
    return {"enabled": enabled}


@router.post("/vanger/scan-plan/skip-healthy-toggle")
def scan_plan_skip_healthy_toggle(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """item 1018/1019: los aan/uit-schakelbaar - een "gezonde" poule/
    competitie (geen onbekende starttijd binnen 7 dagen, geen gespeelde-maar-
    niet-finale wedstrijd) overslaan bij de dagelijkse fallback-cadans van
    actieve profielen. Default AAN; uitzetbaar als het afbreukrisico (een
    verzetting van een verder gezonde, nabije wedstrijd wordt later opgemerkt)
    in de praktijk te groot blijkt. manual_weekly krijgt deze skip altijd,
    los van deze instelling."""
    enabled = not _get_bool_setting(session, SKIP_HEALTHY_DAILY_FALLBACK_KEY, True)
    row = session.get(AppSetting, SKIP_HEALTHY_DAILY_FALLBACK_KEY)
    value = "1" if enabled else "0"
    if row:
        row.value = value; session.add(row)
    else:
        session.add(AppSetting(key=SKIP_HEALTHY_DAILY_FALLBACK_KEY, value=value))
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
