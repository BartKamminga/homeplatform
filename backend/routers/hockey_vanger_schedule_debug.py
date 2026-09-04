"""Debug-pagina voor het SCANSCHEMA (ScanScheduleEntry, item 1015) - niet te
verwarren met de echte uitvoeringsqueue (VangerCmd, zie
hockey_vanger_cmd_queue_debug.py). Puur lezend op 1 uitzondering na: de
handmatige rebuild-trigger (Bart, 30-08-2026: "kan er niet een button komen
dan ik het zelf kan doen?") - herberekent alleen de PREVIEW
(ScanScheduleEntry), muteert geen echte wedstrijd-/team-data en start geen
enkele hockey.nl-scan (dat blijft scan_plan_enabled/ghost_enabled)."""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.hockey_discovery import (
    HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyTeam, ScanScheduleEntry,
)
from routers.hockey_vanger_smartscan_control import _ghost_enabled, _set_ghost_trigger
from services.hockey_vanger_filters import DISC_FILTER_AGE, DISC_FILTER_CAT, DISC_FILTER_CLUB, DISC_FILTER_GENDER, DISC_FILTER_HT, _cmd_matches_filter, _get_queue_filter
from services.hockey_vanger_scanplan import _manual_scan_weekday, _match_dt_info
from services.hockey_vanger_schedule import (
    DEFAULT_HORIZON_DAYS, _cadence_events, _landelijke_daily_fallback_events, _poule_daily_fallback_events,
    _poule_matchday_events, _poule_unknown_start_events, build_schedule_events, promote_due_schedule_entries,
    rebuild_schedule,
)
from services.hockey_vanger_settings import (
    PHASE_LABELS, _get_int_setting, candidate_settings_scope, get_season_phases, get_target_season, is_zaal_active,
)

router = APIRouter(prefix="/api/hockey", tags=["hockey-vanger"])

VALID_STATUSES = {"planned", "promoted", "cancelled"}
VALID_REASONS = {
    "match_start_check", "match_end_check", "retry_match_end", "match_live", "daily_fallback",
    "manual_weekly", "unknown_start_recheck", "new_or_empty", "club_scan", "club_list",
}
VALID_TARGET_TYPES = {"poule", "competition", "club"}

WEEKDAY_NAMES_NL = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag"]


def _ago(dt: Optional[datetime], now: datetime) -> str:
    if not dt:
        return "nog nooit gescand"
    delta = now - dt
    hours = delta.total_seconds() / 3600
    if hours < 48:
        return f"{hours:.0f}u geleden"
    return f"{hours / 24:.0f}d geleden"


def _health_detail(session: Session, poule_id: int, now: datetime) -> Optional[str]:
    """Zelfde regels als services/hockey_vanger_scanplan.py::_poule_health,
    maar dan met de CONCRETE wedstrijd erbij (Bart, 31-08-2026: 'waarom
    scannen we dit? is die poule niet vers meer? missen er wedstrijden?') -
    _poule_health zelf geeft alleen booleans terug, hier willen we juist
    weten WELKE wedstrijd de poule 'ongezond' maakt. Eerste match die een
    vlag triggert wint (net als de badge, geen uitputtende lijst)."""
    match_duration_m = _get_int_setting(session, "match_duration_min", 90)
    lookahead_end = (now + timedelta(days=7)).date()
    matches = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule_id)).all()
    if not matches:
        # item 1019 (Bart, 31-08-2026, prod-melding): een poule zonder ENIGE
        # bekende wedstrijd is niet "bewezen gezond" (zie _is_healthy in
        # hockey_vanger_scanplan.py) en blijft dus terugkomen - dat moet hier
        # ook zichtbaar zijn, anders lijkt de uitleg stil/onvolledig terwijl
        # de reden wel degelijk klopt.
        return "Nog geen enkele wedstrijd bekend voor deze poule (mist zowel uitslagen als tijden)."
    for m in matches:
        if not m.match_date:
            continue
        info = _match_dt_info(m.match_date)
        if not info:
            continue
        utc_naive, _is_today, is_midnight = info
        label = f"{m.home_team_name} - {m.away_team_name}".strip(" -") or f"match {m.match_id}"
        if is_midnight:
            if now.date() <= utc_naive.date() <= lookahead_end:
                return f"{label} op {utc_naive.strftime('%d-%m')} nog zonder starttijd."
            continue
        end = utc_naive + timedelta(minutes=match_duration_m)
        if end < now and m.status != "final":
            return f"{label} van {utc_naive.strftime('%d-%m')} nog zonder eindstand (status: {m.status})."
    return None


