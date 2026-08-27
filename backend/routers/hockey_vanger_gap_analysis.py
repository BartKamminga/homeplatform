"""Hockey vanger — automatisch de queue vullen op basis van de gap-analyse
(verouderde poules + nooit-gescande clubs) - opgesplitst uit hockey_vanger.py
(refactor-plan hockey-inside Fase 3, RFTR-B3)."""

import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from sqlmodel import Session, col, select

from core.auth import get_current_user
from core.database import get_session
from models.hockey_discovery import HockeyClub, HockeyPoule, HockeyTeam, HockeyTeamPoule, VangerCmd
from routers.hockey_capture import _get_target_season
from services.hockey_vanger_filters import _is_scoreless_youth

router = APIRouter(prefix="/api/hockey", tags=["hockey-vanger"])


@router.post("/gap-analysis/fill-queue")
def gap_fill_queue(
    season: Optional[str] = None,
    stale_days: int = 7,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Vul de queue automatisch op basis van de gap-analyse."""
    target = season or _get_target_season(session)
    now    = datetime.now(timezone.utc).replace(tzinfo=None)

    pending_cmds = session.exec(
        select(VangerCmd).where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).all()
    pending_params = {
        json.loads(c.params).get("poule_id") or json.loads(c.params).get("external_id")
        for c in pending_cmds
    }

    cutoff = now - timedelta(days=stale_days)
    stale_poules = session.exec(
        select(HockeyPoule)
        .where(HockeyPoule.season == target)
        .where(
            (HockeyPoule.last_scanned_at == None)  # noqa: E711
            | (HockeyPoule.last_scanned_at < cutoff)
        )
    ).all()

    team_by_poule: dict = {}
    for t in session.exec(select(HockeyTeam).where(col(HockeyTeam.recent_poule_id).is_not(None))).all():
        if t.recent_poule_id and t.recent_poule_id not in team_by_poule:
            team_by_poule[t.recent_poule_id] = t

    # item 990: fallback naar extra (niet-primaire) team-poule-koppelingen -
    # een stale poule die niet de primaire poule van een team is (omdat dat
    # team ook in een 2e competitie speelt) werd hiervoor stil overgeslagen:
    # wel gevonden als stale, maar zonder team_id om de cmd mee te bouwen.
    extra_team_id_by_poule: dict = {}
    for r in session.exec(select(HockeyTeamPoule)).all():
        if r.poule_id not in team_by_poule and r.poule_id not in extra_team_id_by_poule:
            extra_team_id_by_poule[r.poule_id] = r.team_id
    extra_teams_by_id = {t.team_id: t for t in session.exec(
        select(HockeyTeam).where(col(HockeyTeam.team_id).in_(set(extra_team_id_by_poule.values())))
    ).all()} if extra_team_id_by_poule else {}

    added_poules = 0
    for poule in stale_poules:
        pid_str = str(poule.poule_id)
        if pid_str in pending_params or poule.poule_id in pending_params:
            continue
        t = team_by_poule.get(poule.poule_id)
        if not t:
            t = extra_teams_by_id.get(extra_team_id_by_poule.get(poule.poule_id))
        if not t:
            continue
        if _is_scoreless_youth(t.short_name):
            continue
        label = t.name + " — " + (poule.name or f"poule #{poule.poule_id}")
        session.add(VangerCmd(
            cmd_type="get_poule",
            params=json.dumps({"poule_id": poule.poule_id, "team_id": t.team_id, "label": label}),
            created_at=now,
        ))
        added_poules += 1

    unscanned = session.exec(
        select(HockeyClub).where(HockeyClub.detail_loaded == False)  # noqa: E712
    ).all()
    added_clubs = 0
    for c in unscanned:
        if c.external_id not in pending_params:
            session.add(VangerCmd(
                cmd_type="scan_club",
                params=json.dumps({"external_id": c.external_id, "label": c.friendly_name or c.name}),
                created_at=now,
            ))
            added_clubs += 1

    session.commit()
    return {"added_poules": added_poules, "added_clubs": added_clubs, "total": added_poules + added_clubs}
