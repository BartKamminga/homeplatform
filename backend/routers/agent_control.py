"""Agent Control — generieke registry/status/taken/notificaties voor
Managed-Agents-gedreven smart agents (hockey scan-agent, later fiets/poulebord)."""

import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import get_current_user, require_admin
from core.database import get_session
from models.agent_control import AgentNotification, AgentTask
from models.settings import AppSetting

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
    instruction: str


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
            "instruction": t.instruction,
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
    return [{"id": t.id, "instruction": t.instruction} for t in items]


@router.post("/tasks", status_code=201)
def add_task(
    body: AgentTaskIn,
    session: Session = Depends(get_session),
    _=Depends(require_admin),
):
    t = AgentTask(agent_key=body.agent_key, instruction=body.instruction, created_at=_now())
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
