"""Hockey vanger — scan-kalender (items 1009/1011/1012): 1 endpoint dat de
berekende scan-planning (matches, burst-venster, dagelijkse fallback) en de
echte capture-historie per poule teruggeeft, voor de Kalender-tab in
hockey-inside (Dag/Week/Maand/Jaar-weergave)."""

import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.capture import DataCapture
from models.hockey import HockeyPublicationComp
from models.hockey_discovery import (
    HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyTeam, VangerCmd,
)
from services.hockey_vanger_filters import _cmd_matches_filter, _get_queue_filter
from services.hockey_vanger_scanplan import _manual_scan_weekday, _team_by_poule
from services.hockey_vanger_settings import _get_int_setting, get_notify_team_ids

router = APIRouter(prefix="/api/hockey", tags=["hockey-vanger"])

SCAN_PLAN_SETTINGS = {
    "match_duration_min":          90,
    "active_matchday_interval_min": 45,
    "active_daily_fallback_hours":  24,
    "stale_cmd_timeout_min":        10,
    "landelijke_comp_scan_hours":   12,
    "burst_stop_hours_after_last_match": 2,
}


@router.get("/vanger/scan-calendar")
def get_scan_calendar(
    from_: Optional[str] = None,
    to: Optional[str] = None,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    now = datetime.utcnow()
    range_from = _parse_date(from_) or (now - timedelta(days=45))
    range_to   = _parse_date(to)    or (now + timedelta(days=45))

    settings = {key: _get_int_setting(session, key, default) for key, default in SCAN_PLAN_SETTINGS.items()}
    ages, club, cats, hts, genders = _get_queue_filter(session)
    queue_filter = {"age_groups": ages, "club_external_id": club, "categories": cats,
                     "hockey_types": hts, "genders": genders}
    notify_team_ids = sorted(get_notify_team_ids(session))

    active_comp_ids = set(session.exec(
        select(HockeyPublicationComp.competition_id).where(HockeyPublicationComp.scan_profile == "active")
    ).all())
    manual_comp_ids = set(session.exec(
        select(HockeyPublicationComp.competition_id).where(HockeyPublicationComp.scan_profile == "manual")
    ).all())

    followed_poule_ids = {
        t.recent_poule_id for t in session.exec(
            select(HockeyTeam).where(col(HockeyTeam.team_id).in_([int(t) for t in notify_team_ids if t.isdigit()]))
        ).all()
        if t.recent_poule_id
    }

    poules = session.exec(
        select(HockeyPoule).where(
            col(HockeyPoule.competition_id).in_(active_comp_ids) | col(HockeyPoule.poule_id).in_(followed_poule_ids)
        )
    ).all() if (active_comp_ids or followed_poule_ids) else []

    all_comps = session.exec(select(HockeyCompetition)).all()
    comp_by_id = {c.id: c for c in all_comps}
    comp_by_hl_id = {c.hl_comp_id: c for c in all_comps if c.hl_comp_id}
    team_by_poule = _team_by_poule(session)

    # item: publicaties die niet op scan_profile='active' staan worden 1x per
    # week gescand (verdeeld over de 5 werkdagen, zie
    # _step_manual_profiles_weekly) - dat moet ook zichtbaar zijn, anders lijkt
    # het alsof die poules helemaal niet worden ververst.
    manual_poules = []
    if manual_comp_ids:
        for poule in session.exec(
            select(HockeyPoule).where(col(HockeyPoule.competition_id).in_(manual_comp_ids))
        ).all():
            comp = comp_by_id.get(poule.competition_id)
            if comp and comp.hl_comp_id:
                continue  # al gedekt door _step_landelijke_competitions, eigen 12u-cadans
            manual_poules.append({
                "poule_id": poule.poule_id,
                "poule_name": poule.name,
                "competition_name": comp.name if comp else None,
                "assigned_weekday": _manual_scan_weekday(poule.competition_id),  # 0=maandag..4=vrijdag
                "last_scanned_at": poule.last_scanned_at.isoformat() if poule.last_scanned_at else None,
            })

    poule_results = []
    for poule in poules:
        comp = comp_by_id.get(poule.competition_id)
        matches = session.exec(
            select(HockeyPouleMatch).where(HockeyPouleMatch.poule_id == poule.poule_id)
        ).all()
        matches_in_range = [m for m in matches if _match_in_range(m.match_date, range_from, range_to)]
        if not matches_in_range:
            continue
        is_landelijke = bool(comp and comp.hl_comp_id)
        if is_landelijke:
            in_filter = _cmd_matches_filter(
                session, "get_competition_detail", {"comp_id": comp.hl_comp_id, "label": comp.name},
                ages, club, cats, hts, genders,
            )
        else:
            team = team_by_poule.get(poule.poule_id)
            params = {"team_id": team.team_id} if team else {}
            in_filter = _cmd_matches_filter(session, "get_poule", params, ages, club, cats, hts, genders)
        poule_results.append({
            "poule_id": poule.poule_id,
            "poule_name": poule.name,
            "competition_name": comp.name if comp else None,
            "hl_comp_id": comp.hl_comp_id if comp else None,
            "is_landelijke": is_landelijke,
            "last_scanned_at": poule.last_scanned_at.isoformat() if poule.last_scanned_at else None,
            "followed": poule.poule_id in followed_poule_ids,
            "in_active_filter": in_filter,
            "matches": [
                {
                    "match_id": m.match_id,
                    "home_team_id": m.home_team_id, "home_team_name": m.home_team_name,
                    "away_team_id": m.away_team_id, "away_team_name": m.away_team_name,
                    "date": m.match_date, "status": m.status,
                    "home_score": m.home_score, "away_score": m.away_score,
                }
                for m in matches_in_range
            ],
        })

    poule_ids_in_result = {p["poule_id"] for p in poule_results}
    poule_ids_by_comp_id: dict = {}
    for poule in poules:
        if poule.poule_id in poule_ids_in_result:
            poule_ids_by_comp_id.setdefault(poule.competition_id, []).append(poule.poule_id)

    recent_captures = []
    for cap in session.exec(
        select(DataCapture)
        .where(col(DataCapture.capture_type).in_(["poule_capture", "comp_detail"]))
        .where(DataCapture.captured_at >= range_from)
        .where(DataCapture.captured_at <= range_to)
    ).all():
        for poule_id in _poule_ids_for_capture(cap, comp_by_hl_id, poule_ids_by_comp_id, poule_ids_in_result):
            recent_captures.append({
                "poule_id": poule_id,
                "captured_at": cap.captured_at.isoformat(),
                "cmd_type": cap.capture_type,
            })

    # item: naast de ECHTE captures (recent_captures, uit DataCapture) ook
    # laten zien WANNEER een cmd voor deze poule is ingepland (aangemaakt) EN
    # of hij daadwerkelijk is uitgevoerd. Geen status-filter op created_at
    # alleen: een cmd kan een dag eerder zijn aangemaakt maar pas vandaag
    # zijn afgehandeld (finished_at), dus filteren we op created_at OF
    # finished_at binnen bereik, zodat 'm op de juiste dag terugkomt. Status
    # gaat mee zodat de front-end "echt uitgevoerd" (done) kan onderscheiden
    # van "gepland maar (nog) niet uitgevoerd" (pending/in_progress/failed).
    scheduled_cmds = []
    for cmd in session.exec(
        select(VangerCmd)
        .where(col(VangerCmd.cmd_type).in_(["get_poule", "get_competition_detail"]))
        .where(
            (VangerCmd.created_at.between(range_from, range_to))
            | (VangerCmd.finished_at.is_not(None) & VangerCmd.finished_at.between(range_from, range_to))
        )
    ).all():
        try:
            params = json.loads(cmd.params)
        except (ValueError, TypeError):
            continue
        if cmd.cmd_type == "get_poule":
            poule_id = params.get("poule_id")
            target_poule_ids = [poule_id] if poule_id in poule_ids_in_result else []
        else:
            comp = comp_by_hl_id.get(params.get("comp_id"))
            target_poule_ids = poule_ids_by_comp_id.get(comp.id, []) if comp else []
        executed = cmd.status == "done"
        # Voor een echt uitgevoerde cmd is finished_at het relevante moment
        # (wanneer het resultaat binnenkwam); voor nog niet (klaar) uitgevoerde
        # cmds is dat created_at (wanneer 'm werd ingepland).
        event_at = cmd.finished_at if (executed and cmd.finished_at) else cmd.created_at
        for poule_id in target_poule_ids:
            scheduled_cmds.append({
                "poule_id": poule_id,
                "scheduled_at": cmd.created_at.isoformat(),
                "event_at": event_at.isoformat(),
                "executed": executed,
                "status": cmd.status,
                "cmd_type": cmd.cmd_type,
            })

    club_by_ext_id = {c.external_id: c for c in session.exec(select(HockeyClub)).all()}
    club_captures = []
    for cap in session.exec(
        select(DataCapture)
        .where(col(DataCapture.capture_type).in_(["club_detail", "clubs_list"]))
        .where(DataCapture.captured_at >= range_from)
        .where(DataCapture.captured_at <= range_to)
    ).all():
        if cap.capture_type == "club_detail":
            ext_id = cap.external_id.replace("club_detail_", "")
            club = club_by_ext_id.get(ext_id)
            club_captures.append({
                "club_external_id": ext_id,
                "club_name": club.friendly_name if club else ext_id,
                "captured_at": cap.captured_at.isoformat(),
                "cmd_type": "scan_club",
            })
        else:
            club_captures.append({
                "club_external_id": None,
                "club_name": "Alle clubs (clublijst)",
                "captured_at": cap.captured_at.isoformat(),
                "cmd_type": "get_clubs",
            })

    return {
        "settings": settings,
        "queue_filter": queue_filter,
        "notify_team_ids": notify_team_ids,
        "poules": poule_results,
        "recent_captures": recent_captures,
        "scheduled_cmds": scheduled_cmds,
        "club_captures": club_captures,
        "manual_poules": manual_poules,
    }


def _parse_date(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def _match_in_range(match_date: Optional[str], range_from: datetime, range_to: datetime) -> bool:
    if not match_date:
        return False
    try:
        dt = datetime.fromisoformat(match_date).replace(tzinfo=None)
    except ValueError:
        return False
    return range_from <= dt <= range_to


def _poule_ids_for_capture(cap: DataCapture, comp_by_hl_id: dict, poule_ids_by_comp_id: dict, known_poule_ids: set) -> list:
    """Vertaalt een DataCapture terug naar de poule_id(s) die hij ververste -
    rechtstreeks voor een losse poule-scan, via de competitie voor een
    competitie-brede comp_detail-scan (item 1013: landelijke competities
    worden zo in 1x ververst, dus 1 capture dekt meerdere poules)."""
    if cap.capture_type == "poule_capture":
        try:
            poule_id = int(cap.external_id.replace("poule_capture_", ""))
        except ValueError:
            return []
        return [poule_id] if poule_id in known_poule_ids else []
    if cap.capture_type == "comp_detail":
        try:
            hl_comp_id = int(cap.external_id.replace("comp_detail_", ""))
        except ValueError:
            return []
        comp = comp_by_hl_id.get(hl_comp_id)
        if not comp:
            return []
        return poule_ids_by_comp_id.get(comp.id, [])
    return []
