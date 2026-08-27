"""Vanger smart-scan-coordinator state + discovery-next-logica - verplaatst
uit routers/hockey_vanger.py (item 696)."""

import json
from datetime import datetime, timezone
from typing import Dict, Optional

from sqlmodel import Session, col, func, select

from models.hockey_discovery import HockeyClub, HockeyPoule, HockeyTeam, HockeyTeamPoule, VangerCmd
from models.settings import AppSetting
from services.hockey_vanger_filters import _get_queue_filter, _is_scoreless_youth, _cmd_matches_filter, apply_team_filter
from services.hockey_vanger_settings import get_target_season

SMART_SCAN_MODE       = "smart_scan_mode"
SMART_SCAN_STARTED_AT = "smart_scan_started_at"
SMART_SCAN_CMD_COUNT  = "smart_scan_cmd_count"
SMART_SCAN_MAX_CMDS   = 200


def _smart_scan_get_state(session: Session) -> dict:
    mode_row  = session.get(AppSetting, SMART_SCAN_MODE)
    start_row = session.get(AppSetting, SMART_SCAN_STARTED_AT)
    count_row = session.get(AppSetting, SMART_SCAN_CMD_COUNT)
    mode      = (mode_row.value  if mode_row  else "") or ""
    started_at_str = (start_row.value if start_row else "") or ""
    raw_count = (count_row.value if count_row else "") or "0"
    cmd_count = int(raw_count) if raw_count.isdigit() else 0
    started_at = None
    if started_at_str:
        try:
            started_at = datetime.fromisoformat(started_at_str)
        except ValueError:
            pass
    return {"mode": mode, "started_at": started_at, "cmd_count": cmd_count}


def _smart_scan_set_state(session: Session, mode: str, started_at: Optional[datetime] = None, cmd_count: Optional[int] = None):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for key, val in [
        (SMART_SCAN_MODE,       mode),
        (SMART_SCAN_STARTED_AT, started_at.isoformat() if started_at else ""),
        (SMART_SCAN_CMD_COUNT,  str(cmd_count if cmd_count is not None else 0)),
    ]:
        row = session.get(AppSetting, key)
        if row:
            row.value = val; row.updated_at = now; session.add(row)
        else:
            session.add(AppSetting(key=key, value=val, updated_at=now))


