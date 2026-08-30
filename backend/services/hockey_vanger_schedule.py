"""Scanschema (Fase A, schaduw-modus): een vooraf berekende, toekomstgerichte
lijst van scan-momenten - los van de vanger_cmd_queue (VangerCmd, de
daadwerkelijke uitvoeringsqueue die Ghost/Scout aflopen).

Herbruikt dezelfde regels als services/hockey_vanger_scanplan.py (matchday-
burst, dagelijkse fallback, live-check, landelijke cadans, wekelijkse
niet-autoscan-ronde, onbekende-starttijd-recheck), maar dan als
EVENT-GENERATOREN die een heel venster [now, now+horizon] vooruitplannen
i.p.v. alleen "is dit nu due" te beantwoorden. Doel: de Kalender-tab kan het
schema straks gewoon TONEN i.p.v. zelf (in JS) dezelfde regels te
herberekenen - dat voorkomt de drift tussen backend-logica en frontend-
weergave die deze sessie herhaaldelijk tot bugs leidde.

Schaduw-modus: rebuild_schedule/promote_due_schedule_entries draaien NAAST
de bestaande _step_*-functies in hockey_vanger_scanplan.py, die de echte
uitvoering voorlopig ongewijzigd blijven aansturen. add_vanger_cmd's
bestaande dedup zorgt dat promotie nooit een dubbele VangerCmd-rij oplevert
als de oude stap 'm al had aangemaakt."""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

from sqlmodel import Session, col, select

from models.hockey import HockeyPublicationComp
from models.hockey_discovery import (
    HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyTeam, ScanScheduleEntry, VangerCmd,
)
from services.hockey_vanger_filters import _is_scoreless_youth
from services.hockey_vanger_scanplan import (
    STEP_MAX_CMDS, MANUAL_SCAN_WEEKDAYS, _manual_scan_weekday, _match_dt_info, _pending_club_ext_ids,
    _pending_poule_ids, _team_by_poule,
)
from services.hockey_vanger_settings import _get_int_setting, get_target_season

DEFAULT_HORIZON_DAYS = 14
_MANUAL_WEEKLY_HOUR = 9  # willekeurig maar vast weergave-uur voor de wekelijkse niet-autoscan-ronde


def _event(target_type: str, target_id: int, cmd_type: str, params: dict, planned_at: datetime, reason: str) -> dict:
    return {
        "target_type": target_type, "target_id": target_id, "cmd_type": cmd_type,
        "params": json.dumps(params), "planned_at": planned_at, "reason": reason,
    }


def _poule_matchday_events(
    poule: HockeyPoule, team: HockeyTeam, matches: List[HockeyPouleMatch], now: datetime, horizon_end: datetime,
    match_duration_m: int, matchday_interval_m: int, live_check_delay_m: int, burst_stop_h: int,
) -> List[dict]:
    """Burst-ticks + live-check-moment(en), per kalenderdag met een bekende
    (niet-placeholder) starttijd binnen het venster - zelfde regels als
    _step_active_profiles, maar voor elke dag in het venster i.p.v. alleen
    'vandaag'."""
    by_date: Dict = {}
    for m in matches:
        if not m.match_date:
            continue
        info = _match_dt_info(m.match_date)
        if not info:
            continue
        utc_naive, _is_today, is_midnight = info
        if is_midnight or utc_naive < now.replace(hour=0, minute=0, second=0, microsecond=0):
            continue
        if utc_naive.date() > horizon_end.date():
            continue
        by_date.setdefault(utc_naive.date(), []).append((utc_naive, m))

    events: List[dict] = []
    params = {"poule_id": poule.poule_id, "team_id": team.team_id, "label": team.name + " — " + (poule.name or "")}
    for day_matches in by_date.values():
        starts = [s for s, _m in day_matches]
        ends = [s + timedelta(minutes=match_duration_m) for s in starts]
        all_final = all(m.status == "final" for _s, m in day_matches)
        burst_deadline = max(ends) if all_final else max(ends) + timedelta(hours=burst_stop_h)
        tick = min(ends)
        while tick < burst_deadline and tick <= horizon_end:
            if tick >= now:
                events.append(_event("poule", poule.poule_id, "get_poule", params, tick, "matchday_burst"))
            tick += timedelta(minutes=matchday_interval_m)

        for start, _m in day_matches:
            check_at = start + timedelta(minutes=live_check_delay_m)
            if now <= check_at <= horizon_end:
                events.append(_event("poule", poule.poule_id, "get_poule", params, check_at, "live_check"))
    return events


