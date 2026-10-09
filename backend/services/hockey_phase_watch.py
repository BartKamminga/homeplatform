"""Item 1254: volglijst 'wacht op nieuwe fase' / 'wacht op zaal-indeling'.

Een competitie-koppeling (HockeyPublicationComp) kan op de volglijst staan.
Zolang dat zo is, plant de scheduler gericht scans voor precies die
competitie, i.p.v. alle clubs vaker te scannen:

- next_phase: de competitie is uitgespeeld en er komt een nieuwe fase.
  Landelijk (hl_comp_id): 1x per dag een competition-detail - nieuwe poules
  komen dan onder dezelfde rij en dus in de publicatie. Daarnaast (en voor
  district-competities als enige route) een club-scan van de clubs van de
  teams in deze competitie, zodat een nieuw recent_poule_id binnenkomt.
- zaal: dezelfde clubs, maar dan voor hun zaalteams van dezelfde
  leeftijd (bv. Meisjes O18 -> zMO18-*).

Gevonden poules van teams binnen de scope worden als get_poule gepland met
reason 'phase_watch' - die gaat niet door het queue-filter
(FILTER_EXEMPT_REASONS), anders zouden zaalpoules tot de zaalfase blijven
liggen. Los bestand: hockey_vanger_schedule.py is al ~1000 regels."""

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple

from sqlmodel import Session, col, select

from models.hockey import HockeyPublication, HockeyPublicationComp
from models.hockey_discovery import (
    HockeyClub, HockeyCompetition, HockeyPoule, HockeyPouleMatch, HockeyPouleStanding, HockeyTeam,
)
from models.settings import AppSetting
from services.hockey_vanger_scanplan import _has_remaining_matches, _pending_club_ext_ids, _pending_poule_ids
from services.hockey_vanger_settings import _get_int_setting, _set_str_setting

REASON = "phase_watch"
KINDS = ("next_phase", "zaal")

CLUB_SCAN_DAYS_KEY = "phase_watch_club_scan_days"
COMP_SCAN_HOURS_KEY = "phase_watch_comp_scan_hours"
MAX_CLUBS_PER_PASS_KEY = "phase_watch_max_clubs_per_pass"
_NOTIFY_THROTTLE_KEY = "phase_watch_notify_last_run"

_COMP_AGE_RE = re.compile(r"\b(Jongens|Meisjes)\s+O(\d{1,2})\b", re.IGNORECASE)
_TEAM_AGE_RE = re.compile(r"(?:^|\s)[zZ]?([JjMm])[Oo](\d{1,2})(?!\d)")


@dataclass
class WatchScope:
    link: HockeyPublicationComp
    comp: HockeyCompetition
    kind: str
    since: datetime
    poule_ids: Set[int] = field(default_factory=set)
    team_ids: Set[int] = field(default_factory=set)
    club_ids: Set[str] = field(default_factory=set)


def _comp_age(name: str) -> Optional[Tuple[str, int]]:
    m = _COMP_AGE_RE.search(name or "")
    return (m.group(1)[0].upper(), int(m.group(2))) if m else None


def _team_age(name: str) -> Optional[Tuple[str, int]]:
    m = _TEAM_AGE_RE.search(name or "")
    return (m.group(1).upper(), int(m.group(2))) if m else None


def watched_scopes(session: Session) -> List[WatchScope]:
    """Alle actieve volglijst-regels, 1 per (competitie, soort) - staat
    dezelfde competitie in twee publicaties op de lijst, dan telt 'ie 1x."""
    links = session.exec(
        select(HockeyPublicationComp).where(
            col(HockeyPublicationComp.watch_next_phase_since).is_not(None)
            | col(HockeyPublicationComp.watch_zaal_since).is_not(None)
        )
    ).all()
    scopes: List[WatchScope] = []
    seen: Set[Tuple[int, str]] = set()
    for link in links:
        comp = session.get(HockeyCompetition, link.competition_id)
        if not comp:
            continue
        for kind, since in (("next_phase", link.watch_next_phase_since), ("zaal", link.watch_zaal_since)):
            if since is None or (comp.id, kind) in seen:
                continue
            seen.add((comp.id, kind))
            scopes.append(_build_scope(session, link, comp, kind, since))
    return scopes


