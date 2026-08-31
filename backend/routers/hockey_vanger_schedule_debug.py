"""Debug-pagina voor het SCANSCHEMA (ScanScheduleEntry, item 1015) - niet te
verwarren met de echte uitvoeringsqueue (VangerCmd, zie
hockey_vanger_cmd_queue_debug.py). Puur lezend op 1 uitzondering na: de
handmatige rebuild-trigger (Bart, 30-08-2026: "kan er niet een button komen
dan ik het zelf kan doen?") - herberekent alleen de PREVIEW
(ScanScheduleEntry), muteert geen echte wedstrijd-/team-data en start geen
enkele hockey.nl-scan (dat blijft scan_plan_enabled/ghost_enabled)."""

import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.hockey_discovery import HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch, ScanScheduleEntry
from services.hockey_vanger_filters import _cmd_matches_filter, _get_queue_filter
from services.hockey_vanger_scanplan import _manual_scan_weekday, _match_dt_info
from services.hockey_vanger_schedule import DEFAULT_HORIZON_DAYS, rebuild_schedule
from services.hockey_vanger_settings import _get_int_setting

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