def _smart_scan_discovery_next(session: Session, started_at: datetime, cmd_count: int) -> dict:
    if cmd_count >= SMART_SCAN_MAX_CMDS:
        _smart_scan_set_state(session, "")
        return {"added": 0, "reason": "max_cmds"}

    _, _, cats, hts, genders = _get_queue_filter(session)

    clubs_scanned_this_session = session.exec(
        select(HockeyClub).where(HockeyClub.last_scanned_at >= started_at)
    ).all()
    scanned_ext_ids = {c.external_id for c in clubs_scanned_this_session}

    active_cmds = session.exec(
        select(VangerCmd).where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).all()
    queued_poule_ids:    set = set()
    queued_club_ext_ids: set = set()
    for c in active_cmds:
        p = json.loads(c.params)
        if c.cmd_type == "get_poule":
            queued_poule_ids.add(p.get("poule_id"))
        elif c.cmd_type == "scan_club":
            queued_club_ext_ids.add(p.get("external_id"))

    if scanned_ext_ids:
        captured_ids = {p.poule_id for p in session.exec(select(HockeyPoule)).all()}

        tq = select(HockeyTeam).where(col(HockeyTeam.club_external_id).in_(scanned_ext_ids))
        tq = tq.where(col(HockeyTeam.recent_poule_id).is_not(None))
        tq = tq.where(HockeyTeam.no_new_poule_confirmed == False)  # noqa: E712
        tq = tq.where(HockeyTeam.season_pending == False)  # noqa: E712
        tq = apply_team_filter(tq, cats, hts, genders)
        teams = session.exec(tq).all()

        seen_pids: set = set()
        to_add = []
        for t in teams:
            if _is_scoreless_youth(t.short_name):
                continue
            pid = t.recent_poule_id
            if pid in captured_ids or pid in queued_poule_ids or pid in seen_pids:
                continue
            seen_pids.add(pid)
            to_add.append({"poule_id": pid, "team_id": t.team_id, "label": t.name})

        # item 990: ook extra (niet-primaire) poules van teams uit deze clubs
        # meenemen - een team dat ook in een 2e competitie speelt.
        club_team_ids = {t.team_id for t in session.exec(
            select(HockeyTeam).where(col(HockeyTeam.club_external_id).in_(scanned_ext_ids))
        ).all()}
        if club_team_ids:
            extra_rows = session.exec(
                select(HockeyTeamPoule)
                .where(col(HockeyTeamPoule.team_id).in_(club_team_ids))
                .where(HockeyTeamPoule.no_new_poule_confirmed == False)  # noqa: E712
                .where(HockeyTeamPoule.season_pending == False)  # noqa: E712
            ).all()
            if extra_rows:
                extra_teams_q = apply_team_filter(
                    select(HockeyTeam).where(col(HockeyTeam.team_id).in_({r.team_id for r in extra_rows})),
                    cats, hts, genders,
                )
                extra_teams_by_id = {t.team_id: t for t in session.exec(extra_teams_q).all()}
                for r in extra_rows:
                    t = extra_teams_by_id.get(r.team_id)
                    if not t or _is_scoreless_youth(t.short_name):
                        continue
                    pid = r.poule_id
                    if pid in captured_ids or pid in queued_poule_ids or pid in seen_pids:
                        continue
                    seen_pids.add(pid)
                    to_add.append({"poule_id": pid, "team_id": t.team_id, "label": t.name})

        if to_add:
            batch = to_add[:15]
            added = 0
            for item in batch:
                if cmd_count + added >= SMART_SCAN_MAX_CMDS:
                    break
                session.add(VangerCmd(
                    cmd_type="get_poule",
                    params=json.dumps({"poule_id": item["poule_id"], "team_id": item["team_id"], "label": item["label"]}),
                    status="pending",
                ))
                added += 1
            _smart_scan_set_state(session, "discovery", started_at, cmd_count + added)
            return {"added": added, "type": "get_poule"}

    # Alleen teams tellen waarvan de poule nog niet gecaptured is voor dit seizoen,
    # of die explicitly herscand moeten worden (season_pending). Teams waarvan de
    # huidige-seizoen poule al in de DB staat hoeven geen club-scan meer.
    target_season = get_target_season(session)
    captured_target_ids = {p.poule_id for p in session.exec(
        select(HockeyPoule).where(HockeyPoule.season == target_season)
    ).all()}

    cq = select(HockeyTeam).where(
        HockeyTeam.no_new_poule_confirmed == False,  # noqa: E712
    )
    cq = apply_team_filter(cq, cats, hts, genders)
    pending_teams = session.exec(cq).all()

    club_counts: Dict[str, int] = {}
    for t in pending_teams:
        if _is_scoreless_youth(t.short_name):
            continue
        if t.club_external_id in scanned_ext_ids:
            continue
        needs_scan = (
            t.recent_poule_id is None
            or t.recent_poule_id not in captured_target_ids
            or t.season_pending
        )
        if not needs_scan:
            continue
        club_counts[t.club_external_id] = club_counts.get(t.club_external_id, 0) + 1

    if not club_counts:
        _smart_scan_set_state(session, "")
        return {"added": 0, "reason": "idle"}

    best_ext = max(club_counts, key=lambda k: club_counts[k])
    if best_ext in queued_club_ext_ids:
        return {"added": 0, "reason": "already_queued"}

    club = session.exec(select(HockeyClub).where(HockeyClub.external_id == best_ext)).first()
    label = (club.friendly_name or club.name) if club else best_ext
    session.add(VangerCmd(
        cmd_type="scan_club",
        params=json.dumps({"external_id": best_ext, "label": label}),
        status="pending",
    ))
    _smart_scan_set_state(session, "discovery", started_at, cmd_count + 1)
    return {"added": 1, "type": "scan_club", "club": label, "pending_teams": club_counts[best_ext]}


def _smart_scan_try_advance(session: Session):
    state = _smart_scan_get_state(session)
    if not state["mode"] or not state["started_at"]:
        return
    in_progress = session.exec(
        select(func.count(VangerCmd.id)).where(VangerCmd.status == "in_progress")
    ).one()
    # item 727: cmds die door de queue-filter worden overgeslagen tellen niet mee als
    # "nog te doen" - anders blijft smart-scan voor altijd wachten op werk dat nooit
    # opgepakt gaat worden zolang het huidige filter actief staat.
    ages, club, cats, hts, genders = _get_queue_filter(session)
    pending_matching = sum(
        1 for c in session.exec(select(VangerCmd).where(VangerCmd.status == "pending")).all()
        if _cmd_matches_filter(session, c.cmd_type, json.loads(c.params), ages, club, cats, hts, genders)
    )
    if in_progress + pending_matching > 0:
        return
    if state["mode"] == "discovery":
        result = _smart_scan_discovery_next(session, state["started_at"], state["cmd_count"])
        if result.get("added", 0) == 0 and result.get("reason") != "already_queued":
            _smart_scan_set_state(session, "")
    session.commit()