def _build_scope(session: Session, link, comp, kind: str, since: datetime) -> WatchScope:
    scope = WatchScope(link=link, comp=comp, kind=kind, since=since)
    scope.poule_ids = {p.poule_id for p in session.exec(
        select(HockeyPoule).where(HockeyPoule.competition_id == comp.id)
    ).all()}
    if scope.poule_ids:
        scope.team_ids = {s.team_id for s in session.exec(
            select(HockeyPouleStanding).where(col(HockeyPouleStanding.poule_id).in_(scope.poule_ids))
        ).all() if s.team_id}
        scope.team_ids |= {t.team_id for t in session.exec(
            select(HockeyTeam).where(col(HockeyTeam.recent_poule_id).in_(scope.poule_ids))
        ).all()}
    if scope.team_ids:
        scope.club_ids = {t.club_external_id for t in session.exec(
            select(HockeyTeam).where(col(HockeyTeam.team_id).in_(scope.team_ids))
        ).all() if t.club_external_id}
    return scope


def scope_teams(session: Session, scope: WatchScope) -> List[HockeyTeam]:
    """De teams waarvan we een nieuwe poule verwachten: bij next_phase de
    teams uit deze competitie zelf, bij zaal de zaalteams van dezelfde
    leeftijd (en hetzelfde geslacht) bij dezelfde clubs."""
    if scope.kind == "next_phase":
        if not scope.team_ids:
            return []
        return session.exec(select(HockeyTeam).where(col(HockeyTeam.team_id).in_(scope.team_ids))).all()
    if not scope.club_ids:
        return []
    age = _comp_age(scope.comp.name)
    zaal_teams = session.exec(
        select(HockeyTeam)
        .where(col(HockeyTeam.club_external_id).in_(scope.club_ids))
        .where(HockeyTeam.hockey_type == "ZA")
    ).all()
    if not age:
        return zaal_teams
    return [t for t in zaal_teams if _team_age(t.short_name) == age or _team_age(t.name) == age]


def _new_poule_id(team: HockeyTeam, scope: WatchScope) -> Optional[int]:
    """Het poule-id waar dit team nu in staat, als dat een nieuwe poule is
    (dus niet een poule van de gevolgde competitie zelf)."""
    pid = team.recent_poule_id
    if not pid or pid in scope.poule_ids:
        return None
    return pid


def _is_waiting(session: Session, scope: WatchScope, now: datetime) -> bool:
    """next_phase heeft pas zin als de huidige fase uitgespeeld is; zaal
    wacht vanaf het moment dat de gebruiker 'm aanzet."""
    if scope.kind == "zaal":
        return True
    if not scope.poule_ids:
        return True
    matches = session.exec(
        select(HockeyPouleMatch).where(col(HockeyPouleMatch.poule_id).in_(scope.poule_ids))
    ).all()
    return not _has_remaining_matches(matches, now)


def _event(target_type: str, target_id, cmd_type: str, params: dict, now: datetime) -> dict:
    return {
        "target_type": target_type, "target_id": target_id, "cmd_type": cmd_type,
        "params": json.dumps(params), "planned_at": now, "reason": REASON,
    }


