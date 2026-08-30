"""Vanger scan-plan: tijdgestuurde, profiel-gebaseerde queuing (item 720).

Vult de vanger_cmd_queue periodiek op basis van vaste regels, in plaats van
volledig af te hangen van handmatige knoppen (Gap-fill / Smart-scan-start):
- clublijst en per-club scans hebben een minimum-interval (voorkomt onnodig
  scannen vóór het seizoen begint)
- nieuwe of nog lege poules worden altijd meteen meegescand
- competities met scan_profile "active" (gekoppeld aan een publicatie) krijgen
  event-driven herscans rond wedstrijden, plus een dagelijkse fallback
"""
import json
from datetime import datetime, time as dtime, timedelta, timezone
from typing import Dict, Optional, Tuple

from sqlmodel import Session, col, select

from models.hockey import HockeyPublicationComp
from models.hockey_discovery import (
    HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyTeam, VangerCmd,
)
from models.settings import AppSetting
from services.hockey_vanger_filters import _is_scoreless_youth
from services.hockey_vanger_settings import _get_int_setting, get_target_season

STEP_MAX_CMDS = 10

# item 968: aparte aan/uit-schakelaar voor de event-driven matchday-boost in
# _step_active_profiles, los van de algehele scan_plan_enabled-schakelaar
# (die zit in routers/hockey_vanger.py). Uitgeschakeld -> "active"-competities
# (al gescoped op HockeyPublicationComp, dus alleen publicatie-gekoppelde
# competities) vallen terug op de dagelijkse fallback-interval, ongeacht of
# er vandaag een wedstrijd is.
ACTIVE_MATCHDAY_ENABLED_KEY = "active_matchday_enabled"


def _active_matchday_enabled(session: Session) -> bool:
    row = session.get(AppSetting, ACTIVE_MATCHDAY_ENABLED_KEY)
    return row.value != "0" if row else True


def _pending_poule_ids(session: Session) -> set:
    active = session.exec(
        select(VangerCmd).where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).all()
    return {json.loads(c.params).get("poule_id") for c in active if c.cmd_type == "get_poule"}


def _pending_club_ext_ids(session: Session) -> set:
    active = session.exec(
        select(VangerCmd).where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).all()
    return {json.loads(c.params).get("external_id") for c in active if c.cmd_type == "scan_club"}


def _team_by_poule(session: Session) -> Dict[int, HockeyTeam]:
    result: Dict[int, HockeyTeam] = {}
    for t in session.exec(select(HockeyTeam).where(col(HockeyTeam.recent_poule_id).is_not(None))).all():
        if _is_scoreless_youth(t.short_name):
            continue
        result.setdefault(t.recent_poule_id, t)
    return result


def _match_dt_info(raw: str) -> Optional[Tuple[datetime, bool, bool]]:
    """Parseer match_date. Retourneert (utc_naive_dt, is_vandaag, is_middernacht_placeholder)."""
    try:
        dt = datetime.fromisoformat(raw)
    except (ValueError, TypeError):
        return None
    if dt.tzinfo is not None:
        now_local = datetime.now(dt.tzinfo)
        is_today = dt.date() == now_local.date()
        is_midnight = dt.timetz().replace(tzinfo=None) == dtime(0, 0)
        utc_naive = dt.astimezone(timezone.utc).replace(tzinfo=None)
    else:
        is_today = dt.date() == datetime.utcnow().date()
        is_midnight = dt.time() == dtime(0, 0)
        utc_naive = dt
    return utc_naive, is_today, is_midnight


