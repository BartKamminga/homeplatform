"""Dev-sessions — headless Claude Code CLI-containers beheren vanuit
agent-control (los van de LLM-agent-registry in agent_control.py: dit beheert
alleen de Docker-container-lifecycle van generieke, interactieve Claude
Code-sessies, niet een taakregistry met vaste data-sources/post-processes).

De UI/API bedient alleen create/start/stop/remove - niet de terminal zelf.
Bekijken/sturen van de daadwerkelijke sessie gebeurt via SSH+tmux of via
Claude's eigen Remote Control-pairing (claude.ai/code of de mobiele app).

Image is hardcoded (geen `image`-veld in het request) zodat dit endpoint
nooit een "start willekeurige container"-primitive kan worden."""

import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, col, select

from core.auth import require_admin
from core.database import get_session
from core.docker_engine import docker_api
from core.settings import settings
from models.core import User
from models.dev_sessions import DevSession
from services.dev_session_use_cases import USE_CASE_PROFILES

router = APIRouter(prefix="/api/agent-control/dev-sessions", tags=["dev-sessions"])

DEV_SESSION_IMAGE = "homeplatform-claude-agent:latest"
REMOTE_CONTROL_URL_RE = re.compile(r"https://claude\.ai/code/session_[A-Za-z0-9]+")


def _now() -> datetime:
    return datetime.utcnow()


def _session_out(s: DevSession) -> dict:
    return {
        "id":               s.id,
        "name":             s.name,
        "branch":           s.branch,
        "initial_prompt":   s.initial_prompt,
        "container_name":   s.container_name,
        "container_id":     s.container_id,
        "status":           s.status,
        "error":            s.error,
        "remote_control_url": s.remote_control_url,
        "memory_limit_mb":  s.memory_limit_mb,
        "git_enabled":      s.git_enabled,
        "interactive":      s.interactive,
        "use_case":         s.use_case,
        "env_name":         s.env_name,
        "headless_log":     _read_headless_log(s.container_id) if (not s.interactive and s.container_id and s.status in ("running", "done", "error")) else None,
        "created_by":       s.created_by,
        "created_at":       s.created_at.isoformat(),
        "started_at":       s.started_at.isoformat() if s.started_at else None,
        "stopped_at":       s.stopped_at.isoformat() if s.stopped_at else None,
        "removed_at":       s.removed_at.isoformat() if s.removed_at else None,
    }


def _tail_logs(container_id: str, lines: int = 20) -> str:
    """Laatste regels van de container-output - container draait met Tty=true,
    dus 1 platte tekststream, geen Docker-multiplexing-framing te ontwarren."""
    try:
        logs = docker_api(
            "GET", f"/containers/{container_id}/logs",
            params={"stdout": "true", "stderr": "true", "tail": str(lines)},
            parse_json=False,
        )
        return (logs or "").strip()[-500:]
    except Exception:
        return ""


def _read_headless_log(container_id: str, lines: int = 200) -> str:
    """Laatste regels van .claude-session.log voor interactive=false-sessies
    (item 1134) - analoog aan _tmux_capture, maar dan `cat`/`tail` i.p.v.
    tmux capture-pane (er is geen tmux-pane in een headless sessie)."""
    try:
        created = docker_api("POST", f"/containers/{container_id}/exec", json_body={
            "Cmd": ["tail", "-n", str(lines), "/workspace/.claude-session.log"],
            "AttachStdout": True,
            "AttachStderr": True,
            "Tty": True,
        })
        exec_id = created["Id"]
        return docker_api(
            "POST", f"/exec/{exec_id}/start",
            json_body={"Detach": False, "Tty": True},
            parse_json=False,
        ) or ""
    except Exception:
        return ""


def _tmux_capture(container_id: str, pane: str = "work", lines: int = 2000) -> str:
    """Inhoud van een tmux-pane uitlezen via docker exec - `docker logs` ziet
    alleen wat het hoofdproces (entrypoint.sh) zelf print, niet wat er ín een
    tmux-sessie gebeurt (die heeft zijn eigen pseudo-terminal, los van de
    container-logs)."""
    try:
        created = docker_api("POST", f"/containers/{container_id}/exec", json_body={
            "Cmd": ["tmux", "capture-pane", "-t", pane, "-p", "-S", f"-{lines}"],
            "AttachStdout": True,
            "AttachStderr": True,
            "Tty": True,
        })
        exec_id = created["Id"]
        return docker_api(
            "POST", f"/exec/{exec_id}/start",
            json_body={"Detach": False, "Tty": True},
            parse_json=False,
        ) or ""
    except Exception:
        return ""


