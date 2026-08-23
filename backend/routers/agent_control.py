"""Agent Control — generieke registry/status/taken/notificaties/log voor
LLM-gedreven smart agents (hockey scan-agent, later fiets/poulebord)."""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import get_current_user, require_admin
from core.database import get_session
from models.agent_control import AgentContext, AgentNotification, AgentRunLog, AgentTask
from models.core import RoadmapItem, User
from models.hockey import HockeyPublicationComp
from models.hockey_discovery import (
    HockeyCompetition, HockeyPoule, HockeyPouleStanding, VangerCmd,
)
from models.settings import AppSetting
from routers.hockey_vanger import add_vanger_cmd
from routers.roadmap import RoadmapItemUpdate, update_item

router = APIRouter(prefix="/api/agent-control", tags=["agent-control"])

# Bekende agents - hardcoded lijst, geen aparte registry-tabel nodig zolang
# agents alleen via het (buiten deze API staande) Managed Agents setup-script
# worden aangemaakt.
KNOWN_AGENTS = {
    "hockey_scan": "Hockey scan-agent",
}


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Agent-overzicht: status/heartbeat + aan/uit ─────────────────────

class AgentHeartbeatIn(BaseModel):
    running: bool = False
    task:    Optional[str] = None
    state:   Optional[str] = None