def phase_watch_events(session: Session, now: datetime) -> List[dict]:
    """Scan-momenten voor de volglijst (planned_at=now, net als de andere
    'zodra van toepassing'-events in _immediate_events). Throttles:
    competition-detail hooguit 1x per COMP_SCAN_HOURS, een club hooguit 1x
    per CLUB_SCAN_DAYS, en per pass maximaal MAX_CLUBS_PER_PASS club-scans."""
    scopes = watched_scopes(session)
    if not scopes:
        return []
    comp_hours = _get_int_setting(session, COMP_SCAN_HOURS_KEY, 20)
    club_days = _get_int_setting(session, CLUB_SCAN_DAYS_KEY, 1)
    max_clubs = _get_int_setting(session, MAX_CLUBS_PER_PASS_KEY, 10)
    pending_clubs = _pending_club_ext_ids(session)
    pending_poules = _pending_poule_ids(session)
    captured = {p.poule_id for p in session.exec(select(HockeyPoule)).all()}

    events: List[dict] = []
    club_candidates: Dict[str, HockeyClub] = {}
    seen_poules: Set[int] = set()
    for scope in scopes:
        if not _is_waiting(session, scope, now):
            continue
        comp = scope.comp
        if scope.kind == "next_phase" and comp.hl_comp_id:
            last = min((p.last_scanned_at for p in session.exec(
                select(HockeyPoule).where(HockeyPoule.competition_id == comp.id)
            ).all() if p.last_scanned_at), default=None)
            if last is None or last < now - timedelta(hours=comp_hours):
                events.append(_event(
                    "competition", comp.hl_comp_id, "get_competition_detail",
                    {"comp_id": comp.hl_comp_id, "label": comp.name}, now,
                ))
        for club in session.exec(
            select(HockeyClub).where(col(HockeyClub.external_id).in_(scope.club_ids))
        ).all() if scope.club_ids else []:
            club_candidates.setdefault(club.external_id, club)
        for team in scope_teams(session, scope):
            pid = _new_poule_id(team, scope)
            if not pid or pid in captured or pid in pending_poules or pid in seen_poules:
                continue
            seen_poules.add(pid)
            events.append(_event(
                "poule", pid, "get_poule", {"poule_id": pid, "team_id": team.team_id, "label": team.name}, now,
            ))

    cutoff = now - timedelta(days=club_days)
    stale_clubs = sorted(
        (c for c in club_candidates.values()
         if c.external_id not in pending_clubs and (c.last_scanned_at is None or c.last_scanned_at < cutoff)),
        key=lambda c: c.last_scanned_at or datetime.min,
    )
    for club in stale_clubs[:max_clubs]:
        events.append(_event(
            "club", club.id, "scan_club", {"external_id": club.external_id, "label": club.friendly_name or club.name}, now,
        ))
    return events


def scope_status(session: Session, scope: WatchScope, now: datetime) -> dict:
    """Voortgang van 1 volglijst-regel voor de Vanger-sectie en de push."""
    teams = scope_teams(session, scope)
    new_pids = {t.team_id: _new_poule_id(t, scope) for t in teams}
    found_pids = {pid for pid in new_pids.values() if pid}
    poules = {p.poule_id: p for p in session.exec(
        select(HockeyPoule).where(col(HockeyPoule.poule_id).in_(found_pids))
    ).all()} if found_pids else {}
    # Landelijk: nieuwe poules komen in dezelfde competitie (competition-
    # detail werkt recent_poule_id niet bij), dus die apart tellen.
    same_comp_new = session.exec(
        select(HockeyPoule)
        .where(HockeyPoule.competition_id == scope.comp.id)
        .where(HockeyPoule.discovered_at >= scope.since)
    ).all() if scope.kind == "next_phase" else []

    linked_comp_ids = {
        lnk.competition_id for lnk in session.exec(
            select(HockeyPublicationComp).where(HockeyPublicationComp.publication_id == scope.link.publication_id)
        ).all()
    }
    found_comps: Dict[int, dict] = {}
    for p in list(poules.values()) + same_comp_new:
        entry = found_comps.get(p.competition_id)
        if not entry:
            comp = session.get(HockeyCompetition, p.competition_id)
            entry = found_comps[p.competition_id] = {
                "competition_id": p.competition_id,
                "name": comp.name if comp else "?",
                "class_name": comp.class_name if comp else None,
                "district": comp.district if comp else None,
                "hockey_type": comp.hockey_type if comp else None,
                "linked": p.competition_id in linked_comp_ids,
                "poules": 0,
            }
        entry["poules"] += 1

    clubs = session.exec(
        select(HockeyClub).where(col(HockeyClub.external_id).in_(scope.club_ids))
    ).all() if scope.club_ids else []
    publication = session.get(HockeyPublication, scope.link.publication_id)
    return {
        "link_id": scope.link.id,
        "publication_id": scope.link.publication_id,
        "publication_name": publication.name if publication else None,
        "competition_id": scope.comp.id,
        "competition_name": scope.comp.name,
        "class_name": scope.comp.class_name,
        "kind": scope.kind,
        "since": scope.since.isoformat() + "Z",
        "waiting": _is_waiting(session, scope, now),
        "teams_total": len(teams),
        "teams_with_new_poule": sum(1 for pid in new_pids.values() if pid),
        "teams_captured": sum(1 for pid in new_pids.values() if pid and pid in poules),
        "same_comp_new_poules": len(same_comp_new),
        "clubs_total": len(clubs),
        "clubs_scanned_since": sum(1 for c in clubs if c.last_scanned_at and c.last_scanned_at >= scope.since),
        "found_competitions": sorted(found_comps.values(), key=lambda c: (c["linked"], c["name"])),
    }


