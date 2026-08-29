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
        ))
        added += 1
    return added


def _step_landelijke_competitions(session: Session, now: datetime, cap: int) -> int:
    """Competities met een bekend hl_comp_id (landelijke top-/subtopklasses) in 1x
    via get_competition_detail scannen i.p.v. per poule - die poules zijn alleen
    via de comp-detail-sync ontdekt en hebben dus geen team_id (item 945), dus
    _step_new_or_empty_poules/_step_active_profiles slaan ze altijd stil over."""
    hours = _get_int_setting(session, "landelijke_comp_scan_hours", 12)
    cutoff = now - timedelta(hours=hours)

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
        due = not poules or any(p.last_scanned_at is None or p.last_scanned_at < cutoff for p in poules)
        if not due:
            continue
        session.add(VangerCmd(
            cmd_type="get_competition_detail",
            params=json.dumps({"comp_id": comp.hl_comp_id, "label": comp.name}),
            status="pending",
        ))
        queued_comp_ids.add(comp.hl_comp_id)
        added += 1
    return added


def _step_active_profiles(session: Session, now: datetime, cap: int) -> int:
    match_duration      = _get_int_setting(session, "match_duration_min", 90)
    daily_fallback_h     = _get_int_setting(session, "active_daily_fallback_hours", 24)
    matchday_interval_m  = _get_int_setting(session, "active_matchday_interval_min", 45)
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

        due = False
        if matchday_enabled:
            matches = session.exec(
                select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)
            ).all()

            known_ends = []
            has_unknown_today = False
            for m in matches:
                if not m.match_date:
                    continue
                info = _match_dt_info(m.match_date)
                if not info:
                    continue
                utc_naive, is_today, is_midnight = info
                if not is_today:
                    continue
                if is_midnight:
                    has_unknown_today = True
                else:
                    known_ends.append(utc_naive + timedelta(minutes=match_duration))

            if known_ends:
                if now >= min(known_ends):
                    cutoff = now - timedelta(minutes=matchday_interval_m)
                    due = poule.last_scanned_at is None or poule.last_scanned_at < cutoff
            elif has_unknown_today:
                cutoff = now - timedelta(minutes=matchday_interval_m)
                due = poule.last_scanned_at is None or poule.last_scanned_at < cutoff

        if not due:
            cutoff = now - timedelta(hours=daily_fallback_h)
            due = poule.last_scanned_at is None or poule.last_scanned_at < cutoff

        if not due:
            continue

        t = team_by_poule.get(poule.poule_id)
        if not t:
            continue
        session.add(VangerCmd(
            cmd_type="get_poule",
            params=json.dumps({"poule_id": poule.poule_id, "team_id": t.team_id, "label": t.name + " — " + (poule.name or "")}),
            status="pending",
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
    }
    added = sum(steps.values())
    session.commit()
    return {"added": added, "steps": steps}