def _scan_remote_control_url(container_id: str) -> Optional[str]:
    """claude.ai/code-link uit de tmux-pane vissen (die print /remote-control
    zelf) - de sidebar op claude.ai/code zelf is wisselvallig (soms verschijnt
    een gepairde sessie daar niet), dus dit is de betrouwbare bron."""
    pane_content = _tmux_capture(container_id)
    matches = REMOTE_CONTROL_URL_RE.findall(pane_content)
    return matches[-1] if matches else None


def _reconcile(s: DevSession, session: Session) -> DevSession:
    """Live Docker-status erbij halen en de DB corrigeren als Docker iets
    anders zegt (bv. OOM-killed terwijl de DB nog "running" zegt) - zelfde
    patroon als infra.py, dat ook altijd live inspecteert i.p.v. cache
    vertrouwt. Scant ook de container-logs op de Remote Control-link."""
    if not s.container_id or s.status in ("removed",):
        return s
    try:
        inspect = docker_api("GET", f"/containers/{s.container_id}/json")
    except Exception:
        return s
    docker_status = (inspect or {}).get("State", {}).get("Status")
    changed = False
    if docker_status in ("exited", "dead") and s.status == "running":
        exit_code = (inspect or {}).get("State", {}).get("ExitCode", 1)
        if not s.interactive and exit_code == 0:
            # Headless sessie die netjes klaar is (claude -p rondde af) - geen
            # fout, gewoon klaar. Interactieve sessies horen niet vanzelf te
            # stoppen (tail -f /dev/null blijft draaien), dus die blijven altijd
            # "error" bij een onverwachte exit.
            s.status = "done"
        else:
            s.status = "error"
            s.error = _tail_logs(s.container_id) or f"Container onverwacht gestopt (Docker-status: {docker_status})"
        changed = True
    if docker_status == "running" and s.interactive:
        url = _scan_remote_control_url(s.container_id)
        if url and url != s.remote_control_url:
            s.remote_control_url = url
            changed = True
    if changed:
        session.add(s)
        session.commit()
        session.refresh(s)
    return s


class DevSessionIn(BaseModel):
    name:           Optional[str] = None
    branch:         str = "develop"
    initial_prompt: Optional[str] = None
    use_case:       Optional[str] = None   # sleutel uit USE_CASE_PROFILES - vult git_enabled/interactive/env_name voor als niet expliciet gegeven
    git_enabled:    Optional[bool] = None  # expliciete override; anders profiel-default (of True zonder use_case, huidig gedrag)
    interactive:    Optional[bool] = None  # expliciete override; anders profiel-default (of True zonder use_case, huidig gedrag)
    env_name:       str = "prod"


