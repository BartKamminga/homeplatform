"""Hockey vanger — cmd-queue CRUD + resultaat-dispatch (grootste/meest
complexe stuk van het voormalige hockey_vanger.py) - opgesplitst in Fase 3
(RFTR-B3). fill_cmd_queue en post_cmd_result waren de twee god-functies met
de minste testdekking vóór RFTR-B1 - zie backend/tests/test_hockey_vanger_
cmd_queue.py en test_hockey_vanger_post_cmd_result.py."""

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.crud import get_or_404
from core.database import get_session
from models.capture import DataCapture, new_uuid
from models.hockey_discovery import HockeyClub, HockeyCompetition, HockeyPoule, HockeyTeam, HockeyTeamPoule, VangerCmd
from services.hockey_vanger_filters import (
    _GENDER_PREFIX, _age_group_of, _age_sort_key, _cmd_matches_filter, _get_queue_filter,
    _is_scoreless_youth, apply_team_filter,
)
from services.hockey_vanger_ingest import (
    _parse_raw_poule, _parse_raw_club, _call_poule_capture, _call_club_detail,
    _call_clubs_list, _call_competition_detail, _call_competitions_list,
)
from services.hockey_poule_capture_core import notify_finished_matches
from services.hockey_vanger_scan_history import record_scan_outcome
from services.hockey_vanger_settings import get_target_season
from services.hockey_vanger_smartscan import _smart_scan_try_advance

router = APIRouter(prefix="/api/hockey", tags=["hockey-vanger"])


class CmdResultIn(BaseModel):
    raw:        Optional[Any] = None
    error:      Optional[str] = None
    session_id: Optional[str] = None


class CmdFillIn(BaseModel):
    type:         str            # "poules" | "clubs" | "poules_refresh"
    max_age_days: Optional[int] = 7