def _reclaim_stale_in_progress(session: Session, now: datetime) -> int:
    """Roadmap-melding (29-08-2026, live wedstrijddag): cmd-queue/next zet een
    cmd meteen op in_progress zodra Scout/Ghost 'm ophaalt, vóór er ook maar
    iets verwerkt is. Crasht/herstart Scout/Ghost daarna (bv. een hockey.nl-
    timeout die niet netjes afgevangen wordt) dan wordt nooit meer /result
    aangeroepen - de cmd blijft voor altijd in_progress hangen, en blokkeert
    zijn poule/club permanent voor herscannen (_pending_poule_ids/
    _pending_club_ext_ids tellen in_progress net zo goed mee als pending).
    Elke pass: cmd's die te lang in_progress staan terugzetten naar failed,
    zodat hun poule/club de eerstvolgende pass weer opnieuw gequeued kan
    worden. Timeout ruim boven een normale doorlooptijd (~15-30s per cmd)."""
    timeout_min = _get_int_setting(session, "stale_cmd_timeout_min", 10)
    cutoff = now - timedelta(minutes=timeout_min)
    stale = session.exec(
        select(VangerCmd).where(VangerCmd.status == "in_progress").where(VangerCmd.started_at < cutoff)
    ).all()
    for cmd in stale:
        cmd.status = "failed"
        cmd.error = f"Timeout - geen resultaat ontvangen binnen {timeout_min} min (Scout/Ghost waarschijnlijk gecrasht of herstart)"
        cmd.finished_at = now
        session.add(cmd)
    return len(stale)


def _step_club_list(session: Session, now: datetime) -> int:
    days = _get_int_setting(session, "club_list_scan_days", 7)
    pending = session.exec(
        select(VangerCmd)
        .where(VangerCmd.cmd_type == "get_clubs")
        .where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).first()
    if pending:
        return 0
    last_done = session.exec(
        select(VangerCmd)
        .where(VangerCmd.cmd_type == "get_clubs")
        .where(VangerCmd.status == "done")
        .order_by(col(VangerCmd.finished_at).desc())
    ).first()
    if last_done and last_done.finished_at and last_done.finished_at >= now - timedelta(days=days):
        return 0
    session.add(VangerCmd(
        cmd_type="get_clubs",
        params=json.dumps({"label": "Alle clubs (scan-plan)"}),
        status="pending",
        reason="club_list",
    ))
    return 1


def _step_new_or_empty_poules(session: Session, target_season: str, cap: int) -> int:
    added = 0
    queued_poule_ids = _pending_poule_ids(session)
    captured_ids = {p.poule_id for p in session.exec(select(HockeyPoule)).all()}
    seen: set = set()

    teams = session.exec(
        select(HockeyTeam)
        .where(col(HockeyTeam.recent_poule_id).is_not(None))
        .where(HockeyTeam.no_new_poule_confirmed == False)  # noqa: E712
        .where(HockeyTeam.season_pending == False)  # noqa: E712
    ).all()
    for t in teams:
        if added >= cap:
            return added
        if _is_scoreless_youth(t.short_name):
            continue
        pid = t.recent_poule_id
        if pid in captured_ids or pid in queued_poule_ids or pid in seen:
            continue
        seen.add(pid)
        session.add(VangerCmd(
            cmd_type="get_poule",
            params=json.dumps({"poule_id": pid, "team_id": t.team_id, "label": t.name}),
            status="pending",
            reason="new_or_empty",
        ))
        added += 1

    if added >= cap:
        return added

    poules = session.exec(select(HockeyPoule).where(HockeyPoule.season == target_season)).all()
    poule_ids = [p.poule_id for p in poules]
    match_poule_ids = set(session.exec(
        select(HockeyPouleMatch.poule_id).where(col(HockeyPouleMatch.poule_id).in_(poule_ids))
    ).all()) if poule_ids else set()
    team_by_poule = _team_by_poule(session)
    # item 1013: zelfde reden als in _step_active_profiles - een landelijke
    # competitie wordt al in 1x ververst via _step_landelijke_competitions.
    hl_linked_comp_ids = {
        c.id for c in session.exec(
            select(HockeyCompetition).where(col(HockeyCompetition.hl_comp_id).is_not(None))
        ).all()
    }

    for p in poules:
        if added >= cap:
            break
        if p.poule_id in match_poule_ids or p.poule_id in queued_poule_ids or p.poule_id in seen:
            continue
        if p.competition_id in hl_linked_comp_ids:
            continue
        t = team_by_poule.get(p.poule_id)
        if not t:
            continue
        session.add(VangerCmd(
            cmd_type="get_poule",
            params=json.dumps({"poule_id": p.poule_id, "team_id": t.team_id, "label": t.name + " — " + (p.name or "")}),
            status="pending",
            reason="new_or_empty",
        ))
        added += 1
    return added