def _poule_unknown_start_events(
    poule: HockeyPoule, team: HockeyTeam, matches: List[HockeyPouleMatch], now: datetime, horizon_end: datetime,
    lookahead_days: int, fallback_h: int,
) -> List[dict]:
    """Rechecks voor wedstrijden met een bekende datum maar nog geen starttijd
    (middernacht-placeholder), zolang er zo'n datum binnen lookahead_days ligt.
    Best-effort vooruitblik (elke rebuild ververst dit toch), dus 1 vaste
    cadans vanaf nu i.p.v. per placeholder-datum te herberekenen."""
    lookahead_end = (now + timedelta(days=lookahead_days)).date()
    has_upcoming_unknown = False
    for m in matches:
        if not m.match_date:
            continue
        info = _match_dt_info(m.match_date)
        if not info:
            continue
        utc_naive, _is_today, is_midnight = info
        if is_midnight and now.date() <= utc_naive.date() <= lookahead_end:
            has_upcoming_unknown = True
            break
    if not has_upcoming_unknown:
        return []

    params = {"poule_id": poule.poule_id, "team_id": team.team_id, "label": team.name + " — " + (poule.name or "")}
    base = poule.last_scanned_at or now
    tick = base + timedelta(hours=fallback_h)
    while tick < now:
        tick += timedelta(hours=fallback_h)
    events = []
    while tick <= horizon_end:
        events.append(_event("poule", poule.poule_id, "get_poule", params, tick, "unknown_start_recheck"))
        tick += timedelta(hours=fallback_h)
    return events


def _poule_daily_fallback_events(
    poule: HockeyPoule, team: HockeyTeam, now: datetime, horizon_end: datetime, daily_fallback_h: int,
) -> List[dict]:
    params = {"poule_id": poule.poule_id, "team_id": team.team_id, "label": team.name + " — " + (poule.name or "")}
    base = poule.last_scanned_at or now
    tick = base + timedelta(hours=daily_fallback_h)
    while tick < now:
        tick += timedelta(hours=daily_fallback_h)
    events = []
    while tick <= horizon_end:
        events.append(_event("poule", poule.poule_id, "get_poule", params, tick, "daily_fallback"))
        tick += timedelta(hours=daily_fallback_h)
    return events


def _landelijke_cadence_events(session: Session, now: datetime, horizon_end: datetime, hours: int) -> List[dict]:
    """Vaste cadans vanaf nu i.p.v. gebaseerd op last_scanned_at van de poules -
    dat laatste behandelde een nooit-gescande poule (last_scanned_at=None)
    stilzwijgend anders dan _step_landelijke_competitions (die 'm juist
    meteen als due beschouwt), dus onnodig fragiel voor wat een simpele
    vaste cadans kan zijn. Echt-overdue detectie blijft bij de bestaande
    _step_landelijke_competitions (schaduw-modus stuurt de uitvoering nog
    niet aan)."""
    events = []
    for comp in session.exec(select(HockeyCompetition).where(col(HockeyCompetition.hl_comp_id).is_not(None))).all():
        tick = now + timedelta(hours=hours)
        params = {"comp_id": comp.hl_comp_id, "label": comp.name}
        while tick <= horizon_end:
            events.append(_event("competition", comp.hl_comp_id, "get_competition_detail", params, tick, "landelijke_cadence"))
            tick += timedelta(hours=hours)
    return events


def _manual_weekly_events(
    session: Session, now: datetime, horizon_end: datetime, team_by_poule: Dict[int, HockeyTeam],
) -> List[dict]:
    manual_comp_ids = set(session.exec(
        select(HockeyPublicationComp.competition_id).where(HockeyPublicationComp.scan_profile == "manual")
    ).all())
    if not manual_comp_ids:
        return []
    hl_linked_comp_ids = {
        c.id for c in session.exec(
            select(HockeyCompetition)
            .where(col(HockeyCompetition.id).in_(manual_comp_ids))
            .where(col(HockeyCompetition.hl_comp_id).is_not(None))
        ).all()
    }
    events = []
    day = now.replace(hour=_MANUAL_WEEKLY_HOUR, minute=0, second=0, microsecond=0)
    if day < now:
        day += timedelta(days=1)
    while day <= horizon_end:
        if day.weekday() < MANUAL_SCAN_WEEKDAYS:
            for poule in session.exec(
                select(HockeyPoule).where(col(HockeyPoule.competition_id).in_(manual_comp_ids))
            ).all():
                if poule.competition_id in hl_linked_comp_ids:
                    continue
                if _manual_scan_weekday(poule.competition_id) != day.weekday():
                    continue
                team = team_by_poule.get(poule.poule_id)
                if not team:
                    continue
                params = {"poule_id": poule.poule_id, "team_id": team.team_id, "label": team.name + " — " + (poule.name or "")}
                events.append(_event("poule", poule.poule_id, "get_poule", params, day, "manual_weekly"))
        day += timedelta(days=1)
    return events


