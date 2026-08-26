"""Agent Control — generieke registry/status/taken/notificaties/log voor
LLM-gedreven smart agents (hockey scan-agent, poulebord-agent, roadmap-agent).

Elke agent heeft zijn eigen, gesloten registry van databron- en post-process-
functies (backend/services/agents/, item 939) - een context mag alleen
kiezen uit de registry van zijn eigen agent (harde grens, afgedwongen hier)."""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import get_current_user, require_admin
from core.database import get_session
from models.agent_control import AgentContext, AgentNotification, AgentRunLog, AgentTask
from models.core import User
from models.settings import AppSetting
from services.agents import AGENT_REGISTRY

router = APIRouter(prefix="/api/agent-control", tags=["agent-control"])


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_agent(agent_key: str) -> dict:
    agent = AGENT_REGISTRY.get(agent_key)
    if not agent:
        raise HTTPException(status_code=404, detail="Onbekende agent")
    return agent


def _registry_public(agent: dict) -> dict:
    """Registry-info voor de UI/wizard - zonder de fn-callables (niet JSON-
    serialiseerbaar en geen platform-detail dat de frontend nodig heeft)."""
    return {
        "label": agent["label"],
        "default_data_source": agent.get("default_data_source"),
        "default_post_process": agent.get("default_post_process", "none"),
        "data_sources": {
            k: {"label": v["label"], "params": v["params"], "desc": v.get("desc", "")}
            for k, v in agent["data_sources"].items()
        },
        "post_processes": {
            k: {"label": v["label"], "result_fields": v["result_fields"]}
            for k, v in agent["post_processes"].items()
        },
    }


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
    for agent_key, agent in AGENT_REGISTRY.items():
        status_row = session.get(AppSetting, f"agent_status:{agent_key}")
        enabled_row = session.get(AppSetting, f"agent_enabled:{agent_key}")
        result.append({
            "agent_key": agent_key,
            "name":      agent["label"],
            "enabled":   enabled_row.value != "0" if enabled_row else True,
            "status":    json.loads(status_row.value) if status_row and status_row.value else None,
        })
    return result


@router.get("/agents/{agent_key}/registry")
def get_agent_registry(agent_key: str, _=Depends(get_current_user)):
    return _registry_public(_get_agent(agent_key))


@router.post("/agents/{agent_key}/toggle")
def toggle_agent(
    agent_key: str,
    session: Session = Depends(get_session),
    _=Depends(require_admin),
):
    _get_agent(agent_key)
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


# ── Contexten: databron + post-process, gescoped per agent (item 906/939) ──
# Een taak kiest een context; de context bepaalt welke databron de agent
# vooraf leest, wat de opdracht is, en welke post-process het antwoord mag
# afhandelen. data_source_key/post_process_key moeten allebei voorkomen in
# de registry van agent_key - harde grens, niet alleen een UI-filter.

def _validate_context_choice(agent_key: str, data_source_key: str, post_process_key: str) -> None:
    agent = _get_agent(agent_key)
    if data_source_key and data_source_key not in agent["data_sources"]:
        raise HTTPException(status_code=400, detail=f"'{data_source_key}' is geen databron van agent '{agent_key}'")
    if post_process_key not in agent["post_processes"]:
        raise HTTPException(status_code=400, detail=f"'{post_process_key}' is geen post-process van agent '{agent_key}'")


class AgentContextIn(BaseModel):
    key:               str
    agent_key:         str
    name:              str
    pre_run_info:      str = ""
    data_source_key:   str = ""
    post_process_key:  str = "none"


class AgentContextUpdate(BaseModel):
    agent_key:         Optional[str] = None
    name:              Optional[str] = None
    pre_run_info:      Optional[str] = None
    data_source_key:   Optional[str] = None
    post_process_key:  Optional[str] = None


def _context_out(c: AgentContext) -> dict:
    return {
        "key": c.key, "agent_key": c.agent_key, "name": c.name,
        "pre_run_info": c.pre_run_info,
        "data_source_key": c.data_source_key, "post_process_key": c.post_process_key,
        "updated_at": c.updated_at.isoformat(),
    }