def _step_club_scan(session: Session, now: datetime, cap: int) -> int:
    days = _get_int_setting(session, "club_scan_days", 1)
    cutoff = now - timedelta(days=days)
    queued_ext_ids = _pending_club_ext_ids(session)

    season_pending_teams = session.exec(
        select(HockeyTeam).where(HockeyTeam.season_pending == True)  # noqa: E712
    ).all()
    clubs_pending_ext = {t.club_external_id for t in season_pending_teams}

    candidates: Dict[str, HockeyClub] = {
        c.external_id: c for c in session.exec(
            select(HockeyClub).where(HockeyClub.detail_loaded == False)  # noqa: E712
        ).all()
    }
    for ext_id in clubs_pending_ext:
        if ext_id in candidates:
            continue
        club = session.exec(select(HockeyClub).where(HockeyClub.external_id == ext_id)).first()
        if club:
            candidates[ext_id] = club

    added = 0
    for ext_id, club in candidates.items():
        if added >= cap:
            break
        if ext_id in queued_ext_ids:
            continue
        if club.last_scanned_at is not None and club.last_scanned_at >= cutoff:
            continue
        session.add(VangerCmd(
            cmd_type="scan_club",
            params=json.dumps({"external_id": ext_id, "label": club.friendly_name or club.name}),
            status="pending",
            reason="club_scan",
        ))
        added += 1
    return added


def _matchday_due_reason(
    now: datetime,
    matches,
    last_scanned_at: Optional[datetime],
    *,
    match_duration: int,
    matchday_interval_m: int,
    live_check_delay_m: int,
    burst_stop_h: int,
    unknown_start_lookahead_d: int,
    unknown_start_fallback_h: int,
    daily_fallback_h: int,
    matchday_enabled: bool,
) -> Tuple[bool, Optional[str]]:
    """Bepaalt of - en waarom - een set wedstrijden nu een herscan nodig
    heeft: matchday-burst tijdens/na een wedstrijd van vandaag, 1x
    live-check kort na aanvang (item 970), vaker checken bij een nog
    onbekende starttijd binnen afzienbare tijd (item 992), anders de trage
    dagelijkse fallback. Gedeeld tussen _step_active_profiles (matches van 1
    poule) en _step_landelijke_competitions (matches van ALLE poules in de
    competitie samen, Bart 30-08-2026: een landelijke competitie wordt
    hiermee behandeld als 1 grote poule, geen aparte cadans meer)."""
    due = False
    reason = None

    if matchday_enabled:
        known_starts = []
        known_ends = []
        today_matches = []
        has_unknown_today = False
        unknown_start_dates = []  # niet-vandaag, wel al een datum maar nog geen starttijd (middernacht-placeholder)
        for m in matches:
            if not m.match_date:
                continue
            info = _match_dt_info(m.match_date)
            if not info:
                continue
            utc_naive, is_today, is_midnight = info
            if not is_today:
                if is_midnight:
                    unknown_start_dates.append(utc_naive.date())
                continue
            if is_midnight:
                has_unknown_today = True
            else:
                known_starts.append(utc_naive)
                known_ends.append(utc_naive + timedelta(minutes=match_duration))
                today_matches.append(m)

        if known_ends:
            # Burst-modus stopt zodra ofwel alle wedstrijden van vandaag al
            # "final" zijn (niets meer te halen), ofwel er meer dan
            # burst_stop_h uur voorbij is sinds de LAATSTE wedstrijd
            # eindigde.
            all_final = all(m.status == "final" for m in today_matches)
            burst_deadline = max(known_ends) + timedelta(hours=burst_stop_h)
            burst_active = now < burst_deadline and not all_final
            if burst_active and now >= min(known_ends):
                cutoff = now - timedelta(minutes=matchday_interval_m)
                due = last_scanned_at is None or last_scanned_at < cutoff
                if due:
                    reason = "matchday_burst"
        elif has_unknown_today:
            cutoff = now - timedelta(minutes=matchday_interval_m)
            due = last_scanned_at is None or last_scanned_at < cutoff
            if due:
                reason = "matchday_burst"

        # item 970: kort na aanvang van een wedstrijd 1x checken of hij
        # live-status heeft gekregen i.p.v. pas na afloop te reageren.
        if not due:
            for start in known_starts:
                check_at = start + timedelta(minutes=live_check_delay_m)
                check_window_end = check_at + timedelta(minutes=matchday_interval_m)
                if check_at <= now < check_window_end and (last_scanned_at is None or last_scanned_at < start):
                    due = True
                    reason = "live_check"
                    break

        # Bart, 30-08-2026: tussen het 1x live_check-moment en het einde van
        # de EERSTE wedstrijd van de dag (waarna matchday_burst overneemt)
        # zat een dode zone - een wedstrijd die al langer bezig is dan het
        # live_check-venster, maar nog niet is afgelopen, werd helemaal niet
        # herscand. live_update dekt dat gat: zelfde interval als burst,
        # zolang de wedstrijd loopt.
        if not due:
            for start, end in zip(known_starts, known_ends):
                if not (start <= now < end):
                    continue
                check_window_end = start + timedelta(minutes=live_check_delay_m + matchday_interval_m)
                if now < check_window_end:
                    continue
                cutoff = now - timedelta(minutes=matchday_interval_m)
                if last_scanned_at is None or last_scanned_at < cutoff:
                    due = True
                    reason = "live_update"
                break

        # Wedstrijd binnen unknown_start_lookahead_d dagen bekend, maar nog
        # zonder starttijd - vaker checken dan de trage dagelijkse fallback.
        if not due and unknown_start_dates:
            lookahead_end = (now + timedelta(days=unknown_start_lookahead_d)).date()
            if any(now.date() <= d <= lookahead_end for d in unknown_start_dates):
                cutoff = now - timedelta(hours=unknown_start_fallback_h)
                due = last_scanned_at is None or last_scanned_at < cutoff
                if due:
                    reason = "unknown_start_recheck"

    if not due:
        cutoff = now - timedelta(hours=daily_fallback_h)
        due = last_scanned_at is None or last_scanned_at < cutoff
        if due:
            reason = "daily_fallback"

    return due, reason