@router.get("")
def list_dev_sessions(
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    items = session.exec(select(DevSession).order_by(col(DevSession.created_at).desc())).all()
    return [_session_out(_reconcile(s, session)) for s in items]


@router.post("", status_code=201)
def create_dev_session(
    body: DevSessionIn,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_admin),
):
    profile = USE_CASE_PROFILES.get(body.use_case, {}) if body.use_case else {}
    if body.use_case and not profile:
        raise HTTPException(status_code=400, detail=f"Onbekende use_case: {body.use_case}")
    git_enabled = body.git_enabled if body.git_enabled is not None else profile.get("git_enabled", True)
    interactive = body.interactive if body.interactive is not None else profile.get("interactive", True)

    # Item 1134: concurrency-limiet geldt los per as - git-toegang (max 1,
    # workspace/branch-conflicten) telt apart van de overige, lichte sessies.
    existing_running = session.exec(select(DevSession).where(DevSession.status == "running")).all()
    if git_enabled:
        count = len([s for s in existing_running if s.git_enabled])
        if count >= settings.DEV_SESSION_MAX_CONCURRENT_GIT:
            raise HTTPException(
                status_code=409,
                detail=f"Max {settings.DEV_SESSION_MAX_CONCURRENT_GIT} gelijktijdige git-sessie(s) bereikt - stop er eerst een",
            )
    else:
        count = len([s for s in existing_running if not s.git_enabled])
        if count >= settings.DEV_SESSION_MAX_CONCURRENT_OTHER:
            raise HTTPException(
                status_code=409,
                detail=f"Max {settings.DEV_SESSION_MAX_CONCURRENT_OTHER} gelijktijdige lichte sessies bereikt - stop er eerst een",
            )

    s = DevSession(
        name=body.name, branch=body.branch or "develop", initial_prompt=body.initial_prompt,
        memory_limit_mb=settings.DEV_SESSION_MEMORY_MB, created_by=current_user.id,
        created_at=_now(), git_enabled=git_enabled, interactive=interactive,
        use_case=body.use_case, env_name=body.env_name or "prod",
    )
    session.add(s)
    session.commit()
    session.refresh(s)

    # env-prefix nodig omdat prod en acc op dezelfde Docker-daemon draaien
    # (beide op de G4) - zonder dit zouden id's uit losse DB's (prod/acc)
    # dezelfde container-/volumenaam kunnen opleveren.
    env_tag = settings.ENVIRONMENT
    s.container_name = f"homeplatform_devsession_{env_tag}_{s.id}"
    s.workspace_volume = f"claude_session_{env_tag}_{s.id}_workspace"
    s.home_volume = f"claude_session_{env_tag}_{s.id}_home"
    session.add(s)
    session.commit()

    try:
        env = [
            f"CLAUDE_CODE_OAUTH_TOKEN={settings.CLAUDE_CODE_OAUTH_TOKEN}",
            f"GIT_ENABLED={'true' if s.git_enabled else 'false'}",
            f"INTERACTIVE={'true' if s.interactive else 'false'}",
            f"SESSION_ENV={s.env_name}",
            f"SESSION_NAME={s.name or f'devsession-{env_tag}-{s.id}'}",
        ]
        if s.git_enabled:
            env += [
                f"REPO_URL={settings.DEV_SESSION_REPO_URL}",
                f"BRANCH={s.branch}",
                f"GIT_USER_NAME={settings.DEV_SESSION_GIT_USER_NAME}",
                "GIT_USER_EMAIL=bart.kamminga@nipv.nl",
            ]
        if profile.get("onboarding_doc"):
            env.append(f"ONBOARDING_DOC={profile['onboarding_doc']}")
        if s.initial_prompt:
            env.append(f"INITIAL_PROMPT={s.initial_prompt}")

        binds = [
            f"{s.workspace_volume}:/workspace",
            f"{s.home_volume}:/root/.claude",
            f"{settings.DEV_SESSION_CONFIG_HOST_PATH}/{s.env_name}:/root/.session-config:ro",
        ]
        if s.git_enabled:
            binds.append(f"{settings.DEV_SESSION_DEPLOY_KEY_HOST_PATH}:/root/.ssh/id_ed25519:ro")
        if profile.get("mindbox_files_mount"):
            binds.append(f"{settings.DEV_SESSION_UPLOADS_HOST_PATH}/mindbox/{current_user.id}:/mnt/mindbox-files:ro")

        mem_bytes = s.memory_limit_mb * 1024 * 1024
        created = docker_api("POST", "/containers/create", params={"name": s.container_name}, json_body={
            "Image": DEV_SESSION_IMAGE,
            "Tty": True,
            "OpenStdin": True,
            "Env": env,
            "Labels": {"homeplatform.dev_session_id": str(s.id)},
            "HostConfig": {
                "Binds": binds,
                "Memory": mem_bytes,
                "MemorySwap": mem_bytes,
                "NanoCpus": 1_000_000_000,
            },
        })
        s.container_id = created["Id"]
        docker_api("POST", f"/containers/{s.container_id}/start")
        s.status = "running"
        s.started_at = _now()
    except Exception as exc:
        s.status = "error"
        s.error = str(exc)[:500]

    session.add(s)
    session.commit()
    session.refresh(s)
    return _session_out(s)


def _get_session(session: Session, dev_session_id: int) -> DevSession:
    s = session.get(DevSession, dev_session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Dev-sessie niet gevonden")
    return s


@router.post("/{dev_session_id}/stop")
def stop_dev_session(
    dev_session_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    s = _get_session(session, dev_session_id)
    if s.container_id:
        try:
            docker_api("POST", f"/containers/{s.container_id}/stop", params={"t": 10})
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Stoppen mislukt: {exc}")
    s.status = "stopped"
    s.stopped_at = _now()
    session.add(s)
    session.commit()
    return {"ok": True}


@router.post("/{dev_session_id}/start")
def start_dev_session(
    dev_session_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    s = _get_session(session, dev_session_id)
    if not s.container_id:
        raise HTTPException(status_code=400, detail="Sessie heeft nog geen container")
    try:
        docker_api("POST", f"/containers/{s.container_id}/start")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Starten mislukt: {exc}")
    s.status = "running"
    s.started_at = _now()
    session.add(s)
    session.commit()
    return {"ok": True}


@router.delete("/{dev_session_id}")
def remove_dev_session(
    dev_session_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    s = _get_session(session, dev_session_id)
    if s.container_id:
        try:
            docker_api("POST", f"/containers/{s.container_id}/stop", params={"t": 10})
        except Exception:
            pass  # kan al gestopt zijn
        try:
            docker_api("DELETE", f"/containers/{s.container_id}", params={"force": "true"})
        except Exception:
            pass
    for volume in (s.workspace_volume, s.home_volume):
        if volume:
            try:
                docker_api("DELETE", f"/volumes/{volume}", params={"force": "true"})
            except Exception:
                pass
    s.status = "removed"
    s.removed_at = _now()
    session.add(s)
    session.commit()
    return {"ok": True}