def _explain_reason(
    session: Session, entry: ScanScheduleEntry, comp_for_poule: Optional[HockeyCompetition],
    poule: Optional[HockeyPoule], now: datetime,
) -> str:
    """Vertaalt de bare reason-code (bv. 'manual_weekly') naar de daadwerkelijk
    berekende aanleiding (Bart, 31-08-2026: 'manual_weekly geeft mij te weinig
    info') - reconstrueert dezelfde instellingen/regels als hockey_vanger_
    scanplan.py/hockey_vanger_schedule.py, puur voor weergave (geen
    bijwerkingen, geen invloed op de echte planning)."""
    reason = entry.reason
    if reason == "manual_weekly":
        if not comp_for_poule:
            return "Wekelijkse ronde (niet-autoscan-competitie)."
        weekday = _manual_scan_weekday(comp_for_poule.id)
        weekday_nl = WEEKDAY_NAMES_NL[weekday]
        last = poule.last_scanned_at if poule else None
        base = f"Wekelijkse ronde op {weekday_nl} - {_ago(last, now)} (cutoff 6 dagen)."
        detail = _health_detail(session, entry.target_id, now) if poule else None
        return f"{base} {detail}" if detail else base
    if reason == "daily_fallback":
        daily_fallback_h = _get_int_setting(session, "active_daily_fallback_hours", 24)
        last = poule.last_scanned_at if poule else None
        base = f"Dagelijkse fallback-cadans ({daily_fallback_h}u) - {_ago(last, now)}."
        detail = _health_detail(session, entry.target_id, now) if poule else None
        return f"{base} {detail}" if detail else base
    if reason == "unknown_start_recheck":
        lookahead_d = _get_int_setting(session, "unknown_start_lookahead_days", 5)
        fallback_h = _get_int_setting(session, "unknown_start_fallback_hours", 8)
        last = poule.last_scanned_at if poule else None
        return f"Wedstrijd bekend zonder starttijd binnen {lookahead_d} dagen - hercheck elke {fallback_h}u ({_ago(last, now)})."
    if reason == "match_end_check":
        return "Wedstrijd van vandaag naar verwachting afgelopen, nog geen definitieve uitslag bekend (eerste check)."
    if reason == "retry_match_end":
        retry_m = _get_int_setting(session, "retry_match_end_min", 10)
        return f"Eerdere check na het einde leverde nog geen definitieve uitslag - hercheck elke {retry_m} min."
    if reason == "match_start_check":
        delay_m = _get_int_setting(session, "live_check_delay_min", 15)
        return f"Wedstrijd van vandaag is {delay_m} min geleden begonnen - check of hij inmiddels live staat."
    if reason == "match_live":
        retry_m = _get_int_setting(session, "retry_match_end_min", 10)
        return f"Wedstrijd bevestigd live - hercheck elke {retry_m} min totdat de wedstrijd is afgelopen."
    if reason == "new_or_empty":
        return "Nieuw ontdekt (nog geen data bekend) - directe eerste scan."
    if reason == "club_scan":
        days = _get_int_setting(session, "club_scan_days", 1)
        return f"Periodieke clubdetail-herscan (cadans {days} dag(en))."
    if reason == "club_list":
        days = _get_int_setting(session, "club_list_scan_days", 7)
        return f"Periodieke volledige clublijst-herscan (cadans {days} dagen)."
    return "-"


def _iso(dt) -> Optional[str]:
    return dt.isoformat() + "Z" if dt else None


def _label_for(
    entry: ScanScheduleEntry, params: dict, poule_by_id: dict, comp_by_hl_id: dict, club_by_id: dict,
    comp_by_id: dict,
) -> str:
    if entry.target_type == "poule":
        poule = poule_by_id.get(entry.target_id)
        if poule:
            # item 1019 (Bart, 31-08-2026: "graag ook competitie noemen") -
            # HockeyPoule.competition_id wijst naar de interne PK, een ANDER
            # sleutelveld dan comp_by_hl_id (die is voor target_type=
            # 'competition', geindexeerd op hl_comp_id) - vandaar de aparte
            # comp_by_id-lookup.
            comp = comp_by_id.get(poule.competition_id)
            comp_label = f"{comp.name} · " if comp else ""
            return f"{comp_label}{poule.name} · poule {entry.target_id}"
        # new_or_empty-poules zijn per definitie nog niet gescand/ontdekt (het
        # team verwijst er al naar via recent_poule_id, maar er is nog geen
        # HockeyPoule-rij) - "onbekend/verwijderd" was hier misleidend, params
        # bevat meestal al de teamnaam als label.
        if params.get("label"):
            return f"{params['label']} (nog niet ontdekt) · poule {entry.target_id}"
        return f"poule {entry.target_id} (nog niet ontdekt)"
    if entry.target_type == "competition":
        comp = comp_by_hl_id.get(entry.target_id)
        if comp:
            return comp.name
        return params.get("label") or f"competitie {entry.target_id} (onbekend)"
    if entry.target_type == "club":
        club = club_by_id.get(entry.target_id)
        if club:
            return club.friendly_name or club.name
        return params.get("label") or f"club {entry.target_id}"
    return str(entry.target_id)


