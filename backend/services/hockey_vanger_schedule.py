"""Scanschema (Fase A, schaduw-modus): een vooraf berekende, toekomstgerichte
lijst van scan-momenten - los van de vanger_cmd_queue (VangerCmd, de
daadwerkelijke uitvoeringsqueue die Ghost/Scout aflopen).

Herbruikt dezelfde regels als services/hockey_vanger_scanplan.py
(match_start_check, match_end_check, dagelijkse fallback - ook voor
landelijke competities, die als 1 grote poule worden behandeld over de
vereniging van alle wedstrijden in hun poules - wekelijkse niet-autoscan-
ronde, onbekende-starttijd-recheck), maar dan als
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
from typing import Dict, List, Optional, Tuple

from sqlmodel import Session, col, select

from models.hockey import HockeyPublicationComp
from models.hockey_discovery import (
    HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyTeam, ScanScheduleEntry, VangerCmd,
)
from services.hockey_vanger_filters import _cmd_matches_filter, _get_queue_filter, _is_scoreless_youth
from services.hockey_vanger_scanplan import (
    STEP_MAX_CMDS, MANUAL_SCAN_WEEKDAYS, _has_remaining_matches, _is_healthy, _manual_scan_weekday, _match_dt_info,
    _next_match_within, _pending_club_ext_ids, _pending_poule_ids, _poule_health, _skip_healthy_daily_fallback,
    _team_by_poule, _team_for_poule,
)
from services.hockey_vanger_settings import _get_int_setting, get_target_season

DEFAULT_HORIZON_DAYS = 14
DEFAULT_SCAN_WINDOW_START_HOUR = 9
DEFAULT_SCAN_WINDOW_END_HOUR = 18


def _clamp_to_window(dt: datetime, start_hour: int, end_hour: int) -> datetime:
    """Niet-wedstrijd-gebonden scan-momenten (dagelijkse fallback, onbekende-
    starttijd-recheck, wekelijkse niet-autoscan-ronde) horen binnen een
    ingesteld dagvenster te vallen (default 09:00-18:00) i.p.v. op een
    willekeurig berekend uur (bv. 03:00) - matchday-burst/live-check blijven
    ONGEMOEID, die tijden zijn al aan een echte wedstrijd gebonden."""
    if dt.hour < start_hour:
        return dt.replace(hour=start_hour, minute=0, second=0, microsecond=0)
    if dt.hour >= end_hour:
        next_day = dt + timedelta(days=1)
        return next_day.replace(hour=start_hour, minute=0, second=0, microsecond=0)
    return dt


def _event(target_type: str, target_id: int, cmd_type: str, params: dict, planned_at: datetime, reason: str) -> dict:
    return {
        "target_type": target_type, "target_id": target_id, "cmd_type": cmd_type,
        "params": json.dumps(params), "planned_at": planned_at, "reason": reason,
    }


def _matchday_events(
    target_type: str, target_id, cmd_type: str, params: dict, matches: List[HockeyPouleMatch],
    last_scanned_at: Optional[datetime], now: datetime, horizon_end: datetime,
    match_duration_m: int, retry_match_end_m: int, live_check_delay_m: int, burst_stop_h: int,
) -> List[dict]:
    """Max. 2 vooraf geplande momenten per wedstrijd - match_start_check kort
    na aanvang, match_end_check op het voorspelde einde - zelfde regels als
    _matchday_due_reason in hockey_vanger_scanplan.py. Gedeeld tussen 1
    poule (_poule_matchday_events) en de vereniging van alle wedstrijden in
    de poules van 1 landelijke competitie (_landelijke_matchday_events).

    Volledig PER WEDSTRIJD (Bart, 30-08-2026: "per wedstrijd zijn er
    maximaal 2 geplande scans, een start en een end... als de match end
    scan het gewenste resultaat oplevert dan geen extra scan, anders
    schedulen en rebuild") - GEEN gedeelde dag-brede cadans meer tussen los
    van elkaar staande wedstrijden. Een eerdere dag-brede aanpak liet een
    poule met bv. een wedstrijd om 10:20 en een om 14:30 de hele dode
    periode ertussen (waarin niets te ontdekken viel) toch doorscannen,
    puur omdat de dag als geheel nog niet "af" was.

    Een vervolgscan is altijd DYNAMISCH, nooit vooraf als losse reeks
    gepland: match_end_check zonder 'final' resultaat -> retry_match_end
    (Bart: "als daar niets uitkomt komt er dynamisch weer een queue item
    bij"), match_start_check die een levende wedstrijd blijkt -> match_live
    (Bart: "net als bij match_start_scan -> blijkt live wedstrijd te zijn ->
    match_live events inplannen"). Onderscheid eerste-check-vs-retry:
    last_scanned_at (poule-breed, 1 get_poule ververst alle wedstrijden
    tegelijk) nog van vóór het eigen einde van DEZE wedstrijd -> eerste
    check (match_end_check); al minstens 1x gecheckt ná het einde, nog
    steeds niet final -> retry_match_end, retry_match_end_m minuten later.
    post_cmd_result herbouwt het schema al meteen na elk echt resultaat
    (Wijziging 1), dus de volgende rebuild berekent vanzelf de eerstvolgende
    tick voor DIE wedstrijd opnieuw."""
    valid_matches: List[Tuple[datetime, HockeyPouleMatch]] = []
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
        valid_matches.append((utc_naive, m))

    events: List[dict] = []
    # Meerdere wedstrijden (in 1 poule, of - bij een landelijke competitie -
    # verspreid over meerdere poules) kunnen ervoor zorgen dat 2 losse
    # momenten toevallig op exact hetzelfde tijdstip uitkomen - het zijn
    # allemaal dezelfde get_poule/get_competition_detail-call voor hetzelfde
    # doel, dus bij promotie zou dat toch tot 1 VangerCmd samenvallen
    # (add_vanger_cmd dedupt al). 1 gedeelde seen_at-set voorkomt dat zo'n
    # samenval als 2 losse geplande rijen verschijnt.
    seen_at: set = set()

    def _plan(tick: datetime, deadline: datetime, reason: str):
        # Een berekend moment kan in het verleden liggen (bv. last_scanned_at
        # is allang stale) - dan gewoon meteen inplannen ("nu") i.p.v. hem
        # stilzwijgend te laten vallen, zolang dat nog vóór de deadline is.
        tick = max(tick, now)
        if tick < deadline and tick <= horizon_end and tick not in seen_at:
            seen_at.add(tick)
            events.append(_event(target_type, target_id, cmd_type, params, tick, reason))

    for start, m in valid_matches:
        end = start + timedelta(minutes=match_duration_m)
        deadline = end + timedelta(hours=burst_stop_h)

        if m.status != "final":
            is_first = last_scanned_at is None or last_scanned_at < end
            if is_first:
                _plan(end, deadline, "match_end_check")
            else:
                _plan(last_scanned_at + timedelta(minutes=retry_match_end_m), deadline, "retry_match_end")

        check_at = start + timedelta(minutes=live_check_delay_m)
        if now <= check_at <= horizon_end and check_at not in seen_at:
            seen_at.add(check_at)
            events.append(_event(target_type, target_id, cmd_type, params, check_at, "match_start_check"))

        # match_live (Bart, 30-08-2026): zodra een eerdere scan al heeft
        # bevestigd dat de wedstrijd echt live staat (m.status == "live") -
        # niet elke wedstrijd krijgt live-status op hockey.nl (item 969),
        # dus vooraf blind inplannen voor een wedstrijd die (nog) niet
        # blijkt te leven zou onnodige calls in het schema tonen. Dynamisch,
        # 1 eerstvolgende tick op de retry_match_end_m-cadans - net als
        # retry_match_end hierboven.
        if m.status != "live":
            continue
        min_live_tick = start + timedelta(minutes=live_check_delay_m + retry_match_end_m)
        base = last_scanned_at + timedelta(minutes=retry_match_end_m) if last_scanned_at else min_live_tick
        _plan(max(base, min_live_tick), deadline, "match_live")
    return events


def _poule_matchday_events(
    poule: HockeyPoule, team: HockeyTeam, matches: List[HockeyPouleMatch], now: datetime, horizon_end: datetime,
    match_duration_m: int, retry_match_end_m: int, live_check_delay_m: int, burst_stop_h: int,
) -> List[dict]:
    params = {"poule_id": poule.poule_id, "team_id": team.team_id, "label": team.name + " — " + (poule.name or "")}
    return _matchday_events(
        "poule", poule.poule_id, "get_poule", params, matches, poule.last_scanned_at, now, horizon_end,
        match_duration_m, retry_match_end_m, live_check_delay_m, burst_stop_h,
    )


def _landelijke_matchday_events(
    comp: HockeyCompetition, matches: List[HockeyPouleMatch], last_scanned_at: Optional[datetime],
    now: datetime, horizon_end: datetime,
    match_duration_m: int, retry_match_end_m: int, live_check_delay_m: int, burst_stop_h: int,
) -> List[dict]:
    params = {"comp_id": comp.hl_comp_id, "label": comp.name}
    return _matchday_events(
        "competition", comp.hl_comp_id, "get_competition_detail", params, matches, last_scanned_at, now, horizon_end,
        match_duration_m, retry_match_end_m, live_check_delay_m, burst_stop_h,
    )


def _cadence_events(
    target_type: str, target_id, cmd_type: str, params: dict, last_scanned_at, now: datetime, horizon_end: datetime,
    interval_h: int, reason: str, window_start_h: int, window_end_h: int,
    preempting_at: Optional[List[datetime]] = None, same_day_preempt: bool = False,
    require_match_within_days: Optional[int] = None, matches: Optional[List[HockeyPouleMatch]] = None,
) -> List[dict]:
    """Vaste cadans (daily_fallback/unknown_start_recheck) vanaf
    last_scanned_at. preempting_at is een gesorteerde lijst van momenten
    waarop een HOGER-prioriteit scan (match_start_check/match_end_check, en
    voor daily_fallback ook unknown_start_recheck) al gepland staat - zo'n
    scan zou in werkelijkheid last_scanned_at al hebben bijgewerkt en dus
    deze cadans-klok resetten. Zonder dit verscheen bv. een
    daily_fallback-rij midden in een actief burst-venster (Bart,
    30-08-2026), wat in de praktijk nooit gebeurt.

    same_day_preempt (Bart, 30-08-2026, alleen voor daily_fallback): een
    dagelijkse fallback is overbodig zodra er die kalenderdag AL een
    matchday-scan gepland staat, ook als die later op de dag valt dan de
    berekende fallback-tick - de dag wordt toch al ververst. Vergelijkt
    tegen de GEKLEMDE (_clamp_to_window) datum, niet de ruwe tick-datum: een
    late-avond tick (bv. 23:00) klemt door naar de volgende ochtend (09:00)
    voor weergave, en zou zonder deze correctie tegen de VERKEERDE dag
    vergeleken worden - precies zo verscheen een fallback op 5 sep 09:00
    terwijl de dag ervoor (4 sep) geen wedstrijd had, maar de klem 'm alsnog
    op 5 sep liet landen, de dag die WEL matchday-activiteit had.

    require_match_within_days (Bart, 30-08-2026, alleen voor
    daily_fallback): sla een tick over zolang er geen wedstrijd binnen dat
    aantal dagen VAN DIE TICK af valt - een rustige week levert toch niets
    op om te ontdekken. De cadans blijft intern gewoon elke interval_h uur
    doortikken (base/tick schuiven altijd door), alleen het WEERGEVEN van
    een tick wordt overgeslagen - zodra een latere tick weer binnen het
    lookahead-venster van een wedstrijd valt, verschijnt de fallback
    vanzelf weer.

    Meerdere ruwe ticks kunnen op DEZELFDE geklemde weergavetijd uitkomen -
    bv. bij interval_h=8 en venster 09:00-18:00 klemt een avondtick (20:11)
    vooruit naar de volgende dag 09:00, en de daaropvolgende vroege-ochtend-
    tick (04:11, +8u) klemt terug naar diezelfde dag 09:00: 2 ruwe ticks,
    1 kalenderdag, dezelfde geklemde tijd. Zonder dedup op de geklemde
    tijd (i.p.v. de ruwe tick) leverde dat 2 identieke geplande rijen op
    voor exact hetzelfde moment (Bart, 30-08-2026, poule #180923: 2x
    unknown_start_recheck om 11:00 op dezelfde dag)."""
    preempting = sorted(preempting_at or [])
    idx = 0
    base = last_scanned_at or now
    tick = base + timedelta(hours=interval_h)
    events = []
    seen_display: set = set()
    while tick <= horizon_end:
        moved = False
        display_date = _clamp_to_window(tick, window_start_h, window_end_h).date()
        while idx < len(preempting) and (
            preempting[idx].date() <= display_date if same_day_preempt else preempting[idx] <= tick
        ):
            base = preempting[idx]
            tick = base + timedelta(hours=interval_h)
            idx += 1
            moved = True
            display_date = _clamp_to_window(tick, window_start_h, window_end_h).date()
        if moved:
            continue
        if tick >= now and (require_match_within_days is None or _next_match_within(matches, tick, require_match_within_days)):
            display_at = _clamp_to_window(tick, window_start_h, window_end_h)
            if display_at not in seen_display:
                seen_display.add(display_at)
                events.append(_event(target_type, target_id, cmd_type, params, display_at, reason))
        base = tick
        tick = base + timedelta(hours=interval_h)
    return events


def _has_upcoming_unknown_start(matches: List[HockeyPouleMatch], now: datetime, lookahead_days: int) -> bool:
    """Wedstrijd met een bekende datum maar nog geen starttijd (middernacht-
    placeholder), binnen lookahead_days - zowel voor 1 poule als voor de
    vereniging van wedstrijden van een landelijke competitie."""
    lookahead_end = (now + timedelta(days=lookahead_days)).date()
    for m in matches:
        if not m.match_date:
            continue
        info = _match_dt_info(m.match_date)
        if not info:
            continue
        utc_naive, _is_today, is_midnight = info
        if is_midnight and now.date() <= utc_naive.date() <= lookahead_end:
            return True
    return False


def _poule_unknown_start_events(
    poule: HockeyPoule, team: HockeyTeam, matches: List[HockeyPouleMatch], now: datetime, horizon_end: datetime,
    lookahead_days: int, fallback_h: int, window_start_h: int, window_end_h: int,
    preempting_at: Optional[List[datetime]] = None,
) -> List[dict]:
    """Rechecks voor wedstrijden met een bekende datum maar nog geen starttijd,
    zolang er zo'n datum binnen lookahead_days ligt. Best-effort vooruitblik
    (elke rebuild ververst dit toch), dus 1 vaste cadans vanaf nu i.p.v. per
    placeholder-datum te herberekenen."""
    if not _has_upcoming_unknown_start(matches, now, lookahead_days):
        return []
    params = {"poule_id": poule.poule_id, "team_id": team.team_id, "label": team.name + " — " + (poule.name or "")}
    return _cadence_events(
        "poule", poule.poule_id, "get_poule", params, poule.last_scanned_at, now, horizon_end,
        fallback_h, "unknown_start_recheck", window_start_h, window_end_h, preempting_at,
    )


def _landelijke_unknown_start_events(
    comp: HockeyCompetition, matches: List[HockeyPouleMatch], last_scanned_at, now: datetime, horizon_end: datetime,
    lookahead_days: int, fallback_h: int, window_start_h: int, window_end_h: int,
    preempting_at: Optional[List[datetime]] = None,
) -> List[dict]:
    if not _has_upcoming_unknown_start(matches, now, lookahead_days):
        return []
    params = {"comp_id": comp.hl_comp_id, "label": comp.name}
    return _cadence_events(
        "competition", comp.hl_comp_id, "get_competition_detail", params, last_scanned_at, now, horizon_end,
        fallback_h, "unknown_start_recheck", window_start_h, window_end_h, preempting_at,
    )


DAILY_FALLBACK_LOOKAHEAD_DAYS = 7


def _poule_daily_fallback_events(
    poule: HockeyPoule, team: HockeyTeam, matches: List[HockeyPouleMatch], now: datetime, horizon_end: datetime,
    daily_fallback_h: int, window_start_h: int, window_end_h: int, preempting_at: Optional[List[datetime]] = None,
    skip_if_healthy: bool = False,
) -> List[dict]:
    # item 1016: seizoen voorbij (minstens 1 wedstrijd bekend, allemaal al
    # geweest) - geen dagelijkse heartbeat-scan meer nodig, niets te
    # ontdekken. item 1018: mirror van de gezond-skip in _matchday_due_reason
    # (hockey_vanger_scanplan.py) - anders toont de Kalender-preview een
    # daily_fallback-event dat de echte scan-plan-stap toch overslaat.
    if not _has_remaining_matches(matches, now) or skip_if_healthy:
        return []
    params = {"poule_id": poule.poule_id, "team_id": team.team_id, "label": team.name + " — " + (poule.name or "")}
    return _cadence_events(
        "poule", poule.poule_id, "get_poule", params, poule.last_scanned_at, now, horizon_end,
        daily_fallback_h, "daily_fallback", window_start_h, window_end_h, preempting_at, same_day_preempt=True,
        require_match_within_days=DAILY_FALLBACK_LOOKAHEAD_DAYS, matches=matches,
    )


def _landelijke_daily_fallback_events(
    comp: HockeyCompetition, matches: List[HockeyPouleMatch], last_scanned_at, now: datetime, horizon_end: datetime,
    daily_fallback_h: int, window_start_h: int, window_end_h: int, preempting_at: Optional[List[datetime]] = None,
    skip_if_healthy: bool = False,
) -> List[dict]:
    if not _has_remaining_matches(matches, now) or skip_if_healthy:
        return []
    params = {"comp_id": comp.hl_comp_id, "label": comp.name}
    return _cadence_events(
        "competition", comp.hl_comp_id, "get_competition_detail", params, last_scanned_at, now, horizon_end,
        daily_fallback_h, "daily_fallback", window_start_h, window_end_h, preempting_at, same_day_preempt=True,
        require_match_within_days=DAILY_FALLBACK_LOOKAHEAD_DAYS, matches=matches,
    )


def _manual_weekly_events(
    session: Session, now: datetime, horizon_end: datetime, team_by_poule: Dict[int, HockeyTeam], window_start_h: int,
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
    manual_poules = session.exec(
        select(HockeyPoule).where(col(HockeyPoule.competition_id).in_(manual_comp_ids))
    ).all()
    # item 1018: mirror van de gezond-skip in _step_manual_profiles_weekly -
    # anders toont de Kalender-preview een manual_weekly-event dat de echte
    # scan-plan-stap toch overslaat.
    health = _poule_health(session, [p.poule_id for p in manual_poules], now)

    events = []
    day = now.replace(hour=window_start_h, minute=0, second=0, microsecond=0)
    if day < now:
        day += timedelta(days=1)
    while day <= horizon_end:
        if day.weekday() < MANUAL_SCAN_WEEKDAYS:
            for poule in manual_poules:
                if poule.competition_id in hl_linked_comp_ids:
                    continue
                if _manual_scan_weekday(poule.competition_id) != day.weekday():
                    continue
                if _is_healthy(health, poule.poule_id):
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
    cyclus ineens gequeued worden i.p.v. geleidelijk over meerdere passes.

    Alleen teams BINNEN het actieve queue-filter (Bart, 30-08-2026: 'dit
    zijn allemaal senioren poules') - zelfde check als _step_new_or_empty_
    poules, anders vult een reeks buiten-filter-ontdekkingen dezelfde cap
    als de echte (Junioren-)ontdekkingen en blijft het als nutteloze
    clutter in het scanschema staan."""
    events: List[dict] = []
    queued_poule_ids = _pending_poule_ids(session)
    captured_ids = {p.poule_id for p in session.exec(select(HockeyPoule)).all()}
    seen: set = set()
    ages, club, cats, hts, genders = _get_queue_filter(session)

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
        if not _cmd_matches_filter(session, "get_poule", {"team_id": t.team_id}, ages, club, cats, hts, genders):
            continue
        pid = t.recent_poule_id
        if pid in captured_ids or pid in queued_poule_ids or pid in seen:
            continue
        seen.add(pid)
        events.append(_event("poule", pid, "get_poule", {"poule_id": pid, "team_id": t.team_id, "label": t.name}, now, "new_or_empty"))

    # Bart, 30-08-2026: geen club-scans in het weekend (zelfde regel als
    # _step_club_scan) - niet tijdsgevoelig, laat de scan-capaciteit dan
    # over aan matchday-scans.
    if now.weekday() < 5:  # 5=zaterdag, 6=zondag
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
    retry_match_end_m   = _get_int_setting(session, "retry_match_end_min", 10)
    live_check_delay_m  = _get_int_setting(session, "live_check_delay_min", 15)
    burst_stop_h        = _get_int_setting(session, "burst_stop_hours_after_last_match", 2)
    daily_fallback_h    = _get_int_setting(session, "active_daily_fallback_hours", 24)
    unknown_lookahead_d = _get_int_setting(session, "unknown_start_lookahead_days", 5)
    unknown_fallback_h  = _get_int_setting(session, "unknown_start_fallback_hours", 8)
    window_start_h      = _get_int_setting(session, "scan_window_start_hour", DEFAULT_SCAN_WINDOW_START_HOUR)
    window_end_h        = _get_int_setting(session, "scan_window_end_hour", DEFAULT_SCAN_WINDOW_END_HOUR)
    skip_healthy        = _skip_healthy_daily_fallback(session)

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
        health = _poule_health(session, [p.poule_id for p in poules], now)
        for poule in poules:
            if poule.competition_id in hl_linked_comp_ids:
                continue
            team = team_by_poule.get(poule.poule_id)
            if not team:
                continue
            matches = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).all()
            matchday_evts = _poule_matchday_events(
                poule, team, matches, now, horizon_end,
                match_duration_m, retry_match_end_m, live_check_delay_m, burst_stop_h,
            )
            # Prioriteitsvolgorde zoals _matchday_due_reason: een matchday-
            # burst/live-check-scan werkt last_scanned_at al bij, wat de
            # cadans van de lager-geprioriteerde unknown_start_recheck en
            # daily_fallback verderop verschuift - zonder dit verscheen bv.
            # een daily_fallback-rij midden in een actief burst-venster.
            preempt = sorted(e["planned_at"] for e in matchday_evts)
            unknown_evts = _poule_unknown_start_events(
                poule, team, matches, now, horizon_end, unknown_lookahead_d, unknown_fallback_h, window_start_h, window_end_h,
                preempting_at=preempt,
            )
            preempt = sorted(preempt + [e["planned_at"] for e in unknown_evts])
            fallback_evts = _poule_daily_fallback_events(
                poule, team, matches, now, horizon_end, daily_fallback_h, window_start_h, window_end_h, preempting_at=preempt,
                skip_if_healthy=skip_healthy and _is_healthy(health, poule.poule_id),
            )
            events += matchday_evts + unknown_evts + fallback_evts

    # Landelijke competities (hl_comp_id gezet) worden - net als in
    # _step_landelijke_competitions - behandeld als 1 grote poule over de
    # vereniging van alle wedstrijden in AL haar poules, ongeacht
    # scan_profile (die stap kijkt niet naar HockeyPublicationComp).
    for comp in session.exec(select(HockeyCompetition).where(col(HockeyCompetition.hl_comp_id).is_not(None))).all():
        poules = session.exec(select(HockeyPoule).where(HockeyPoule.competition_id == comp.id)).all()
        if not poules:
            events.append(_event(
                "competition", comp.hl_comp_id, "get_competition_detail",
                {"comp_id": comp.hl_comp_id, "label": comp.name}, now, "new_or_empty",
            ))
            continue
        poule_ids = [p.poule_id for p in poules]
        matches = session.exec(select(HockeyPouleMatch).where(col(HockeyPouleMatch.poule_id).in_(poule_ids))).all()
        last_scanned_at = None if any(p.last_scanned_at is None for p in poules) else min(p.last_scanned_at for p in poules)
        matchday_evts = _landelijke_matchday_events(
            comp, matches, last_scanned_at, now, horizon_end,
            match_duration_m, retry_match_end_m, live_check_delay_m, burst_stop_h,
        )
        preempt = sorted(e["planned_at"] for e in matchday_evts)
        unknown_evts = _landelijke_unknown_start_events(
            comp, matches, last_scanned_at, now, horizon_end, unknown_lookahead_d, unknown_fallback_h, window_start_h, window_end_h,
            preempting_at=preempt,
        )
        preempt = sorted(preempt + [e["planned_at"] for e in unknown_evts])
        comp_health = _poule_health(session, poule_ids, now)
        fallback_evts = _landelijke_daily_fallback_events(
            comp, matches, last_scanned_at, now, horizon_end, daily_fallback_h, window_start_h, window_end_h, preempting_at=preempt,
            skip_if_healthy=skip_healthy and all(_is_healthy(comp_health, pid) for pid in poule_ids),
        )
        events += matchday_evts + unknown_evts + fallback_evts

    events += _manual_weekly_events(session, now, horizon_end, team_by_poule, window_start_h)
    events += _immediate_events(session, now, get_target_season(session), STEP_MAX_CMDS)
    return events


def _target_events(session: Session, now: datetime, horizon_end: datetime, target_type: str, target_id: int) -> List[dict]:
    """match_start_check/match_end_check/unknown_start_recheck/daily_fallback
    voor 1 poule of 1 landelijke competitie - het doel-specifieke deel van
    build_schedule_events, hergebruikt door rebuild_schedule_for_target.
    manual_weekly/new_or_empty/club_scan/club_list horen hier bewust niet
    bij - die hangen niet af van het resultaat van 1 scan."""
    match_duration_m    = _get_int_setting(session, "match_duration_min", 90)
    retry_match_end_m   = _get_int_setting(session, "retry_match_end_min", 10)
    live_check_delay_m  = _get_int_setting(session, "live_check_delay_min", 15)
    burst_stop_h        = _get_int_setting(session, "burst_stop_hours_after_last_match", 2)
    daily_fallback_h    = _get_int_setting(session, "active_daily_fallback_hours", 24)
    unknown_lookahead_d = _get_int_setting(session, "unknown_start_lookahead_days", 5)
    unknown_fallback_h  = _get_int_setting(session, "unknown_start_fallback_hours", 8)
    window_start_h      = _get_int_setting(session, "scan_window_start_hour", DEFAULT_SCAN_WINDOW_START_HOUR)
    window_end_h        = _get_int_setting(session, "scan_window_end_hour", DEFAULT_SCAN_WINDOW_END_HOUR)
    skip_healthy        = _skip_healthy_daily_fallback(session)

    if target_type == "poule":
        poule = session.exec(select(HockeyPoule).where(HockeyPoule.poule_id == target_id)).first()
        if not poule:
            return []
        # Zelfde gating als de poule-lus in build_schedule_events: alleen
        # scan_profile='active'-competities krijgen matchday-gebaseerde
        # events, en een aan hl_comp_id gekoppelde poule wordt sowieso al
        # via haar competitie (target_type='competition') ververst.
        comp = session.get(HockeyCompetition, poule.competition_id)
        if not comp or comp.hl_comp_id is not None:
            return []
        is_active = session.exec(
            select(HockeyPublicationComp)
            .where(HockeyPublicationComp.competition_id == poule.competition_id)
            .where(HockeyPublicationComp.scan_profile == "active")
        ).first() is not None
        if not is_active:
            return []
        team = _team_for_poule(session, poule.poule_id)
        if not team:
            return []
        matches = session.exec(select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)).all()
        matchday_evts = _poule_matchday_events(
            poule, team, matches, now, horizon_end,
            match_duration_m, retry_match_end_m, live_check_delay_m, burst_stop_h,
        )
        preempt = sorted(e["planned_at"] for e in matchday_evts)
        unknown_evts = _poule_unknown_start_events(
            poule, team, matches, now, horizon_end, unknown_lookahead_d, unknown_fallback_h, window_start_h, window_end_h,
            preempting_at=preempt,
        )
        preempt = sorted(preempt + [e["planned_at"] for e in unknown_evts])
        health = _poule_health(session, [poule.poule_id], now)
        fallback_evts = _poule_daily_fallback_events(
            poule, team, matches, now, horizon_end, daily_fallback_h, window_start_h, window_end_h, preempting_at=preempt,
            skip_if_healthy=skip_healthy and _is_healthy(health, poule.poule_id),
        )
        return matchday_evts + unknown_evts + fallback_evts

    if target_type == "competition":
        comp = session.exec(select(HockeyCompetition).where(HockeyCompetition.hl_comp_id == target_id)).first()
        if not comp:
            return []
        poules = session.exec(select(HockeyPoule).where(HockeyPoule.competition_id == comp.id)).all()
        if not poules:
            return [_event(
                "competition", comp.hl_comp_id, "get_competition_detail",
                {"comp_id": comp.hl_comp_id, "label": comp.name}, now, "new_or_empty",
            )]
        poule_ids = [p.poule_id for p in poules]
        matches = session.exec(select(HockeyPouleMatch).where(col(HockeyPouleMatch.poule_id).in_(poule_ids))).all()
        last_scanned_at = None if any(p.last_scanned_at is None for p in poules) else min(p.last_scanned_at for p in poules)
        matchday_evts = _landelijke_matchday_events(
            comp, matches, last_scanned_at, now, horizon_end,
            match_duration_m, retry_match_end_m, live_check_delay_m, burst_stop_h,
        )
        preempt = sorted(e["planned_at"] for e in matchday_evts)
        unknown_evts = _landelijke_unknown_start_events(
            comp, matches, last_scanned_at, now, horizon_end, unknown_lookahead_d, unknown_fallback_h, window_start_h, window_end_h,
            preempting_at=preempt,
        )
        preempt = sorted(preempt + [e["planned_at"] for e in unknown_evts])
        comp_health = _poule_health(session, poule_ids, now)
        fallback_evts = _landelijke_daily_fallback_events(
            comp, matches, last_scanned_at, now, horizon_end, daily_fallback_h, window_start_h, window_end_h, preempting_at=preempt,
            skip_if_healthy=skip_healthy and all(_is_healthy(comp_health, pid) for pid in poule_ids),
        )
        return matchday_evts + unknown_evts + fallback_evts

    return []


def rebuild_schedule_for_target(
    session: Session, now: datetime, horizon_days: int, target_type: str, target_id: int,
) -> int:
    """Lichtgewicht, doel-specifieke variant van rebuild_schedule (Bart,
    30-08-2026: 'ik neem aan dat je alleen de relevante delen herbouwt?') -
    herberekent alleen de events voor 1 poule of 1 landelijke competitie,
    i.p.v. de HELE dataset (~900 relevante poules, ~1-1.3s per keer). Nodig
    omdat post_cmd_result dit na ELK get_poule/get_competition_detail-
    resultaat aanroept (Wijziging 1) - een volledige rebuild bij elke
    binnenkomende scan zou tijdens een drukke wedstrijddag met veel
    gelijktijdige captures onnodig veel tijd kosten voor doelen die niet
    eens net zijn ververst. De periodieke rebuild (_maybe_run_scan_plan_
    pass) blijft de volledige rebuild_schedule gebruiken - die loopt
    hooguit elke profile_scan_interval_min, geen probleem."""
    horizon_end = now + timedelta(days=horizon_days)
    stale = session.exec(
        select(ScanScheduleEntry)
        .where(ScanScheduleEntry.status == "planned")
        .where(ScanScheduleEntry.target_type == target_type)
        .where(ScanScheduleEntry.target_id == target_id)
        .where(ScanScheduleEntry.planned_at <= horizon_end)
    ).all()
    for entry in stale:
        session.delete(entry)

    events = _target_events(session, now, horizon_end, target_type, target_id)
    for ev in events:
        session.add(ScanScheduleEntry(**ev))
    session.commit()
    return len(events)


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
    meerdere passes i.p.v. willekeurig.

    Fase C, item 1015 (Bart, 30-08-2026, akkoord): de queue-filter (leeftijd/
    geslacht/hockeytype/club) wordt hier toegepast, op het moment van
    PROMOTIE - niet pas bij het oppakken zoals vandaag nog gebeurt in
    GET /vanger/cmd-queue/next (die check blijft voorlopig als vangnet
    staan, defense in depth). Een entry die niet bij het filter past wordt
    NIET gepromoveerd maar op status='cancelled' gezet, zodat de Debug-tab
    expliciet kan tonen dat 'm bewust is overgeslagen i.p.v. onzichtbaar te
    laten verdwijnen. Handmatige/ad-hoc toevoegingen (Discovery 'scan nu',
    POST /vanger/cmd-queue/add) gaan hier nooit doorheen - die roepen
    add_vanger_cmd rechtstreeks aan, buiten het scanschema om, en blijven
    dus het filter omzeilen zoals bedoeld.

    item 1019: entry.reason wordt hier expliciet doorgegeven aan add_vanger_cmd
    (was eerder een omissie) - anders krijgt een gepromoveerde cmd reason=None
    en zou GET /vanger/cmd-queue/next 'm per ongeluk als handmatig/ad-hoc
    behandelen (filter-bypass), terwijl deze cmd hierboven al netjes tegen het
    filter is gecheckt op het moment van promotie."""
    from routers.hockey_vanger_cmd_queue import add_vanger_cmd  # lokale import: voorkomt circulaire import op module-niveau

    ages, club, cats, hts, genders = _get_queue_filter(session)

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
        if not _cmd_matches_filter(session, entry.cmd_type, params, ages, club, cats, hts, genders):
            entry.status = "cancelled"
            session.add(entry)
            continue
        result = add_vanger_cmd(session, entry.cmd_type, params, reason=entry.reason)
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