@router.get("/contexts")
def list_contexts(
    agent_key: Optional[str] = None,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    q = select(AgentContext)
    if agent_key:
        q = q.where(AgentContext.agent_key == agent_key)
    return [_context_out(c) for c in session.exec(q).all()]


@router.post("/contexts", status_code=201)
def create_context(
    body: AgentContextIn,
    session: Session = Depends(get_session),
    _=Depends(require_admin),
):
    if session.get(AgentContext, body.key):
        raise HTTPException(status_code=409, detail="Context bestaat al")
    _validate_context_choice(body.agent_key, body.data_source_key, body.post_process_key)
    now = _now()
    c = AgentContext(
        key=body.key, agent_key=body.agent_key, name=body.name, pre_run_info=body.pre_run_info,
        data_source_key=body.data_source_key, post_process_key=body.post_process_key,
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
    data = body.model_dump(exclude_unset=True)
    agent_key = data.get("agent_key", c.agent_key)
    data_source_key = data.get("data_source_key", c.data_source_key)
    post_process_key = data.get("post_process_key", c.post_process_key)
    _validate_context_choice(agent_key, data_source_key, post_process_key)
    for field, value in data.items():
        setattr(c, field, value)
    c.updated_at = _now()
    session.add(c)
    session.commit()
    return {"ok": True}


@router.delete("/contexts/{key}")
def delete_context(
    key: str,
    session: Session = Depends(get_session),
    _=Depends(require_admin),
):
    """Context weggooien (item 952) - historische taken/runlogs blijven staan
    (context_key is puur een string-referentie, geen FK), alleen de definitie
    zelf verdwijnt."""
    c = session.get(AgentContext, key)
    if not c:
        raise HTTPException(status_code=404, detail="Niet gevonden")
    session.delete(c)
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
    # ai_score_graph (fiets)
    user_id:        Optional[str] = None
    ai_scores:      Optional[List[Dict[str, Any]]] = None


def _resolve_post_process_key(agent: dict, ctx: Optional[AgentContext]) -> str:
    if ctx:
        return ctx.post_process_key
    return agent.get("default_post_process", "none")


@router.post("/agents/{agent_key}/result")
def report_agent_result(
    agent_key: str,
    body: AgentResultIn,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    agent = _get_agent(agent_key)

    # Doet wat de context-teksten beloven: taak-params (bv. link_id) vult
    # automatisch aan wat Claude zelf niet teruggeeft - de agent hoeft target-
    # identifiers niet te onthouden/herhalen, wij weten al bij welke taak dit hoort.
    if body.task_id:
        task = session.get(AgentTask, body.task_id)
        if task:
            task_params = json.loads(task.params_json)
            if body.link_id is None:
                body.link_id = task_params.get("link_id")
            if body.roadmap_item_id is None:
                body.roadmap_item_id = task_params.get("roadmap_item_id")
            if body.user_id is None:
                body.user_id = task_params.get("user_id")

    ctx = session.get(AgentContext, body.context_key) if body.context_key else None
    post_process_key = _resolve_post_process_key(agent, ctx)
    post_process = agent["post_processes"].get(post_process_key)
    if not post_process:
        post_process_result = {"action": post_process_key, "ok": False, "reason": "onbekende post-process voor deze agent"}
    else:
        post_process_result = post_process["fn"](session, body, current_user)

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


@router.get("/agents/{agent_key}/context")
def get_agent_context(
    agent_key: str,
    context_key: Optional[str] = None,
    task_id: Optional[int] = None,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Bundelt wat de worker nodig heeft om aan een run te beginnen: kennis van
    de vorige run, de gekozen context (opdracht + toegestane afhandeling),
    openstaande ad-hoc taken, en de data uit de databron-functie van de context."""
    agent = _get_agent(agent_key)

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

    data_source_key = ctx.data_source_key if ctx else agent.get("default_data_source")
    data_source = agent["data_sources"].get(data_source_key) if data_source_key else None
    agent_state = data_source["fn"](session, task_params) if data_source else {}

    return {
        "knowledge": latest_log.notes if latest_log else "",
        "pending_tasks": [
            {"id": t.id, "context_key": t.context_key, "instruction": t.instruction, "params": json.loads(t.params_json)}
            for t in pending_tasks
        ],
        "context": {
            "key": ctx.key, "name": ctx.name, "pre_run_info": ctx.pre_run_info,
            "data_source_key": ctx.data_source_key, "post_process_key": ctx.post_process_key,
        } if ctx else None,
        "agent_state": agent_state,
    }


@router.get("/agents/{agent_key}/knowledge")
def get_agent_knowledge(
    agent_key: str,
    context_key: Optional[str] = None,
    session: Session = Depends(get_session),
    _=Depends(get_current_user),
):
    """Kennis (laatste notes) van een agent - optioneel gescoped tot 1 context
    (item 943), anders de laatste run ongeacht welke context 'm produceerde."""
    q = select(AgentRunLog).where(AgentRunLog.agent_key == agent_key)
    if context_key:
        q = q.where(AgentRunLog.context_key == context_key)
    latest = session.exec(q.order_by(col(AgentRunLog.created_at).desc()).limit(1)).first()
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