@router.get("/vanger/schedule/browse")
def browse_schedule(
    status: Optional[str] = None,
    reason: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    date: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Filterbare, gepagineerde lijst van het scanschema (ScanScheduleEntry) -
    de vooraf berekende, toekomstgerichte planning (Fase A, schaduw-modus),
    los van de echte uitvoeringsqueue (VangerCmd). date/target_id maken het
    mogelijk om vanuit de Kalender-tab direct door te linken naar "wat staat
    er gepland voor DEZE dag/poule" (item: link vanaf de kalender-rij)."""
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    query = select(ScanScheduleEntry)
    if status in VALID_STATUSES:
        query = query.where(ScanScheduleEntry.status == status)
    if reason in VALID_REASONS:
        query = query.where(ScanScheduleEntry.reason == reason)
    if target_type in VALID_TARGET_TYPES:
        query = query.where(ScanScheduleEntry.target_type == target_type)
    if target_id is not None:
        query = query.where(ScanScheduleEntry.target_id == target_id)
    if date:
        try:
            day_start = datetime.fromisoformat(date)
            day_end = day_start + timedelta(days=1)
            query = query.where(ScanScheduleEntry.planned_at >= day_start).where(ScanScheduleEntry.planned_at < day_end)
        except ValueError:
            pass
    query = query.order_by(col(ScanScheduleEntry.planned_at).asc())

    matching = session.exec(query).all()

    poule_ids = {e.target_id for e in matching if e.target_type == "poule"}
    comp_ids = {e.target_id for e in matching if e.target_type == "competition"}
    club_ids = {e.target_id for e in matching if e.target_type == "club"}
    poule_by_id = {p.poule_id: p for p in session.exec(
        select(HockeyPoule).where(col(HockeyPoule.poule_id).in_(poule_ids))
    ).all()} if poule_ids else {}
    comp_by_hl_id = {c.hl_comp_id: c for c in session.exec(
        select(HockeyCompetition).where(col(HockeyCompetition.hl_comp_id).in_(comp_ids))
    ).all()} if comp_ids else {}
    club_by_id = {c.id: c for c in session.exec(
        select(HockeyClub).where(col(HockeyClub.id).in_(club_ids))
    ).all()} if club_ids else {}
    # item 1019 (Bart, 31-08-2026): competitienaam bij een poule-entry -
    # HockeyPoule.competition_id is de interne PK, dus een aparte lookup
    # los van comp_by_hl_id (die is geindexeerd op hl_comp_id).
    poule_comp_ids = {p.competition_id for p in poule_by_id.values() if p.competition_id}
    comp_by_id = {c.id: c for c in session.exec(
        select(HockeyCompetition).where(col(HockeyCompetition.id).in_(poule_comp_ids))
    ).all()} if poule_comp_ids else {}

    params_by_id = {}
    for e in matching:
        try:
            params_by_id[e.id] = json.loads(e.params)
        except (ValueError, TypeError):
            params_by_id[e.id] = {}

    if search:
        needle = search.lower()
        matching = [
            e for e in matching
            if needle in e.params.lower()
            or needle in _label_for(e, params_by_id[e.id], poule_by_id, comp_by_hl_id, club_by_id, comp_by_id).lower()
        ]
    total = len(matching)
    page = matching[offset:offset + limit]

    # Fase C, item 1015: een 'cancelled'-entry kan 2 oorzaken hebben -
    # onparseerbare params (zeldzaam) of buiten het queue-filter gevallen
    # bij promotie. Net als bij de Vanger-queue-debug (filtered_out) wordt
    # dit dynamisch herberekend i.p.v. opgeslagen, zodat het altijd de
    # HUIDIGE filterinstelling weerspiegelt.
    ages, club, cats, hts, genders = _get_queue_filter(session)
    now = datetime.utcnow()

    items = []
    for entry in page:
        params = params_by_id[entry.id]
        filtered_out = (
            entry.status == "cancelled" and bool(params)
            and not _cmd_matches_filter(session, entry.cmd_type, params, ages, club, cats, hts, genders)
        )
        poule = poule_by_id.get(entry.target_id) if entry.target_type == "poule" else None
        comp_for_poule = comp_by_id.get(poule.competition_id) if poule else None
        items.append({
            "id": entry.id,
            "target_type": entry.target_type,
            "target_id": entry.target_id,
            "label": _label_for(entry, params, poule_by_id, comp_by_hl_id, club_by_id, comp_by_id),
            "explanation": _explain_reason(session, entry, comp_for_poule, poule, now),
            "cmd_type": entry.cmd_type,
            "params": params,
            "planned_at": _iso(entry.planned_at),
            "reason": entry.reason,
            "status": entry.status,
            "filtered_out": filtered_out,
            "vanger_cmd_id": entry.vanger_cmd_id,
            "created_at": _iso(entry.created_at),
        })
    return {"total": total, "items": items}


@router.get("/vanger/schedule/summary")
def schedule_summary(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Aantal scanschema-rijen per status en per reason - snel overzicht
    zonder alles te hoeven ophalen/pagineren."""
    entries = session.exec(select(ScanScheduleEntry)).all()
    by_status: dict = {}
    by_reason: dict = {}
    for e in entries:
        by_status[e.status] = by_status.get(e.status, 0) + 1
        if e.status == "planned":
            by_reason[e.reason] = by_reason.get(e.reason, 0) + 1
    return {"total": len(entries), "by_status": by_status, "by_reason_planned": by_reason}


@router.post("/vanger/schedule/rebuild")
def rebuild_schedule_now(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Handmatige rebuild-trigger (Bart, 30-08-2026) - vult dezelfde rol als
    de periodieke rebuild in _maybe_run_scan_plan_pass, maar dan on-demand,
    zodat de Debug-tab niet stale blijft zolang scan_plan_enabled=0 (die
    periodieke pass draait dan niet vanzelf). Herberekent alleen de
    scanschema-PREVIEW, geen echte scan - safe om te draaien ongeacht ghost_
    enabled/scan_plan_enabled."""
    now = datetime.utcnow()
    horizon_days = _get_int_setting(session, "schedule_horizon_days", DEFAULT_HORIZON_DAYS)
    count = rebuild_schedule(session, now, horizon_days)
    return {"ok": True, "rebuilt_at": now.isoformat() + "Z", "event_count": count}


# item 1032 (Bart, 1-09-2026: "wil je dat ik de versnel-knop een eigen,
# hogere cap geeft... zodat een bewuste handmatige actie ook echt in 1 klik
# een grotere batch kan wegwerken?" - ja) - los van STEP_MAX_CMDS (=10, blijft
# ongewijzigd voor de automatische periodieke pass, bewust laag om een acc-
# incident van 900-promoties-in-1x te voorkomen). Een handmatige klik is een
# bewuste, eenmalige actie - geen reden om die aan dezelfde behoudende cap
# te binden.
MANUAL_PROMOTE_CAP = 200


@router.post("/vanger/schedule/promote-now")
def promote_schedule_now(
    within_hours: int = 0,
    mode: str = "hours",
    limit: Optional[int] = None,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """item 1026 (Bart, 31-08-2026: "handmatig versnellen van de queue moet
    mogelijk zijn") - forceert de PROMOTIE-stap (ScanScheduleEntry -> echte
    VangerCmd) meteen, i.p.v. te wachten op de eerstvolgende periodieke
    cyclus (profile_scan_interval_min, standaard 20 min, via Ghost's poll
    - zie _maybe_run_scan_plan_pass). In tegenstelling tot de rebuild-knop
    hierboven heeft dit wel een echt effect: due entries komen in de vanger-
    queue terecht en Ghost wordt (indien nodig) wakker gemaakt, precies zoals
    de periodieke pass dat ook zou doen - geen aparte scan-logica, alleen
    eerder aangeroepen. Gecapt op MANUAL_PROMOTE_CAP per aanroep - hoger dan
    de STEP_MAX_CMDS die de automatische periodieke pass gebruikt, want dit
    is een bewuste, eenmalige handmatige actie (Bart, 1-09-2026) - bij een
    achterstand groter dan die cap is opnieuw klikken nog steeds nodig, maar
    minder snel dan met de lage automatische cap.

    item 1032 (Bart, 1-09-2026, na uitgebreide discussie over welke items
    uberhaupt vroeger dan hun natuurlijke planned_at mogen): 'echt
    tijdgebonden items (start/end/live) niet noodzakelijkerwijs EERDER
    uitgevoerd... alleen poules met missende starttijden, clubs/club zaken' -
    promote_due_schedule_entries's ACCELERATABLE_REASONS-whitelist
    (unknown_start_recheck/club_scan/club_list/new_or_empty) zorgt hier al
    voor; deze endpoint hoeft zelf geen whitelist-logica te kennen, alleen de
    juiste cutoff/limit door te geven. Modes:
    - 'hours' (default): cutoff = nu + within_hours (0 = alleen wat al due is).
    - 'tomorrow': cutoff = einde van morgen (kalenderdag-gebaseerd, niet rollend).
    - 'until_next_start_check': cutoff = het eerstvolgende geplande
      match_start_check-moment - een natuurlijke grens i.p.v. een arbitraire
      tijdsduur (Bart: 'of alles tot de eerste wedstrijd start check').
    - 'count': promoot de eerstvolgende `limit` promoveerbare items
      (op planned_at gesorteerd), ongeacht hoe ver vooruit dat reikt
      (Bart: 'misschien is het eenvoudiger promoot de volgende x items')."""
    now = datetime.utcnow()
    if mode == "count":
        n = limit or 1
        # cap moet ruim boven n liggen - promote_due_schedule_entries haalt
        # een kandidatenpool van maximaal `cap` rijen op en filtert daarna
        # pas de niet-versnelbare reasons eruit, dus bij een hoog aandeel
        # niet-whitelisted items ertussen is n zelf te krap.
        promoted = promote_due_schedule_entries(
            session, now, cap=max(MANUAL_PROMOTE_CAP, n * 5), limit_promoted=n,
        )
    else:
        if mode == "tomorrow":
            tomorrow = now + timedelta(days=1)
            cutoff = tomorrow.replace(hour=23, minute=59, second=59, microsecond=0)
        elif mode == "until_next_start_check":
            next_start = session.exec(
                select(ScanScheduleEntry)
                .where(ScanScheduleEntry.status == "planned")
                .where(ScanScheduleEntry.reason == "match_start_check")
                .where(ScanScheduleEntry.planned_at >= now)
                .order_by(col(ScanScheduleEntry.planned_at).asc())
            ).first()
            cutoff = next_start.planned_at if next_start else now
        else:
            cutoff = now + timedelta(hours=within_hours) if within_hours > 0 else now
        promoted = promote_due_schedule_entries(session, now, cap=MANUAL_PROMOTE_CAP, pull_forward_until=cutoff)
    if promoted > 0 and _ghost_enabled(session):
        _set_ghost_trigger(session, now)
        session.commit()
    return {"ok": True, "promoted": promoted}


# ── item 1084: scan-plan preview + shadow-run ───────────────────────────────
# Puur illustratief/lezend (net als de rest van dit bestand) - de candidate-
# settings uit de request worden nooit gecommit (candidate_settings_scope
# rollt altijd terug), en de gefabriceerde team/poule/competitie/match-
# objecten hierbeneden worden nooit aan de sessie toegevoegd (geen
# session.add()). Doel: dezelfde UX als de HTML-mockup die samen met Bart is
# doorontwikkeld (4-09-2026), maar gevoed door de ECHTE event-generators
# i.p.v. een JS-herberekening - zelfde reden als DagView.jsx destijds van
# clientside herberekening naar echte backend-scanschema-data overstapte.

PREVIEW_TEAM_ID = -1001
PREVIEW_POULE_ID = -1001
PREVIEW_COMP_ID = -1001


def _preview_team_poule() -> tuple:
    team = HockeyTeam(
        team_id=PREVIEW_TEAM_ID, club_external_id="preview", name="Preview HC 1",
        short_name="MO18-1", hockey_type="VE", category_group_name="Junioren",
    )
    poule = HockeyPoule(poule_id=PREVIEW_POULE_ID, name="Preview-poule", competition_id=PREVIEW_COMP_ID, season="preview")
    return team, poule


def _preview_match(match_date: datetime, status: str = "") -> HockeyPouleMatch:
    return HockeyPouleMatch(
        poule_id=PREVIEW_POULE_ID, match_id=-1, home_team_id=PREVIEW_TEAM_ID, home_team_name="Preview thuis",
        away_team_id=-2, away_team_name="Preview uit", match_date=match_date.isoformat(), status=status,
    )


def _tick(e: dict, ghost: bool = False, note: Optional[str] = None) -> dict:
    out = {"planned_at": _iso(e["planned_at"]), "reason": e["reason"], "ghost": ghost}
    if note:
        out["note"] = note
    return out


def _next_manual_weekly_tick(now: datetime, horizon_end: datetime, comp_id: int, window_start_h: int) -> Optional[datetime]:
    """Reproduceert de dagselectie uit _manual_weekly_events (hockey_vanger_
    schedule.py) voor 1 gefabriceerde competitie, i.p.v. alle manual-
    competities in de sessie te doorlopen - puur voor de illustratieve
    preview, zelfde formule (_manual_scan_weekday)."""
    target_wd = _manual_scan_weekday(comp_id)
    day = now.replace(hour=window_start_h, minute=0, second=0, microsecond=0)
    if day < now:
        day += timedelta(days=1)
    while day.weekday() != target_wd:
        day += timedelta(days=1)
        if day > horizon_end:
            return None
    return day if day <= horizon_end else None


def _preview_match_rows(session: Session, now: datetime, scenario: str) -> List[dict]:
    match_duration_m    = _get_int_setting(session, "match_duration_min", 90)
    retry_match_end_m   = _get_int_setting(session, "retry_match_end_min", 10)
    live_check_delay_m  = _get_int_setting(session, "live_check_delay_min", 15)
    burst_stop_h         = _get_int_setting(session, "burst_stop_hours_after_last_match", 2)
    window_start_h       = _get_int_setting(session, "scan_window_start_hour", 9)

    team, poule = _preview_team_poule()
    horizon_end = now + timedelta(days=7)
    past: List[dict] = []
    start_check_offset = timedelta(minutes=live_check_delay_m)

    bars = []
    if scenario == "normal":
        match_start = now + timedelta(minutes=20)
        poule.last_scanned_at = None
        match = _preview_match(match_start)
        bars = [{"from": _iso(match_start), "to": _iso(match_start + timedelta(minutes=match_duration_m)), "label": "Wedstrijd"}]
        autoscan_ticks = [_tick(e) for e in _poule_matchday_events(
            poule, team, [match], now, horizon_end, match_duration_m, retry_match_end_m, live_check_delay_m, burst_stop_h,
        )]
    elif scenario == "never_live":
        match_start = now - start_check_offset - timedelta(minutes=5)
        poule.last_scanned_at = None
        match = _preview_match(match_start)
        bars = [{"from": _iso(match_start), "to": _iso(match_start + timedelta(minutes=match_duration_m)), "label": "Wedstrijd"}]
        past.append({"planned_at": _iso(match_start + start_check_offset), "reason": "match_start_check", "note": "geweest - geen live gemeld"})
        autoscan_ticks = [_tick(e) for e in _poule_matchday_events(
            poule, team, [match], now, horizon_end, match_duration_m, retry_match_end_m, live_check_delay_m, burst_stop_h,
        )]
    elif scenario == "live_confirmed":
        match_start = now - start_check_offset - timedelta(minutes=5)
        poule.last_scanned_at = None
        match = _preview_match(match_start, status="live")
        bars = [{"from": _iso(match_start), "to": _iso(match_start + timedelta(minutes=match_duration_m)), "label": "Wedstrijd"}]
        past.append({"planned_at": _iso(match_start + start_check_offset), "reason": "match_start_check", "note": "bevestigd live"})
        autoscan_ticks = [_tick(e) for e in _poule_matchday_events(
            poule, team, [match], now, horizon_end, match_duration_m, retry_match_end_m, live_check_delay_m, burst_stop_h,
        )]
    elif scenario == "runs_over":
        match_start = now - timedelta(minutes=match_duration_m + 5)
        match_end = match_start + timedelta(minutes=match_duration_m)
        poule.last_scanned_at = match_end + timedelta(minutes=1)
        match = _preview_match(match_start)
        bars = [{"from": _iso(match_start), "to": _iso(match_end), "label": "Wedstrijd"}]
        past.append({"planned_at": _iso(match_start + start_check_offset), "reason": "match_start_check", "note": "geweest"})
        past.append({"planned_at": _iso(match_end), "reason": "match_end_check", "note": "geen eindstand"})
        autoscan_ticks = [_tick(e) for e in _poule_matchday_events(
            poule, team, [match], now, horizon_end, match_duration_m, retry_match_end_m, live_check_delay_m, burst_stop_h,
        )]
    else:
        raise HTTPException(400, "onbekend scenario")

    weekly_at = _next_manual_weekly_tick(now, horizon_end, PREVIEW_COMP_ID, window_start_h)
    non_autoscan_ticks = []
    if weekly_at:
        non_autoscan_ticks.append({
            "planned_at": _iso(weekly_at), "reason": "manual_weekly", "ghost": False,
            "note": "wekelijkse ronde (vaste dag, niet aan de wedstrijd gebonden)",
        })
    non_autoscan_ticks += [{**t, "ghost": True, "note": "(zou hier staan bij autoscan)"} for t in autoscan_ticks]

    return [
        {
            "key": "autoscan", "label": "Autoscan", "sub": "binnen publicatie, scan_profile=active",
            "ticks": autoscan_ticks, "past": past, "bars": bars, "note": "volle matchday-burst rond de eigen wedstrijd",
        },
        {
            "key": "non_autoscan", "label": "Niet-autoscan", "sub": "buiten publicatie, of scan_profile=manual",
            "ticks": non_autoscan_ticks, "past": [], "bars": [{**b, "dimmed": True} for b in bars],
            "note": "geen matchday-burst - alleen de wekelijkse ronde, ongeacht wedstrijdtijd",
        },
    ]


def _preview_poule_rows(session: Session, now: datetime, scenario: str) -> List[dict]:
    daily_fallback_h = _get_int_setting(session, "active_daily_fallback_hours", 24)
    window_start_h    = _get_int_setting(session, "scan_window_start_hour", 9)
    window_end_h      = _get_int_setting(session, "scan_window_end_hour", 18)
    horizon_end = now + timedelta(days=3)
    team, poule = _preview_team_poule()

    if scenario == "landelijk":
        comp = HockeyCompetition(hl_comp_id=PREVIEW_COMP_ID, name="Preview landelijke competitie", class_name="Landelijk", season="preview")
        poules = [
            HockeyPoule(poule_id=PREVIEW_POULE_ID - i, name=f"Poule {i + 1}", competition_id=PREVIEW_COMP_ID, season="preview")
            for i in range(4)
        ]
        matches = [
            HockeyPouleMatch(
                poule_id=p.poule_id, match_id=-100 - i, home_team_id=-1, away_team_id=-2,
                match_date=(now + timedelta(days=5 + i)).isoformat(), status="",
            )
            for i, p in enumerate(poules)
        ]
        ticks = _landelijke_daily_fallback_events(comp, matches, None, now, horizon_end, daily_fallback_h, window_start_h, window_end_h)
        ticks = [{**_tick(e), "note": f"1 scan voor {len(poules)} poules"} for e in ticks]
        return [{
            "key": "landelijk", "label": "Landelijke competitie", "sub": f"{len(poules)} poules, 1 gecombineerde scan",
            "ticks": ticks, "past": [], "note": "",
        }]

    match = HockeyPouleMatch(
        poule_id=PREVIEW_POULE_ID, match_id=-1, home_team_id=-1, away_team_id=-2,
        match_date=(now + timedelta(days=5)).isoformat(), status="",
    )
    poule.last_scanned_at = now - timedelta(hours=daily_fallback_h * 2)
    raw_ticks = _poule_daily_fallback_events(
        poule, team, [match], now, horizon_end, daily_fallback_h, window_start_h, window_end_h, skip_if_healthy=False,
    )
    if scenario == "no_match_today":
        return [{
            "key": "no_match_today", "label": "Geen wedstrijd vandaag", "sub": "eerstvolgende wedstrijd over 5 dagen",
            "ticks": [_tick(e) for e in raw_ticks], "past": [], "note": "dagelijkse fallback blijft actief als vangnet",
        }]
    if scenario == "healthy":
        ticks = [{**_tick(e), "skipped": True, "note": "overgeslagen - gezond" if i == 0 else ""} for i, e in enumerate(raw_ticks)]
        return [{
            "key": "healthy", "label": "Poule is 'gezond'", "sub": "alle starttijden bekend, laatste uitslag binnen",
            "ticks": ticks, "past": [], "note": "dagelijkse fallback wordt hier bewust overgeslagen (skip_if_healthy)",
        }]
    if scenario == "unknown_start":
        # Bart, 4-09-2026: hoort bij Poule & Competitie, niet bij Wedstrijd -
        # de precieze wedstrijd-dag is hier per definitie nog onbekend
        # (placeholder middernacht), dus dit past niet in een 1-dags
        # wedstrijd-tijdlijn. Framing als "niet gezond" sluit aan bij
        # _is_healthy (services/hockey_vanger_scanplan.py): een poule is pas
        # gezond als ALLE starttijden bekend zijn EN de laatste uitslag
        # binnen is - dit scenario toont de eerste van die twee oorzaken.
        unknown_lookahead_d = _get_int_setting(session, "unknown_start_lookahead_days", 5)
        unknown_fallback_h = _get_int_setting(session, "unknown_start_fallback_hours", 8)
        unknown_horizon_end = now + timedelta(days=max(unknown_lookahead_d + 2, 5))
        match_date = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        unknown_match = HockeyPouleMatch(
            poule_id=PREVIEW_POULE_ID, match_id=-2, home_team_id=-1, away_team_id=-2,
            match_date=match_date.isoformat(), status="",
        )
        poule.last_scanned_at = None
        ticks = _poule_unknown_start_events(
            poule, team, [unknown_match], now, unknown_horizon_end, unknown_lookahead_d, unknown_fallback_h, window_start_h, window_end_h,
        )
        return [{
            "key": "unknown_start", "label": "Poule is niet 'gezond' (onbekende starttijd)",
            "sub": "wedstrijd bekend, nog geen kick-off-tijd gepubliceerd",
            "ticks": [_tick(e) for e in ticks], "past": [], "note": "",
        }]
    raise HTTPException(400, "onbekend scenario")


def _preview_club_rows(session: Session, now: datetime, scenario: str) -> List[dict]:
    club_scan_days = _get_int_setting(session, "club_scan_days", 1)
    club_list_days = _get_int_setting(session, "club_list_scan_days", 7)
    if scenario == "club_scan":
        interval_h, cmd_type, reason, skip_weekend = club_scan_days * 24, "scan_club", "club_scan", True
    elif scenario == "club_list":
        interval_h, cmd_type, reason, skip_weekend = club_list_days * 24, "get_clubs", "club_list", False
    else:
        raise HTTPException(400, "onbekend scenario")

    horizon_end = now + timedelta(days=max(interval_h / 24 * 4, 14))
    raw = _cadence_events(
        "club", -1, cmd_type, {"label": "Preview-club"}, None, now, horizon_end, interval_h, reason,
        window_start_h=0, window_end_h=24,
    )
    ticks = []
    for e in raw:
        planned_at = e["planned_at"]
        note = None
        # item 1019/_immediate_events: club-scans slaan het weekend over (niet
        # tijdsgevoelig genoeg om scan-capaciteit aan matchday-scans te
        # onttrekken) - een echte, bestaande regel, hier als display-shift
        # toegepast op de door _cadence_events berekende ticks.
        if skip_weekend and planned_at.weekday() >= 5:
            planned_at = planned_at + timedelta(days=7 - planned_at.weekday())
            note = "doorgeschoven vanaf het weekend"
        ticks.append({"planned_at": _iso(planned_at), "reason": e["reason"], "ghost": False, "note": note})

    label = "Individuele club" if scenario == "club_scan" else "Alle clubs (clublijst)"
    return [{"key": scenario, "label": label, "sub": f"cadans {interval_h // 24} dag(en)", "ticks": ticks, "past": [], "note": ""}]


def _preview_season_rows(session: Session, now: datetime, scenario: str) -> List[dict]:
    if scenario == "phases":
        target_season = get_target_season(session)
        phases = get_season_phases(session, target_season)
        if not phases:
            return [{
                "key": "phases", "label": "Seizoensfases", "sub": target_season, "ticks": [], "past": [], "bars": [],
                "note": "hockey_season_calendar heeft nog geen rijen voor dit seizoen",
            }]
        bars = [{"from": p["start"], "to": p["end"], "label": PHASE_LABELS.get(p["id"], p["id"])} for p in phases]
        return [{"key": "phases", "label": "Seizoensfases", "sub": target_season, "ticks": [], "past": [], "bars": bars, "note": ""}]
    if scenario == "manual_weekly":
        window_start_h = _get_int_setting(session, "scan_window_start_hour", 9)
        horizon_end = now + timedelta(days=21)
        ticks = []
        for i in range(5):
            at = _next_manual_weekly_tick(now, horizon_end, PREVIEW_COMP_ID - 100 - i, window_start_h)
            if at:
                ticks.append({"planned_at": _iso(at), "reason": "manual_weekly", "ghost": False, "note": f"competitie {i + 1}"})
        return [{
            "key": "manual_weekly", "label": "Wekelijkse ronde (niet-autoscan)", "sub": "5 voorbeeldcompetities, verspreid over de werkweek",
            "ticks": ticks, "past": [], "bars": [], "note": "",
        }]
    raise HTTPException(400, "onbekend scenario")


class PreviewScenarioIn(BaseModel):
    scope: str
    scenario: str
    settings: Dict[str, str] = {}


@router.post("/vanger/schedule/preview-scenario")
def preview_scenario(
    body: PreviewScenarioIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """item 1084: snelle, illustratieve preview (1 gefabriceerd object, geen
    DB-scan) - bedoeld om op elke instellingswijziging (licht gedebounced)
    aangeroepen te worden. Roept de echte event-generators aan binnen een
    tijdelijke, nooit-gecommitte candidate-settings-override."""
    if body.scope not in {"match", "poule", "club", "season"}:
        raise HTTPException(400, "onbekende scope")
    now = datetime.utcnow()
    with candidate_settings_scope(session, body.settings):
        if body.scope == "match":
            rows = _preview_match_rows(session, now, body.scenario)
        elif body.scope == "poule":
            rows = _preview_poule_rows(session, now, body.scenario)
        elif body.scope == "club":
            rows = _preview_club_rows(session, now, body.scenario)
        else:
            rows = _preview_season_rows(session, now, body.scenario)
    return {"rows": rows, "now": _iso(now)}


class ShadowRunIn(BaseModel):
    settings: Dict[str, str] = {}
    age_groups: List[str] = []
    club_external_id: Optional[str] = None
    categories: List[str] = []
    hockey_types: List[str] = []
    genders: List[str] = []
    horizon_days: int = DEFAULT_HORIZON_DAYS


@router.post("/vanger/schedule/shadow-run")
def shadow_run(
    body: ShadowRunIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """item 1084: ECHTE schaduw-run van build_schedule_events op
    productieschaal, met candidate settings + candidate queue-filter - nooit
    gecommit (candidate_settings_scope rollt in een finally altijd terug).
    Zwaarder dan preview-scenario (volledige DB-scan), dus aan de frontend-
    kant zwaarder gedebounced. team-lookups 1x gebatchd (item 1048-patroon) -
    nooit _cmd_matches_filter zonder team= aanroepen binnen een loop, anders
    herintroduceert dit exact de N+1 die item 1048 wegwerkte."""
    now = datetime.utcnow()
    horizon_days = max(1, min(body.horizon_days, 30))
    overrides = dict(body.settings)
    overrides[DISC_FILTER_AGE]    = ",".join(body.age_groups)
    overrides[DISC_FILTER_CLUB]   = body.club_external_id or ""
    overrides[DISC_FILTER_CAT]    = ",".join(body.categories)
    overrides[DISC_FILTER_HT]     = ",".join(body.hockey_types)
    overrides[DISC_FILTER_GENDER] = ",".join(body.genders)

    with candidate_settings_scope(session, overrides):
        events = build_schedule_events(session, now, horizon_days)
        ages, club, cats, hts, genders = _get_queue_filter(session)
        zaal_active = is_zaal_active(session, now)

        parsed = [(e, json.loads(e["params"])) for e in events]
        team_ids = {p.get("team_id") for e, p in parsed if e["cmd_type"] == "get_poule"}
        team_ids.discard(None)
        team_by_id = {
            t.team_id: t for t in session.exec(select(HockeyTeam).where(col(HockeyTeam.team_id).in_(team_ids))).all()
        } if team_ids else {}

        matches_filter = 0
        by_reason: Dict[str, int] = {}
        for e, params in parsed:
            by_reason[e["reason"]] = by_reason.get(e["reason"], 0) + 1
            team = team_by_id.get(params.get("team_id")) if e["cmd_type"] == "get_poule" else None
            if _cmd_matches_filter(
                session, e["cmd_type"], params, ages, club, cats, hts, genders, now=now, zaal_active=zaal_active, team=team,
            ):
                matches_filter += 1

    return {"totals": {"planned": len(events), "matches_filter": matches_filter}, "by_reason": by_reason}