@router.post("/agents/{agent_key}/heartbeat")
def agent_heartbeat(
    agent_key: str,
    body: AgentHeartbeatIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    payload = json.dumps({
        "running":   body.running,
        "task":      body.task,
        "state":     body.state,
        "last_seen": _now().isoformat(),
    }, ensure_ascii=False)
    key = f"agent_status:{agent_key}"
    row = session.get(AppSetting, key)
    if row:
        row.value = payload
        session.add(row)
    else:
        session.add(AppSetting(key=key, value=payload))
    session.commit()
    return {"ok": True}


@router.get("/agents")
def list_agents(
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    result = []
    for agent_key, name in KNOWN_AGENTS.items():
        status_row = session.get(AppSetting, f"agent_status:{agent_key}")
        enabled_row = session.get(AppSetting, f"agent_enabled:{agent_key}")
        result.append({
            "agent_key": agent_key,
            "name":      name,
            "enabled":   enabled_row.value != "0" if enabled_row else True,
            "status":    json.loads(status_row.value) if status_row and status_row.value else None,
        })
    return result


@router.post("/agents/{agent_key}/toggle")
def toggle_agent(
    agent_key: str,
    session: Session = Depends(get_session),
    _=Depends(require_admin),
):
    if agent_key not in KNOWN_AGENTS:
        raise HTTPException(status_code=404, detail="Onbekende agent")
    key = f"agent_enabled:{agent_key}"
    row = session.get(AppSetting, key)
    currently_enabled = row.value != "0" if row else True
    new_value = "0" if currently_enabled else "1"
    if row:
        row.value = new_value
        session.add(row)
    else:
        session.add(AppSetting(key=key, value=new_value))
    session.commit()
    return {"enabled": new_value != "0"}


# ── Contexten: herbruikbare pre-run info + post-processing-declaratie ──
# (item 905/906) Een taak kiest een context; de context bepaalt wat de agent
# vooraf weet en wat er met het antwoord mag gebeuren (post_process_action).

class AgentContextIn(BaseModel):
    key:                 str
    agent_key:           str
    name:                str
    pre_run_info:        str = ""
    post_process_action: str = "none"  # none | hockey_cmds | poulebord_note | roadmap_preanalysis


class AgentContextUpdate(BaseModel):
    name:                Optional[str] = None
    pre_run_info:        Optional[str] = None
    post_process_action: Optional[str] = None


@router.get("/contexts")
def list_contexts(
    agent_key: Optional[str] = None,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    q = select(AgentContext)
    if agent_key:
        q = q.where(AgentContext.agent_key == agent_key)
    items = session.exec(q).all()
    return [
        {
            "key": c.key, "agent_key": c.agent_key, "name": c.name,
            "pre_run_info": c.pre_run_info, "post_process_action": c.post_process_action,
            "updated_at": c.updated_at.isoformat(),
        }
        for c in items
    ]


@router.post("/contexts", status_code=201)
def create_context(
    body: AgentContextIn,
    session: Session = Depends(get_session),
    _=Depends(require_admin),
):
    if session.get(AgentContext, body.key):
        raise HTTPException(status_code=409, detail="Context bestaat al")
    now = _now()
    c = AgentContext(
        key=body.key, agent_key=body.agent_key, name=body.name,
        pre_run_info=body.pre_run_info, post_process_action=body.post_process_action,
        created_at=now, updated_at=now,
    )
    session.add(c)
    session.commit()
    return {"key": c.key}


@router.patch("/contexts/{key}")
def update_context(
    key: str,
    body: AgentContextUpdate,
    session: Session = Depends(get_session),
    _=Depends(require_admin),
):
    c = session.get(AgentContext, key)
    if not c:
        raise HTTPException(status_code=404, detail="Niet gevonden")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    c.updated_at = _now()
    session.add(c)
    session.commit()
    return {"ok": True}


# ── Notificaties ─────────────────────────────────────────────────

class NotificationIn(BaseModel):
    agent_key: str
    message:   str
    link:      Optional[str] = None


@router.get("/notifications")
def list_notifications(
    unread_only: bool = False,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    items = session.exec(
        select(AgentNotification).order_by(col(AgentNotification.created_at).desc()).limit(100)
    ).all()
    if unread_only:
        items = [n for n in items if n.read_at is None]
    unread_count = len(session.exec(
        select(AgentNotification).where(col(AgentNotification.read_at) == None)  # noqa: E711
    ).all())
    return {
        "unread_count": unread_count,
        "items": [
            {
                "id":         n.id,
                "agent_key":  n.agent_key,
                "message":    n.message,
                "link":       n.link,
                "created_at": n.created_at.isoformat(),
                "read_at":    n.read_at.isoformat() if n.read_at else None,
            }
            for n in items
        ],
    }


@router.post("/notifications", status_code=201)
def create_notification(
    body: NotificationIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    n = AgentNotification(agent_key=body.agent_key, message=body.message, link=body.link, created_at=_now())
    session.add(n)
    session.commit()
    session.refresh(n)
    return {"id": n.id}


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    n = session.get(AgentNotification, notification_id)
    if not n:
        raise HTTPException(status_code=404, detail="Niet gevonden")
    n.read_at = _now()
    session.add(n)
    session.commit()
    return {"ok": True}


# ── Opdrachten-queue: ad-hoc instructies aan een agent ────────────
# Ander soort queue dan hockey's vanger_cmd_queue: dit stuurt de agent zelf aan
# (orchestratieniveau), niet de daadwerkelijke hockey.nl-scraping (executieniveau).

class AgentTaskIn(BaseModel):
    agent_key:   str
    context_key: Optional[str] = None
    instruction: str
    params:      Dict[str, Any] = {}


@router.get("/tasks")
def list_tasks(
    agent_key: Optional[str] = None,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    q = select(AgentTask).order_by(col(AgentTask.created_at).desc()).limit(100)
    if agent_key:
        q = q.where(AgentTask.agent_key == agent_key)
    items = session.exec(q).all()
    return [
        {
            "id":          t.id,
            "agent_key":   t.agent_key,
            "context_key": t.context_key,
            "instruction": t.instruction,
            "params":      json.loads(t.params_json),
            "status":      t.status,
            "result":      t.result,
            "created_at":  t.created_at.isoformat(),
            "finished_at": t.finished_at.isoformat() if t.finished_at else None,
        }
        for t in items
    ]


@router.get("/tasks/pending")
def get_pending_tasks(
    agent_key: str,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Door de agent zelf aangeroepen bij de start van een run - geeft openstaande
    ad-hoc instructies terug zodat de agent ze naast zijn vaste routine oppakt."""
    items = session.exec(
        select(AgentTask).where(AgentTask.agent_key == agent_key, AgentTask.status == "pending")
    ).all()
    return [
        {"id": t.id, "context_key": t.context_key, "instruction": t.instruction, "params": json.loads(t.params_json)}
        for t in items
    ]


@router.post("/tasks", status_code=201)
def add_task(
    body: AgentTaskIn,
    session: Session = Depends(get_session),
    _=Depends(require_admin),
):
    t = AgentTask(
        agent_key=body.agent_key, context_key=body.context_key, instruction=body.instruction,
        params_json=json.dumps(body.params, ensure_ascii=False), created_at=_now(),
    )
    session.add(t)
    session.commit()
    session.refresh(t)
    return {"id": t.id}


class AgentTaskResultIn(BaseModel):
    result: Optional[str] = None
    error:  Optional[str] = None


@router.post("/tasks/{task_id}/result")
def report_task_result(
    task_id: int,
    body: AgentTaskResultIn,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    t = session.get(AgentTask, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Niet gevonden")
    t.status = "failed" if body.error else "done"
    t.result = body.error or body.result
    t.finished_at = _now()
    session.add(t)
    session.commit()
    return {"ok": True}


# ── Analyse-resultaat: 1 samengesteld antwoord per run, zelfde patroon als ──
# Ghost/Vanger (de worker post het complete resultaat, de backend verwerkt het
# i.p.v. dat de worker/LLM zelf losse endpoints aanroept). Dient tegelijk als
# kennis (notes) en uitgebreide log (reasoning) - zie AgentRunLog.

class AgentCmdIn(BaseModel):
    cmd_type: str
    params:   Dict[str, Any] = {}


class AgentResultIn(BaseModel):
    context_key:    Optional[str] = None
    task_id:        Optional[int] = None
    input_payload:  Optional[Dict[str, Any]] = None  # wat er naar Claude ging, puur voor het archief
    reasoning:      str
    notes:          str = ""
    notification:   Optional[str] = None
    cmds:           List[AgentCmdIn] = []
    # poulebord_note
    link_id:        Optional[str] = None
    note_text:      Optional[str] = None
    # roadmap_preanalysis
    roadmap_item_id: Optional[int] = None
    impact:         Optional[str] = None
    risk:           Optional[str] = None
    scope:          Optional[str] = None


def _resolve_post_process_action(session: Session, agent_key: str, context_key: Optional[str]) -> str:
    if context_key:
        ctx = session.get(AgentContext, context_key)
        if ctx:
            return ctx.post_process_action
    # Legacy fallback zolang hockey_scan-taken zonder context_key binnenkomen.
    return "hockey_cmds" if agent_key == "hockey_scan" else "none"


def _post_process(session: Session, agent_key: str, action: str, body: "AgentResultIn", current_user: User) -> dict:
    """Elke actie krijgt hier zijn eigen, kleine afhandeling - net als cmd_types
    in vanger_cmd_queue groeit deze lijst organisch mee (item 907)."""
    if action == "hockey_cmds":
        cmd_results = []
        for cmd in body.cmds:
            result = add_vanger_cmd(session, cmd.cmd_type, cmd.params)
            cmd_results.append({"cmd_type": cmd.cmd_type, "params": cmd.params, **result})
        return {"action": action, "cmds": cmd_results}

    if action == "poulebord_note":
        link = session.get(HockeyPublicationComp, body.link_id) if body.link_id else None
        if not link:
            return {"action": action, "ok": False, "reason": "link_id ontbreekt of onbekend"}
        link.ai_note = body.note_text or body.notes
        session.add(link)
        return {"action": action, "ok": True, "link_id": body.link_id}

    if action == "roadmap_preanalysis":
        if not body.roadmap_item_id:
            return {"action": action, "ok": False, "reason": "roadmap_item_id ontbreekt"}
        prefixed_notes = f"[AI-voorstel] {body.notes}".strip()
        update_item(
            body.roadmap_item_id,
            RoadmapItemUpdate(impact=body.impact, risk=body.risk, scope=body.scope, notes=prefixed_notes),
            session, current_user,
        )
        # Bewust GEEN status-wijziging - dit is een voorstel, een mens bevestigt
        # het item pas als analyzed (zie roadmap-item 906).
        return {"action": action, "ok": True, "roadmap_item_id": body.roadmap_item_id}

    if body.cmds:
        return {"action": action, "ok": False, "reason": "geen post-processing-actie gekoppeld aan deze context"}
    return {"action": action}


@router.post("/agents/{agent_key}/result")
def report_agent_result(
    agent_key: str,
    body: AgentResultIn,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if agent_key not in KNOWN_AGENTS:
        raise HTTPException(status_code=404, detail="Onbekende agent")

    action = _resolve_post_process_action(session, agent_key, body.context_key)
    post_process_result = _post_process(session, agent_key, action, body, current_user)

    log = AgentRunLog(
        agent_key=agent_key,
        context_key=body.context_key,
        task_id=body.task_id,
        input_payload=json.dumps(body.input_payload or {}, ensure_ascii=False),
        reasoning=body.reasoning,
        notes=body.notes,
        notification=body.notification,
        cmds_json=json.dumps(post_process_result.get("cmds", []), ensure_ascii=False),
        post_process_result=json.dumps(post_process_result, ensure_ascii=False),
        created_at=_now(),
    )
    session.add(log)

    if body.notification:
        session.add(AgentNotification(agent_key=agent_key, message=body.notification, created_at=_now()))

    session.commit()
    return {"ok": True, "post_process_result": post_process_result}


def _gather_agent_state(session: Session, agent_key: str, action: str, task_params: dict) -> dict:
    """Agent/actie-specifieke stand van zaken - blijft hier in de backend i.p.v.
    in de (generieke) worker, zelfde reden als de post-processing-dispatch."""
    agent_state: Dict[str, Any] = {}

    if agent_key == "hockey_scan" and action in ("hockey_cmds", "none"):
        counts = {}
        for status in ("pending", "in_progress", "done", "failed", "skipped"):
            counts[status] = len(session.exec(select(VangerCmd).where(VangerCmd.status == status)).all())
        agent_state["vanger_cmd_queue_counts"] = counts

    if action == "roadmap_preanalysis":
        items = session.exec(
            select(RoadmapItem).where(RoadmapItem.status == "idea").order_by(col(RoadmapItem.priority)).limit(10)
        ).all()
        agent_state["roadmap_idea_items"] = [
            {"id": i.id, "title": i.title, "site": i.site, "priority": i.priority, "description": i.description}
            for i in items
        ]

    if action == "poulebord_note":
        link_id = task_params.get("link_id")
        link = session.get(HockeyPublicationComp, link_id) if link_id else None
        if link:
            comp = session.get(HockeyCompetition, link.competition_id)
            poules = session.exec(select(HockeyPoule).where(HockeyPoule.competition_id == link.competition_id)).all()
            standings_by_poule = {}
            for p in poules:
                rows = session.exec(
                    select(HockeyPouleStanding)
                    .where(HockeyPouleStanding.poule_id == p.poule_id)
                    .order_by(HockeyPouleStanding.position)
                ).all()
                standings_by_poule[p.name] = [
                    {"team": r.team_name, "pts": r.points, "played": r.played, "gf": r.goals_for, "ga": r.goals_against}
                    for r in rows
                ]
            agent_state["link_id"] = link_id
            agent_state["competition_name"] = comp.name if comp else None
            agent_state["standings_by_poule"] = standings_by_poule
        else:
            agent_state["note"] = "geen (geldig) link_id meegegeven in de taak-params"

    return agent_state


@router.get("/agents/{agent_key}/context")
def get_agent_context(
    agent_key: str,
    context_key: Optional[str] = None,
    task_id: Optional[int] = None,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Bundelt wat de worker nodig heeft om aan een run te beginnen: kennis van
    de vorige run, de gekozen context (pre-run info + toegestane afhandeling),
    openstaande ad-hoc taken, en agent/actie-specifieke stand van zaken."""
    if agent_key not in KNOWN_AGENTS:
        raise HTTPException(status_code=404, detail="Onbekende agent")

    latest_log = session.exec(
        select(AgentRunLog)
        .where(AgentRunLog.agent_key == agent_key)
        .order_by(col(AgentRunLog.created_at).desc())
        .limit(1)
    ).first()
    pending_tasks = session.exec(
        select(AgentTask).where(AgentTask.agent_key == agent_key, AgentTask.status == "pending")
    ).all()

    task = session.get(AgentTask, task_id) if task_id else None
    task_params = json.loads(task.params_json) if task else {}
    resolved_context_key = context_key or (task.context_key if task else None)
    ctx = session.get(AgentContext, resolved_context_key) if resolved_context_key else None
    action = ctx.post_process_action if ctx else _resolve_post_process_action(session, agent_key, resolved_context_key)

    return {
        "knowledge": latest_log.notes if latest_log else "",
        "pending_tasks": [
            {"id": t.id, "context_key": t.context_key, "instruction": t.instruction, "params": json.loads(t.params_json)}
            for t in pending_tasks
        ],
        "context": {
            "key": ctx.key, "name": ctx.name, "pre_run_info": ctx.pre_run_info,
            "post_process_action": ctx.post_process_action,
        } if ctx else None,
        "agent_state": _gather_agent_state(session, agent_key, action, task_params),
    }


@router.get("/agents/{agent_key}/knowledge")
def get_agent_knowledge(
    agent_key: str,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    latest = session.exec(
        select(AgentRunLog)
        .where(AgentRunLog.agent_key == agent_key)
        .order_by(col(AgentRunLog.created_at).desc())
        .limit(1)
    ).first()
    return {"notes": latest.notes if latest else "", "updated_at": latest.created_at.isoformat() if latest else None}


@router.get("/agents/{agent_key}/log")
def get_agent_log(
    agent_key: str,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    items = session.exec(
        select(AgentRunLog)
        .where(AgentRunLog.agent_key == agent_key)
        .order_by(col(AgentRunLog.created_at).desc())
        .limit(50)
    ).all()
    return [
        {
            "id":                  l.id,
            "context_key":         l.context_key,
            "task_id":             l.task_id,
            "input_payload":       json.loads(l.input_payload),
            "reasoning":           l.reasoning,
            "notes":               l.notes,
            "notification":        l.notification,
            "cmds":                json.loads(l.cmds_json),
            "post_process_result": json.loads(l.post_process_result),
            "created_at":          l.created_at.isoformat(),
        }
        for l in items
    ]