def _immediate_events(session: Session, now: datetime, target_season: str, cap: int) -> List[dict]:
    """Nieuwe/lege poules en club-scans zijn niet tijd-gepland maar 'zodra van
    toepassing' - hier alleen zichtbaar gemaakt als planned_at=now, geen
    nieuwe toekomst-planningslogica (dekking van _step_new_or_empty_poules/
    _step_club_scan/_step_club_list blijft ongewijzigd bij de echte stappen).
    Zelfde cap als de echte stappen (STEP_MAX_CMDS) - zonder cap zou een
    volle acc-dataset (roadmap-melding: 900 kandidaten) in 1 rebuild+promote-
    cyclus ineens gequeued worden i.p.v. geleidelijk over meerdere passes."""
    events: List[dict] = []
    queued_poule_ids = _pending_poule_ids(session)
    captured_ids = {p.poule_id for p in session.exec(select(HockeyPoule)).all()}
    seen: set = set()

    for t in session.exec(
        select(HockeyTeam)
        .where(col(HockeyTeam.recent_poule_id).is_not(None))
        .where(HockeyTeam.no_new_poule_confirmed == False)  # noqa: E712
        .where(HockeyTeam.season_pending == False)  # noqa: E712
    ).all():
        if len(events) >= cap:
            break
        if _is_scoreless_youth(t.short_name):
            continue
        pid = t.recent_poule_id
        if pid in captured_ids or pid in queued_poule_ids or pid in seen:
            continue
        seen.add(pid)
        events.append(_event("poule", pid, "get_poule", {"poule_id": pid, "team_id": t.team_id, "label": t.name}, now, "new_or_empty"))

    queued_ext_ids = _pending_club_ext_ids(session)
    season_pending_ext = {
        t.club_external_id for t in session.exec(select(HockeyTeam).where(HockeyTeam.season_pending == True)).all()  # noqa: E712
    }
    club_candidates: Dict[str, HockeyClub] = {
        c.external_id: c for c in session.exec(select(HockeyClub).where(HockeyClub.detail_loaded == False)).all()  # noqa: E712
    }
    for ext_id in season_pending_ext:
        if ext_id in club_candidates:
            continue
        club = session.exec(select(HockeyClub).where(HockeyClub.external_id == ext_id)).first()
        if club:
            club_candidates[ext_id] = club
    club_events = 0
    for ext_id, club in club_candidates.items():
        if club_events >= cap:
            break
        if ext_id in queued_ext_ids:
            continue
        events.append(_event(
            "club", club.id, "scan_club", {"external_id": ext_id, "label": club.friendly_name or club.name}, now, "club_scan",
        ))
        club_events += 1

    pending_clubs_list = session.exec(
        select(VangerCmd).where(VangerCmd.cmd_type == "get_clubs").where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).first()
    if not pending_clubs_list:
        events.append(_event("club", 0, "get_clubs", {"label": "Alle clubs (scan-plan)"}, now, "club_list"))

    return events