def found_count(status: dict) -> int:
    return status["teams_captured"] + status["same_comp_new_poules"]


def notify_phase_watch(session: Session, now: datetime) -> int:
    """Push zodra er voor een volglijst-regel nieuwe poules binnen zijn (en
    opnieuw als er sindsdien meer bij zijn gekomen). Aangeroepen vanuit de
    vanger-heartbeat, daarom zelf getrooteld tot 1x per uur."""
    from services.push import send_push  # lokale import: zelfde patroon als de andere notify-functies

    last_run = session.get(AppSetting, _NOTIFY_THROTTLE_KEY)
    if last_run and last_run.value:
        try:
            if (now - datetime.fromisoformat(last_run.value)).total_seconds() < 3600:
                return 0
        except ValueError:
            pass
    _set_str_setting(session, _NOTIFY_THROTTLE_KEY, now.isoformat())
    session.commit()

    sent = 0
    for scope in watched_scopes(session):
        status = scope_status(session, scope, now)
        found = found_count(status)
        if found > (scope.link.watch_notified or 0):
            unlinked = [c["name"] for c in status["found_competitions"] if not c["linked"]]
            what = "zaal-indeling" if scope.kind == "zaal" else "nieuwe fase"
            body = f"{status['competition_name']}: {found} nieuwe poule(s) gevonden."
            if unlinked:
                body += f" Nog niet gekoppeld: {', '.join(unlinked[:3])}."
            sent += send_push(
                user_id=None, title=f"Hockey Inside - {what}", body=body,
                url="/hockey-inside/", site="hockey-inside",
            )
            scope.link.watch_notified = found
            session.add(scope.link)
        if _is_complete(status):
            set_watch(session, scope.link, scope.kind, False, now)
    session.commit()
    return sent


def _is_complete(status: dict) -> bool:
    """Automatisch van de lijst: alle teams in de scope hebben een opgehaalde
    nieuwe poule, of (landelijk) de competitie heeft weer nieuwe poules en
    toekomstige wedstrijden - de nieuwe fase loopt dan gewoon via de
    normale scans."""
    if status["teams_total"] and status["teams_captured"] == status["teams_total"]:
        return True
    return status["kind"] == "next_phase" and status["same_comp_new_poules"] > 0 and not status["waiting"]


def set_watch(session: Session, link: HockeyPublicationComp, kind: str, on: bool, now: datetime) -> None:
    attr = "watch_next_phase_since" if kind == "next_phase" else "watch_zaal_since"
    setattr(link, attr, now if on else None)
    if on:
        link.watch_notified = 0
        # Geparkeerde teams (no_new_poule_confirmed) weer laten meedoen - die
        # vlag sloot ze tot nu toe permanent uit van automatische ontdekking.
        if kind == "next_phase":
            scope = _build_scope(session, link, session.get(HockeyCompetition, link.competition_id), kind, now)
            for team in scope_teams(session, scope):
                if team.no_new_poule_confirmed:
                    team.no_new_poule_confirmed = False
                    session.add(team)
    session.add(link)
