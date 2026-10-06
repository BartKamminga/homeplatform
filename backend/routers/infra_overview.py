"""Infrastructuur over meerdere machines (item 1190).

- /api/infra/host: machine-info van deze backend, voor de andere backend (gedeelde INFRA_PEER_TOKEN).
- /api/admin/infra/overview: eigen machine + die van de andere omgeving + laatste pipeline-runs.
Prod (g5) en acc (G4) roepen elkaar aan, dus beide admin-omgevingen tonen beide machines.
"""
import hmac
import time

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException

from core.auth import require_admin
from core.settings import settings
from models.core import User
from services import host_info

router = APIRouter(prefix="/api", tags=["infra-overview"])

GITHUB_RUNS_URL = "https://api.github.com/repos/BartKamminga/homeplatform/actions/runs"
_runs_cache: dict = {"at": 0.0, "runs": None}


@router.get("/infra/host")
def peer_host(x_infra_peer_token: str = Header(default="")):
    token = settings.INFRA_PEER_TOKEN
    if not token or not hmac.compare_digest(x_infra_peer_token, token):
        raise HTTPException(status_code=401, detail="Invalid peer token")
    return host_info.summary()


def _peer_url():
    role = host_info.role()
    if role == "production":
        return f"http://{settings.ACC_LAN_IP}:8081/api/infra/host"
    if role == "acceptance":
        return f"http://{settings.PROD_LAN_IP}:8080/api/infra/host"
    return None  # development: geen peer


def _fetch_peer():
    url = _peer_url()
    if not url:
        return {"available": False, "error": "No peer in development"}
    if not settings.INFRA_PEER_TOKEN:
        return {"available": False, "error": "INFRA_PEER_TOKEN not configured"}
    try:
        r = httpx.get(url, headers={"X-Infra-Peer-Token": settings.INFRA_PEER_TOKEN}, timeout=3.0)
        r.raise_for_status()
        return {"available": True, **r.json()}
    except httpx.HTTPError as exc:
        return {"available": False, "error": f"{exc.__class__.__name__}: {url}"}


def _pipeline_runs():
    """Laatste workflow-runs via de publieke GitHub-API (60 req/u zonder token) - 60s gecachet."""
    if time.time() - _runs_cache["at"] < 60 and _runs_cache["runs"] is not None:
        return _runs_cache["runs"]
    runs = None
    try:
        r = httpx.get(GITHUB_RUNS_URL, params={"per_page": 8}, timeout=4.0,
                      headers={"Accept": "application/vnd.github+json"})
        r.raise_for_status()
        runs = [{
            "id": w["id"],
            "workflow": w.get("name"),
            "title": w.get("display_title"),
            "branch": w.get("head_branch"),
            "sha": (w.get("head_sha") or "")[:7],
            "status": w.get("status"),
            "conclusion": w.get("conclusion"),
            "created_at": w.get("created_at"),
            "updated_at": w.get("updated_at"),
            "url": w.get("html_url"),
        } for w in r.json().get("workflow_runs", [])]
    except (httpx.HTTPError, ValueError):
        runs = _runs_cache["runs"]  # bij een storing de vorige stand tonen
    _runs_cache.update(at=time.time(), runs=runs)
    return runs


@router.get("/admin/infra/overview")
def infra_overview(_: User = Depends(require_admin)):
    return {
        "self": {"available": True, **host_info.summary()},
        "peer": _fetch_peer(),
        "pipeline": _pipeline_runs(),
        "ips": {"prod": settings.PROD_LAN_IP, "acc": settings.ACC_LAN_IP},
        "links": {
            "prod_admin": f"http://{settings.PROD_LAN_IP}:8080/admin/infrastructure",
            "acc_admin": f"http://{settings.ACC_LAN_IP}:8081/admin/infrastructure",
            "actions": "https://github.com/BartKamminga/homeplatform/actions",
        },
    }