def build_schedule_events(session: Session, now: datetime, horizon_days: int) -> List[dict]:
    """Berekent het VOLLEDIGE scanschema voor [now, now+horizon_days] - geen
    bijwerkingen, puur een lijst events. rebuild_schedule persisteert dit."""
    horizon_end = now + timedelta(days=horizon_days)
    match_duration_m    = _get_int_setting(session, "match_duration_min", 90)
    matchday_interval_m = _get_int_setting(session, "active_matchday_interval_min", 45)
    live_check_delay_m  = _get_int_setting(session, "live_check_delay_min", 15)
    burst_stop_h        = _get_int_setting(session, "burst_stop_hours_after_last_match", 2)
    daily_fallback_h    = _get_int_setting(session, "active_daily_fallback_hours", 24)
    landelijke_hours    = _get_int_setting(session, "landelijke_comp_scan_hours", 12)
    unknown_lookahead_d = _get_int_setting(session, "unknown_start_lookahead_days", 5)
    unknown_fallback_h  = _get_int_setting(session, "unknown_start_fallback_hours", 8)

    events: List[dict] = []

    active_comp_ids = set(session.exec(
        select(HockeyPublicationComp.competition_id).where(HockeyPublicationComp.scan_profile == "active")
    ).all())
    team_by_poule = _team_by_poule(session)

    if active_comp_ids:
        hl_linked_comp_ids = {
            c.id for c in session.exec(
                select(HockeyCompetition)
                .where(col(HockeyCompetition.id).in_(active_comp_ids))
                .where(col(HockeyCompetition.hl_comp_id).is_not(None))
            ).all()
        }
        poules = session.exec(select(HockeyPoule).where(col(HockeyPoule.competition_id).in_(active_comp_ids))).all()
        for poule in poules:
            if poule.competition_id in hl_linked_comp_ids:
                continue
            team = team_by_poule.get(poule.poule_id)
            if not team:
                continue
            matches = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).all()
            events += _poule_matchday_events(
                poule, team, matches, now, horizon_end,
                match_duration_m, matchday_interval_m, live_check_delay_m, burst_stop_h,
            )
            events += _poule_unknown_start_events(poule, team, matches, now, horizon_end, unknown_lookahead_d, unknown_fallback_h)
            events += _poule_daily_fallback_events(poule, team, now, horizon_end, daily_fallback_h)

    events += _landelijke_cadence_events(session, now, horizon_end, landelijke_hours)
    events += _manual_weekly_events(session, now, horizon_end, team_by_poule)
    events += _immediate_events(session, now, get_target_season(session), STEP_MAX_CMDS)
    return events


def rebuild_schedule(session: Session, now: datetime, horizon_days: int = DEFAULT_HORIZON_DAYS) -> int:
    """Wist alle nog niet-gepromoveerde ('planned') rijen binnen het venster en
    zet de vers berekende set terug - simpeler dan incrementeel diffen, en een
    instellingswijziging werkt zo vanzelf door bij de eerstvolgende rebuild.
    Gepromoveerde rijen blijven staan als geschiedenis."""
    horizon_end = now + timedelta(days=horizon_days)
    stale = session.exec(
        select(ScanScheduleEntry)
        .where(ScanScheduleEntry.status == "planned")
        .where(ScanScheduleEntry.planned_at <= horizon_end)
    ).all()
    for entry in stale:
        session.delete(entry)

    events = build_schedule_events(session, now, horizon_days)
    for ev in events:
        session.add(ScanScheduleEntry(**ev))
    session.commit()
    return len(events)


def promote_due_schedule_entries(session: Session, now: datetime, cap: int = STEP_MAX_CMDS) -> int:
    """Hevelt scanschema-rijen waarvan planned_at is aangebroken over naar de
    echte vanger-queue (VangerCmd), via de bestaande add_vanger_cmd (dedup +
    landelijke-redirect ongewijzigd hergebruikt). In schaduw-modus (Fase A)
    zullen de meeste van deze aanroepen gewoon 'already_queued' teruggeven
    omdat de bestaande _step_*-functies in hockey_vanger_scanplan.py het doel
    al hebben aangemaakt - dat bevestigt dat het schema klopt, zonder dat de
    echte uitvoering verandert.

    Gecapt op STEP_MAX_CMDS per aanroep (net als elke _step_*-functie) - een
    eerste rebuild op een dataset met een oude scan-historie kan anders in
    1x honderden 'inmiddels due' entries willen promoveren (roadmap-melding:
    900 promoties in 1 keer op acc bij het invoeren van deze functie).
    Oudste planned_at eerst, zodat de achterstand geleidelijk wegwerkt over
    meerdere passes i.p.v. willekeurig."""
    from routers.hockey_vanger_cmd_queue import add_vanger_cmd  # lokale import: voorkomt circulaire import op module-niveau

    due = session.exec(
        select(ScanScheduleEntry)
        .where(ScanScheduleEntry.status == "planned")
        .where(ScanScheduleEntry.planned_at <= now)
        .order_by(col(ScanScheduleEntry.planned_at).asc())
        .limit(cap)
    ).all()
    promoted = 0
    for entry in due:
        try:
            params = json.loads(entry.params)
        except (ValueError, TypeError):
            entry.status = "cancelled"
            session.add(entry)
            continue
        result = add_vanger_cmd(session, entry.cmd_type, params)
        entry.status = "promoted"
        if result.get("added"):
            new_cmd = session.exec(
                select(VangerCmd).where(VangerCmd.cmd_type == entry.cmd_type).order_by(col(VangerCmd.id).desc())
            ).first()
            entry.vanger_cmd_id = new_cmd.id if new_cmd else None
        session.add(entry)
        promoted += 1
    session.commit()
    return promoted