def _step_landelijke_competitions(session: Session, now: datetime, cap: int) -> int:
    """Competities met een bekend hl_comp_id (landelijke top-/subtopklasses) in 1x
    via get_competition_detail scannen i.p.v. per poule - die poules zijn alleen
    via de comp-detail-sync ontdekt en hebben dus geen team_id (item 945), dus
    _step_new_or_empty_poules/_step_active_profiles slaan ze altijd stil over.

    Behandelt de competitie als 1 grote "poule": dezelfde matchday-burst/
    live-check/dagelijkse-fallback-regels als _step_active_profiles, maar
    dan over de VERENIGING van alle wedstrijden in al haar poules (1
    get_competition_detail-call ververst ze toch in 1x). De eerdere vaste
    landelijke_comp_scan_hours-cadans (matchday-blind, elke N uur ongeacht
    of er een wedstrijd bezig is) is vervallen (Bart, 30-08-2026)."""
    match_duration      = _get_int_setting(session, "match_duration_min", 90)
    daily_fallback_h     = _get_int_setting(session, "active_daily_fallback_hours", 24)
    matchday_interval_m  = _get_int_setting(session, "active_matchday_interval_min", 45)
    live_check_delay_m  = _get_int_setting(session, "live_check_delay_min", 15)
    burst_stop_h         = _get_int_setting(session, "burst_stop_hours_after_last_match", 2)
    unknown_start_lookahead_d = _get_int_setting(session, "unknown_start_lookahead_days", 5)
    unknown_start_fallback_h  = _get_int_setting(session, "unknown_start_fallback_hours", 8)
    matchday_enabled     = _active_matchday_enabled(session)

    comps = session.exec(
        select(HockeyCompetition).where(col(HockeyCompetition.hl_comp_id).is_not(None))
    ).all()
    if not comps:
        return 0

    pending = session.exec(
        select(VangerCmd)
        .where(VangerCmd.cmd_type == "get_competition_detail")
        .where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).all()
    queued_comp_ids = {json.loads(c.params).get("comp_id") for c in pending}

    added = 0
    for comp in comps:
        if added >= cap:
            break
        if comp.hl_comp_id in queued_comp_ids:
            continue
        poules = session.exec(
            select(HockeyPoule).where(HockeyPoule.competition_id == comp.id)
        ).all()
        if not poules:
            # Competitie zelf al ontdekt, maar poules nog niet (die komen pas
            # binnen via deze zelfde get_competition_detail-call) - meteen
            # scannen, net als new_or_empty voor losse poules.
            due, reason = True, "new_or_empty"
        else:
            poule_ids = [p.poule_id for p in poules]
            matches = session.exec(
                select(HockeyPouleMatch).where(col(HockeyPouleMatch.poule_id).in_(poule_ids))
            ).all()
            last_scanned_at = None if any(p.last_scanned_at is None for p in poules) else min(p.last_scanned_at for p in poules)
            due, reason = _matchday_due_reason(
                now, matches, last_scanned_at,
                match_duration=match_duration, matchday_interval_m=matchday_interval_m,
                live_check_delay_m=live_check_delay_m, burst_stop_h=burst_stop_h,
                unknown_start_lookahead_d=unknown_start_lookahead_d, unknown_start_fallback_h=unknown_start_fallback_h,
                daily_fallback_h=daily_fallback_h, matchday_enabled=matchday_enabled,
            )
        if not due:
            continue
        session.add(VangerCmd(
            cmd_type="get_competition_detail",
            params=json.dumps({"comp_id": comp.hl_comp_id, "label": comp.name}),
            status="pending",
            reason=reason,
        ))
        queued_comp_ids.add(comp.hl_comp_id)
        added += 1
    return added


