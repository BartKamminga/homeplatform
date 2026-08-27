"""Hockey vanger — competitie-sync: alle poules van een discovery-competitie
naar de vanger-wachtrij toevoegen - opgesplitst uit hockey_vanger.py
(refactor-plan hockey-inside Fase 3, RFTR-B3)."""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, col, select

from core.auth import require_admin
from core.database import get_session
from models.hockey_discovery import HockeyCompetition, HockeyPoule, HockeyTeam, VangerCmd
from routers.hockey_vanger_cmd_queue import add_vanger_cmd

router = APIRouter(prefix="/api/hockey", tags=["hockey-vanger"])


@router.post("/competitions/{cid}/sync")
def sync_competition(
    cid: int,
    session: Session = Depends(get_session),
    _=Depends(require_admin),
):
    """Voeg alle poules van een discovery-competitie toe aan de vanger-wachtrij."""
    comp = session.get(HockeyCompetition, cid)
    if not comp:
        raise HTTPException(404, "Competitie niet gevonden")

    if comp.hl_comp_id:
        # Landelijke competitie met bekend comp_id: 1 comp-scan haalt alle poules
        # in 1x op. Losse get_poule-cmds hebben hier geen team_id (item 945) - die
        # poules zijn nooit via een team ontdekt, alleen via de comp-detail-sync.
        result = add_vanger_cmd(session, "get_competition_detail", {"comp_id": comp.hl_comp_id, "label": comp.name})
        return {"added": 1 if result["added"] else 0, "skipped": 0 if result["added"] else 1}

    poules = session.exec(
        select(HockeyPoule).where(HockeyPoule.competition_id == cid)
    ).all()
    if not poules:
        return {"added": 0, "skipped": 0}

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    pending = session.exec(
        select(VangerCmd).where(col(VangerCmd.status).in_(["pending", "in_progress"]))
    ).all()
    pending_ids = {
        json.loads(c.params).get("poule_id")
        for c in pending if c.cmd_type == "get_poule"
    }

    # get_poule kan alleen via een team gescand worden (hockey.nl heeft geen
    # poule-only route) - poules die nooit via een team ontdekt zijn (alleen via
    # comp-detail-sync, item 945) hebben geen team_id en moeten worden overgeslagen
    # i.p.v. een cmd te queuen die de vanger toch niet kan uitvoeren.
    team_by_poule: dict = {}
    for t in session.exec(select(HockeyTeam).where(col(HockeyTeam.recent_poule_id).is_not(None))).all():
        if t.recent_poule_id and t.recent_poule_id not in team_by_poule:
            team_by_poule[t.recent_poule_id] = t

    added = skipped = 0
    for p in poules:
        if p.poule_id in pending_ids:
            skipped += 1
            continue
        team = team_by_poule.get(p.poule_id)
        if not team:
            skipped += 1
            continue
        session.add(VangerCmd(
            cmd_type="get_poule",
            params=json.dumps({"poule_id": p.poule_id, "team_id": team.team_id, "label": p.name}),
            created_at=now,
        ))
        pending_ids.add(p.poule_id)
        added += 1

    session.commit()
    return {"added": added, "skipped": skipped}