@router.get("/vanger/cmd-queue")
def get_cmd_queue(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    counts: Dict[str, int] = {}
    for status in ("pending", "in_progress", "done", "failed", "skipped"):
        counts[status] = len(session.exec(
            select(VangerCmd).where(VangerCmd.status == status)
        ).all())

    recent = session.exec(
        select(VangerCmd).order_by(col(VangerCmd.id).desc()).limit(200)
    ).all()

    ages, club, cats, hts, genders = _get_queue_filter(session)

    def _row(c):
        params = json.loads(c.params)
        filtered_out = (
            c.status == "pending"
            and not _cmd_matches_filter(session, c.cmd_type, params, ages, club, cats, hts, genders)
        )
        return {
            "id":             c.id,
            "cmd_type":       c.cmd_type,
            "params":         params,
            "status":         c.status,
            "filtered_out":   filtered_out,
            "created_at":     c.created_at.isoformat() if c.created_at else None,
            "started_at":     c.started_at.isoformat() if c.started_at else None,
            "finished_at":    c.finished_at.isoformat() if c.finished_at else None,
            "error":          c.error,
            "result_summary": json.loads(c.result_summary) if c.result_summary else None,
        }

    return {
        "counts": counts,
        "recent": [_row(c) for c in recent],
    }


def _fill_poules(session: Session, now: datetime, pending_params: set) -> tuple:
    """Queuet get_poule-cmds voor teams met een nog-niet-gecaptured recente
    poule, plus (item 990) teams' extra (niet-primaire) poules uit
    hockey_team_poules - een team dat ook in een 2e competitie speelt.
    Retourneert (added, stale_poule_ids) - stale_poule_ids wordt door de
    aanroeper teruggegeven als 'stale_skip'-telling."""
    target_season = get_target_season(session)
    ages, club, cats, hts, genders = _get_queue_filter(session)

    captured_ids = {p.poule_id for p in session.exec(
        select(HockeyPoule).where(HockeyPoule.season == target_season)
    ).all()}

    q = apply_team_filter(select(HockeyTeam).where(col(HockeyTeam.recent_poule_id).is_not(None)), cats, hts, genders)
    q = q.order_by(col(HockeyTeam.short_name))
    teams = session.exec(q).all()

    stale_poule_ids = {t.recent_poule_id for t in teams if t.recent_poule_id and t.season_pending}
    skip_ids = stale_poule_ids | {
        t.recent_poule_id for t in teams
        if t.recent_poule_id and t.no_new_poule_confirmed
    }

    seen: set = set()
    candidates = []
    club_poule_ids: set = set()
    for t in teams:
        if _is_scoreless_youth(t.short_name):
            continue
        if club and t.club_external_id == club and t.recent_poule_id:
            club_poule_ids.add(t.recent_poule_id)
        pid = t.recent_poule_id
        if not pid or pid in captured_ids or pid in seen or pid in skip_ids:
            continue
        seen.add(pid)
        candidates.append({
            "poule_id":    pid,
            "team_id":     t.team_id,
            "label":       t.name + " (#" + str(pid) + ")",
            "hockey_type": t.hockey_type,
        })

    extra_rows = session.exec(select(HockeyTeamPoule).where(HockeyTeamPoule.season == target_season)).all()
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
            if club and t.club_external_id == club:
                club_poule_ids.add(r.poule_id)
            pid = r.poule_id
            if pid in captured_ids or pid in seen or r.season_pending or r.no_new_poule_confirmed:
                continue
            seen.add(pid)
            candidates.append({
                "poule_id":    pid,
                "team_id":     t.team_id,
                "label":       t.name + " (#" + str(pid) + ")",
                "hockey_type": t.hockey_type,
            })

    if ages:
        candidates = [c for c in candidates if _age_group_of(c["label"]) in ages]
    if club:
        candidates = [c for c in candidates if c["poule_id"] in club_poule_ids]

    candidates.sort(key=lambda x: -_age_sort_key("label")(x))

    added = 0
    for c in candidates:
        if c["poule_id"] not in pending_params:
            session.add(VangerCmd(
                cmd_type="get_poule",
                params=json.dumps({"poule_id": c["poule_id"], "team_id": c["team_id"], "label": c["label"]}),
                created_at=now,
            ))
            added += 1
    return added, stale_poule_ids


def _fill_clubs(session: Session, now: datetime, pending_params: set) -> int:
    """Queuet scan_club-cmds voor clubs met wachtende teams (meeste eerst),
    plus nog nooit gescande clubs (0 wachtende teams)."""
    _, _, cats, hts, genders = _get_queue_filter(session)
    q = apply_team_filter(select(HockeyTeam).where(
        (HockeyTeam.no_new_poule_confirmed == True) | (HockeyTeam.season_pending == True)  # noqa: E712
    ), cats, hts, genders)
    teams = session.exec(q).all()

    counts_by_club: Dict[str, int] = {}
    for t in teams:
        if _is_scoreless_youth(t.short_name):
            continue
        counts_by_club[t.club_external_id] = counts_by_club.get(t.club_external_id, 0) + 1

    unscanned = session.exec(
        select(HockeyClub).where(HockeyClub.detail_loaded == False)  # noqa: E712
    ).all()
    for c in unscanned:
        if c.external_id not in counts_by_club:
            counts_by_club[c.external_id] = 0

    all_club_ids = list(counts_by_club.keys())
    club_rows = session.exec(
        select(HockeyClub).where(col(HockeyClub.external_id).in_(all_club_ids))
    ).all()
    club_map = {c.external_id: c for c in club_rows}

    added = 0
    for ext_id, cnt in sorted(counts_by_club.items(), key=lambda x: -x[1]):
        if ext_id not in pending_params:
            c = club_map.get(ext_id)
            label = (c.friendly_name or c.name) if c else ext_id
            session.add(VangerCmd(
                cmd_type="scan_club",
                params=json.dumps({"external_id": ext_id, "label": label, "pending_teams": cnt}),
                created_at=now,
            ))
            added += 1
    return added


def _fill_poules_refresh(session: Session, now: datetime, pending_params: set, max_age_days: int) -> int:
    """Herqueuet get_poule-cmds voor al gecapturede poules van het doelseizoen
    die langer dan max_age_days niet gescand zijn."""
    cutoff  = now - timedelta(days=max_age_days)

    target_season = get_target_season(session)
    _, _, cats, hts, genders = _get_queue_filter(session)

    q = (
        select(HockeyPoule)
        .where(HockeyPoule.season == target_season)
        .where(
            (HockeyPoule.last_scanned_at == None)  # noqa: E711
            | (HockeyPoule.last_scanned_at < cutoff)
        )
    )
    poules = session.exec(q).all()

    team_by_poule: dict = {}
    for t in session.exec(select(HockeyTeam).where(col(HockeyTeam.recent_poule_id).is_not(None))).all():
        if t.recent_poule_id and t.recent_poule_id not in team_by_poule:
            team_by_poule[t.recent_poule_id] = t

    added = 0
    for poule in poules:
        t = team_by_poule.get(poule.poule_id)
        if t and _is_scoreless_youth(t.short_name):
            continue
        if cats and (not t or t.category_group_name not in cats):
            continue
        if hts and (not t or t.hockey_type not in hts):
            continue
        if genders and t:
            prefixes = {_GENDER_PREFIX[g] for g in genders if g in _GENDER_PREFIX}
            if not any((t.short_name or "").startswith(p) for p in prefixes):
                continue

        pid_str = str(poule.poule_id)
        if pid_str in pending_params or poule.poule_id in pending_params:
            continue
        if not t:
            continue
        team_id = t.team_id
        label   = t.name + " — " + (poule.name or f"poule #{poule.poule_id}")

        session.add(VangerCmd(
            cmd_type="get_poule",
            params=json.dumps({"poule_id": poule.poule_id, "team_id": team_id, "label": label}),
            created_at=now,
        ))
        added += 1
    return added


@router.post("/vanger/cmd-queue/fill")
def fill_cmd_queue(
    body: CmdFillIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    pending_cmds = session.exec(
        select(VangerCmd).where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).all()
    pending_params = {
        json.loads(c.params).get("poule_id") or json.loads(c.params).get("external_id")
        for c in pending_cmds
    }

    added = 0
    extra: Dict[str, Any] = {}

    if body.type == "poules":
        added, stale_poule_ids = _fill_poules(session, now, pending_params)
        extra["stale_skip"] = len(stale_poule_ids)
    elif body.type == "clubs":
        added = _fill_clubs(session, now, pending_params)
    elif body.type == "poules_refresh":
        max_age = body.max_age_days if body.max_age_days is not None else 7
        added = _fill_poules_refresh(session, now, pending_params, max_age)

    session.commit()
    return {"added": added, "type": body.type, **extra}


class CmdAddIn(BaseModel):
    cmd_type: str
    params:   Dict[str, Any]


def add_vanger_cmd(session: Session, cmd_type: str, params: Dict[str, Any], reason: Optional[str] = None) -> Dict[str, Any]:
    """Dedupt tegen bestaande pending/in_progress cmd's van hetzelfde type+doel en
    voegt zo nodig toe. Losgetrokken van de route zodat andere plekken (bv. de
    agent-control result-endpoint) dezelfde dedup-logica hergebruiken i.p.v. 'm
    te dupliceren. reason = zelfde waarden als ScanScheduleEntry.reason, alleen
    voor de scan-totalen-telling (services/hockey_vanger_scan_history.py) -
    None voor handmatige/ad-hoc toevoegingen."""
    valid = ("get_poule", "scan_club", "get_clubs", "get_competition_detail", "get_competitions")
    if cmd_type not in valid:
        return {"added": False, "reason": "invalid_cmd_type"}

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if cmd_type in ("get_clubs", "get_competitions"):
        existing = session.exec(
            select(VangerCmd).where(
                VangerCmd.cmd_type == cmd_type,
                col(VangerCmd.status).in_(["pending", "in_progress"]),
            )
        ).first()
        if existing:
            return {"added": False, "reason": "already_queued"}
        default_label = "Alle clubs" if cmd_type == "get_clubs" else "Nationale competities"
        session.add(VangerCmd(
            cmd_type=cmd_type,
            params=json.dumps({"label": params.get("label", default_label)}),
            created_at=now,
            reason=reason,
        ))
        session.commit()
        return {"added": True}

    # item 1013: een poule van een landelijke (hl_comp_id-gekoppelde)
    # competitie los scannen is inefficient (1 get_competition_detail dekt
    # de hele competitie in 1x) en kan bij een net iets andere class/
    # district-uitkomst een duplicaat-competitierij opleveren naast de
    # gepubliceerde rij (roadmap-melding: Poulebord verloor zo alle data voor
    # Landelijk Jongens O18). Omleiden naar een competitie-brede herscan.
    if cmd_type == "get_poule":
        poule = session.exec(select(HockeyPoule).where(HockeyPoule.poule_id == params.get("poule_id"))).first()
        comp = session.get(HockeyCompetition, poule.competition_id) if poule and poule.competition_id else None
        if comp and comp.hl_comp_id:
            return add_vanger_cmd(session, "get_competition_detail", {"comp_id": comp.hl_comp_id, "label": comp.name}, reason=reason)

    key_field = {"get_poule": "poule_id", "scan_club": "external_id", "get_competition_detail": "comp_id"}.get(cmd_type)
    target_id = params.get(key_field)

    pending = session.exec(
        select(VangerCmd).where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).all()
    for e in pending:
        ep = json.loads(e.params)
        if e.cmd_type == cmd_type and ep.get(key_field) == target_id:
            return {"added": False, "reason": "already_queued"}

    session.add(VangerCmd(cmd_type=cmd_type, params=json.dumps(params), created_at=now, reason=reason))
    session.commit()
    return {"added": True}


@router.post("/vanger/cmd-queue/add")
def add_single_cmd(
    body: CmdAddIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    result = add_vanger_cmd(session, body.cmd_type, body.params)
    if result.get("reason") == "invalid_cmd_type":
        raise HTTPException(status_code=400, detail="Ongeldig cmd_type")
    return result


@router.get("/vanger/cmd-queue/next")
def get_cmd_queue_next(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    ages, club, cats, hts, genders = _get_queue_filter(session)
    pending = session.exec(
        select(VangerCmd).where(VangerCmd.status == "pending").order_by(col(VangerCmd.id).asc())
    ).all()
    cmd = None
    for c in pending:
        if _cmd_matches_filter(session, c.cmd_type, json.loads(c.params), ages, club, cats, hts, genders):
            cmd = c
            break
    if not cmd:
        return {"done": True}
    cmd.status     = "in_progress"
    cmd.started_at = now
    session.add(cmd)
    session.commit()
    return {
        "done":     False,
        "id":       cmd.id,
        "cmd_type": cmd.cmd_type,
        "params":   json.loads(cmd.params),
    }


def _dispatch_get_poule(session: Session, body: CmdResultIn, params: dict) -> tuple:
    capture_body = _parse_raw_poule(body.raw, params, get_target_season(session))
    if not capture_body:
        return {"parse_failed": True}, {}
    poule_sum = _call_poule_capture(capture_body, session)
    meta = {
        "competition":       capture_body.competition_name,
        "poule_name":        capture_body.poule_name,
        "class_name":        capture_body.class_name,
        "team_count":        len(capture_body.teams_in_poule),
        "matches_played":    sum(1 for m in (capture_body.matches_data or []) if m.status == "final"),
        "matches_remaining": sum(1 for m in (capture_body.matches_data or []) if m.status != "final"),
    }
    return (poule_sum or {}), meta


def _dispatch_scan_club(session: Session, body: CmdResultIn, params: dict) -> tuple:
    detail_body = _parse_raw_club(body.raw, params)
    if not detail_body:
        return {"parse_failed": True}, {}
    club_sum = _call_club_detail(detail_body, session)
    meta = {
        "name":     detail_body.friendly_name or detail_body.name,
        "city":     detail_body.city,
        "district": detail_body.district,
        "teams":    len(detail_body.teams),
    }
    return (club_sum or {}), meta


def _dispatch_get_clubs(session: Session, body: CmdResultIn, params: dict) -> tuple:
    clubs_raw  = body.raw if isinstance(body.raw, dict) else {}
    clubs_list = clubs_raw.get("clubs") or clubs_raw.get("data")
    if not isinstance(clubs_list, list):
        return {"parse_failed": True}, {}
    clubs_sum = _call_clubs_list(clubs_list, session)
    return (clubs_sum or {}), {"clubs_count": len(clubs_list)}


def _dispatch_get_competition_detail(session: Session, body: CmdResultIn, params: dict) -> tuple:
    comp_raw = body.raw if isinstance(body.raw, dict) else {}
    comp_sum = _call_competition_detail(comp_raw, session, params)
    if not comp_sum:
        return {"parse_failed": True}, {}
    meta = {"competition": comp_sum.get("competition"), "poule_count": comp_sum.get("poules_processed")}
    return comp_sum, meta


def _dispatch_get_competitions(session: Session, body: CmdResultIn, params: dict) -> tuple:
    comps_raw = body.raw if isinstance(body.raw, dict) else {}
    comps_sum = _call_competitions_list(comps_raw, session)
    if not comps_sum:
        return {"parse_failed": True}, {}
    return comps_sum, {}


_CMD_RESULT_DISPATCH = {
    "get_poule":              _dispatch_get_poule,
    "scan_club":               _dispatch_scan_club,
    "get_clubs":               _dispatch_get_clubs,
    "get_competition_detail":  _dispatch_get_competition_detail,
    "get_competitions":        _dispatch_get_competitions,
}


@router.post("/vanger/cmd-queue/{cmd_id}/result")
def post_cmd_result(
    cmd_id: int,
    body: CmdResultIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    cmd = get_or_404(session, VangerCmd, cmd_id, "Cmd")

    params = json.loads(cmd.params)

    if body.error or body.raw is None:
        cmd.status      = "failed" if body.error else "skipped"
        cmd.error       = body.error
        cmd.finished_at = now
        session.add(cmd)
        record_scan_outcome(session, cmd.reason, success=False, when=now)

        if cmd.cmd_type == "get_poule" and not body.error:
            poule_id = params.get("poule_id")
            if poule_id:
                for t in session.exec(
                    select(HockeyTeam).where(HockeyTeam.recent_poule_id == poule_id)
                ).all():
                    t.no_new_poule_confirmed = True
                    session.add(t)
                # item 990: ook een extra (niet-primaire) koppeling bijwerken
                for tp in session.exec(
                    select(HockeyTeamPoule).where(HockeyTeamPoule.poule_id == poule_id)
                ).all():
                    tp.no_new_poule_confirmed = True
                    session.add(tp)

        session.commit()
        return {"ok": True, "status": cmd.status}

    result_label = params.get("label", "")
    raw_bytes    = len(json.dumps(body.raw).encode("utf-8")) if body.raw else 0
    duration_ms  = round((now - cmd.started_at).total_seconds() * 1000) if cmd.started_at else None
    summary_data: Dict[str, Any] = {"raw_bytes": raw_bytes}
    if duration_ms is not None:
        summary_data["duration_ms"] = duration_ms

    session_key = body.session_id if body.session_id else "vanger_cmd_" + str(cmd_id)
    if cmd.cmd_type == "get_poule":
        archive_ext  = "poule_capture_" + str(params.get("poule_id", cmd_id))
        archive_type = "poule_capture"
    elif cmd.cmd_type == "scan_club":
        archive_ext  = "club_detail_" + str(params.get("external_id", cmd_id))
        archive_type = "club_detail"
    elif cmd.cmd_type == "get_clubs":
        archive_ext  = "clubs_list_" + str(cmd_id)
        archive_type = "clubs_list"
    elif cmd.cmd_type == "get_competition_detail":
        archive_ext  = "comp_detail_" + str(params.get("comp_id", cmd_id))
        archive_type = "comp_detail"
    else:
        archive_ext  = "comp_list_" + str(cmd_id)
        archive_type = "comp_list"

    already = session.exec(
        select(DataCapture)
        .where(DataCapture.external_id == archive_ext)
        .where(DataCapture.session_id == session_key)
    ).first()
    # Meta wordt hieronder verrijkt met geparste velden (competitie, poule-
    # naam, teamtelling, ...) zodra de parse-stap succesvol was — anders
    # toont het Archief-tabblad voor elke capture alleen een generieke titel
    # (item 708). Basisversie hier, aangevuld/geschreven na de parse-stap.
    archive_meta = {"label": result_label, "cmd_id": cmd_id}

    newly_finished = []
    try:
        handler = _CMD_RESULT_DISPATCH.get(cmd.cmd_type)
        if handler:
            summary_updates, meta_updates = handler(session, body, params)
            newly_finished = summary_updates.pop("newly_finished", [])
            summary_data.update(summary_updates)
            archive_meta.update(meta_updates)
    except Exception as e:
        # Roadmap-melding 29-08-2026: een DB-fout in de handler (bv. een
        # IntegrityError) laat de sessie in een PendingRollbackError-staat
        # achter - zonder expliciete rollback crasht deze recovery-poging
        # dan zelf ook, waardoor de cmd nooit als failed werd gemarkeerd
        # (geen archief, geen zichtbare fout, voor altijd in_progress).
        session.rollback()
        cmd.status         = "failed"
        cmd.error          = str(e)
        cmd.finished_at    = now
        cmd.result_summary = json.dumps(summary_data)
        session.add(cmd)
        record_scan_outcome(session, cmd.reason, success=False, when=now)
        session.commit()
        return {"ok": False, "status": "failed", "error": str(e)}

    if not already:
        session.add(DataCapture(
            id=new_uuid(),
            source="hockey-vanger",
            capture_type=archive_type,
            external_id=archive_ext,
            session_id=session_key,
            payload=json.dumps(body.raw, ensure_ascii=False),
            meta=json.dumps(archive_meta, ensure_ascii=False),
            captured_at=now,
        ))

    cmd.status         = "done"
    cmd.finished_at    = now
    cmd.result_summary = json.dumps(summary_data)
    session.add(cmd)
    record_scan_outcome(session, cmd.reason, success=True, when=now)
    session.commit()
    notify_finished_matches(session, newly_finished)
    _smart_scan_try_advance(session)
    return {"ok": True, "status": "done", "label": result_label}


@router.delete("/vanger/cmd-queue")
def clear_cmd_queue(
    scope: str = "pending",
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    if scope == "done":
        statuses = ["done", "skipped", "failed"]
    elif scope == "all":
        statuses = ["pending", "in_progress", "done", "failed", "skipped"]
    else:
        statuses = ["pending", "in_progress"]

    deleted = 0
    for cmd in session.exec(
        select(VangerCmd).where(col(VangerCmd.status).in_(statuses))
    ).all():
        session.delete(cmd)
        deleted += 1
    session.commit()
    return {"deleted": deleted}


@router.post("/vanger/cmd-queue/{cmd_id}/retry")
def retry_cmd(
    cmd_id: int,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    cmd = get_or_404(session, VangerCmd, cmd_id, "Cmd")
    cmd.status         = "pending"
    cmd.error          = None
    cmd.started_at     = None
    cmd.finished_at    = None
    cmd.result_summary = None
    session.add(cmd)
    session.commit()
    return {"ok": True}