def _step_active_profiles(session: Session, now: datetime, cap: int) -> int:
    match_duration      = _get_int_setting(session, "match_duration_min", 90)
    daily_fallback_h     = _get_int_setting(session, "active_daily_fallback_hours", 24)
    matchday_interval_m  = _get_int_setting(session, "active_matchday_interval_min", 45)
    live_check_delay_m  = _get_int_setting(session, "live_check_delay_min", 15)
    burst_stop_h         = _get_int_setting(session, "burst_stop_hours_after_last_match", 2)
    unknown_start_lookahead_d = _get_int_setting(session, "unknown_start_lookahead_days", 5)
    unknown_start_fallback_h  = _get_int_setting(session, "unknown_start_fallback_hours", 8)
    matchday_enabled     = _active_matchday_enabled(session)

    active_comp_ids = set(session.exec(
        select(HockeyPublicationComp.competition_id)
        .where(HockeyPublicationComp.scan_profile == "active")
    ).all())
    if not active_comp_ids:
        return 0

    poules = session.exec(
        select(HockeyPoule).where(col(HockeyPoule.competition_id).in_(active_comp_ids))
    ).all()
    if not poules:
        return 0

    queued_poule_ids = _pending_poule_ids(session)
    team_by_poule = _team_by_poule(session)
    # item 1013: landelijke (hl_comp_id-gekoppelde) competities worden al in
    # 1x via _step_landelijke_competitions ververst (1 get_competition_detail
    # i.p.v. losse get_poule per poule - veel efficienter, en voorkomt de
    # duplicaat-competitie-rij-race bij losse poule-scans). Poules van zo'n
    # competitie hier overslaan i.p.v. individueel te (her)scannen.
    hl_linked_comp_ids = {
        c.id for c in session.exec(
            select(HockeyCompetition)
            .where(col(HockeyCompetition.id).in_(active_comp_ids))
            .where(col(HockeyCompetition.hl_comp_id).is_not(None))
        ).all()
    }

    added = 0
    for poule in poules:
        if added >= cap:
            break
        if poule.poule_id in queued_poule_ids:
            continue
        if poule.competition_id in hl_linked_comp_ids:
            continue

        matches = session.exec(
            select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)
        ).all()
        due, reason = _matchday_due_reason(
            now, matches, poule.last_scanned_at,
            match_duration=match_duration, matchday_interval_m=matchday_interval_m,
            live_check_delay_m=live_check_delay_m, burst_stop_h=burst_stop_h,
            unknown_start_lookahead_d=unknown_start_lookahead_d, unknown_start_fallback_h=unknown_start_fallback_h,
            daily_fallback_h=daily_fallback_h, matchday_enabled=matchday_enabled,
        )
        if not due:
            continue

        t = team_by_poule.get(poule.poule_id)
        if not t:
            continue
        session.add(VangerCmd(
            cmd_type="get_poule",
            params=json.dumps({"poule_id": poule.poule_id, "team_id": t.team_id, "label": t.name + " — " + (poule.name or "")}),
            status="pending",
            reason=reason,
        ))
        added += 1
    return added


MANUAL_SCAN_WEEKDAYS = 5  # maandag t/m vrijdag (0..4) - _manual_scan_weekday spreidt de load hierover


def _manual_scan_weekday(competition_id: int) -> int:
    """Welke werkdag (0=maandag..4=vrijdag) een scan_profile='manual'-competitie
    krijgt toegewezen voor haar wekelijkse herscan - gedeeld tussen het
    scan-plan zelf en de kalender-weergave, zodat ze nooit uit de pas lopen."""
    return competition_id % MANUAL_SCAN_WEEKDAYS


def _step_manual_profiles_weekly(session: Session, now: datetime, cap: int) -> int:
    """Gepubliceerde competities die niet op scan_profile='active' staan
    (scan_profile='manual') worden door _step_active_profiles genegeerd -
    maar moeten alsnog periodiek ververst worden, alleen minder vaak. 1x per
    week, verdeeld over de 5 werkdagen (op basis van competitie-id) zodat ze
    niet allemaal op dezelfde dag/moment gescand worden."""
    if now.weekday() >= MANUAL_SCAN_WEEKDAYS:  # weekend - geen ronde
        return 0

    manual_comp_ids = set(session.exec(
        select(HockeyPublicationComp.competition_id).where(HockeyPublicationComp.scan_profile == "manual")
    ).all())
    if not manual_comp_ids:
        return 0

    hl_linked_comp_ids = {
        c.id for c in session.exec(
            select(HockeyCompetition)
            .where(col(HockeyCompetition.id).in_(manual_comp_ids))
            .where(col(HockeyCompetition.hl_comp_id).is_not(None))
        ).all()
    }  # al gedekt door _step_landelijke_competitions, ongeacht scan_profile

    poules = session.exec(
        select(HockeyPoule).where(col(HockeyPoule.competition_id).in_(manual_comp_ids))
    ).all()
    if not poules:
        return 0

    queued_poule_ids = _pending_poule_ids(session)
    team_by_poule = _team_by_poule(session)

    added = 0
    for poule in poules:
        if added >= cap:
            break
        if poule.poule_id in queued_poule_ids or poule.competition_id in hl_linked_comp_ids:
            continue
        if now.weekday() != _manual_scan_weekday(poule.competition_id):
            continue
        cutoff = now - timedelta(days=6)
        if not (poule.last_scanned_at is None or poule.last_scanned_at < cutoff):
            continue
        t = team_by_poule.get(poule.poule_id)
        if not t:
            continue
        session.add(VangerCmd(
            cmd_type="get_poule",
            params=json.dumps({"poule_id": poule.poule_id, "team_id": t.team_id, "label": t.name + " — " + (poule.name or "")}),
            status="pending",
            reason="manual_weekly",
        ))
        added += 1
    return added


def run_scan_plan_pass(session: Session) -> dict:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    target_season = get_target_season(session)

    steps = {
        "reclaimed_stale":   _reclaim_stale_in_progress(session, now),
        "club_list":         _step_club_list(session, now),
        "new_empty_poules":  _step_new_or_empty_poules(session, target_season, STEP_MAX_CMDS),
        "club_scan":         _step_club_scan(session, now, STEP_MAX_CMDS),
        "landelijke_comps":  _step_landelijke_competitions(session, now, STEP_MAX_CMDS),
        "active_profiles":   _step_active_profiles(session, now, STEP_MAX_CMDS),
        "manual_profiles_weekly": _step_manual_profiles_weekly(session, now, STEP_MAX_CMDS),
    }
    added = sum(steps.values())
    session.commit()
    return {"added": added, "steps": steps}
