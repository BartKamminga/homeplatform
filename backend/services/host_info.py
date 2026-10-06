"""Samenvatting van de machine waarop deze backend draait (item 1190).

Gebruikt door de Infrastructuur-pagina: elke backend levert zijn eigen machine-info
(lokaal of via het peer-endpoint), de overview-route voegt prod en acc samen.
"""
import json
import os
import re
import socket
import time
from datetime import date, datetime, timedelta, timezone

from core.docker_engine import docker_api
from core.settings import settings

DB_DIR = "/app/db"
BACKUP_DIR = os.path.join(DB_DIR, "backups")
_DAILY_RE = re.compile(r"^homeplatform-(\d{4}-\d{2}-\d{2})\.sqlite$")
_NAS_RE = re.compile(r"^(prod|acc)-homeplatform-(\d{4}-\d{2}-\d{2})\.sqlite$")
_PREDEPLOY_RE = re.compile(r"^pre-deploy-.*\.sqlite$")
_TUNNEL_CFG_RE = re.compile(r'Updated to new configuration config="(.*?)" version=')

_tunnel_cache: dict = {"at": 0.0, "routes": None}


def _read_json(path: str):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def hostname() -> str:
    # /etc/hostname van de host wordt read-only gemount; socket.gethostname() in een
    # container geeft alleen de container-id.
    try:
        with open(settings.HOST_HOSTNAME_FILE, encoding="utf-8") as f:
            name = f.read().strip()
            if name:
                return name
    except OSError:
        pass
    return socket.gethostname()


def role() -> str:
    if settings.ENVIRONMENT == "production":
        return "production"
    if settings.is_dev:
        return "development"
    return "acceptance"


def lan_ip() -> str:
    return settings.PROD_LAN_IP if role() == "production" else settings.ACC_LAN_IP


def hardware():
    try:
        import psutil
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        return {
            "cpu_percent": psutil.cpu_percent(interval=0.2),
            "memory": {"total_gb": round(mem.total / 1024**3, 1), "used_gb": round(mem.used / 1024**3, 1),
                       "percent": mem.percent},
            "disk": {"total_gb": round(disk.total / 1024**3, 1), "used_gb": round(disk.used / 1024**3, 1),
                     "percent": disk.percent},
            "uptime_s": int(time.time() - psutil.boot_time()),
        }
    except Exception:  # psutil ontbreekt of /proc niet leesbaar
        return None


def _docker(path: str):
    try:
        return docker_api("GET", path, timeout=5.0)
    except Exception:  # geen socket / docker niet bereikbaar
        return None


def containers():
    """Draaiende containers op deze machine, of None als de docker-socket ontbreekt."""
    raw = _docker("/containers/json?all=false")
    if raw is None:
        return None
    result = []
    for c in sorted(raw, key=lambda x: x.get("Names", [""])[0]):
        name = c["Names"][0].lstrip("/") if c.get("Names") else c["Id"][:12]
        inspect = _docker(f"/containers/{c['Id']}/json") or {}
        image = c.get("Image", "")
        result.append({
            "id": c["Id"][:12],
            "name": name,
            "image": image,
            "tag": image.rsplit(":", 1)[1] if ":" in image.rsplit("/", 1)[-1] else None,
            "status": c.get("State", ""),
            "status_text": c.get("Status", ""),
            "health": ((inspect.get("State") or {}).get("Health") or {}).get("Status"),
            "ports": [{"public": p["PublicPort"], "private": p.get("PrivatePort"), "type": p.get("Type", "tcp")}
                      for p in c.get("Ports", []) if p.get("PublicPort")],
            "mounts": [{"source": m.get("Source", ""), "destination": m.get("Destination", ""),
                        "type": m.get("Type", "bind"), "rw": m.get("RW", True)}
                       for m in inspect.get("Mounts", [])],
        })
    return result


def tunnel_routes(container_list):
    """Ingress van de cloudflared-tunnel, uit de containerlog (alleen op de machine waar die draait).
    Gecachet: de config verandert zelden en de log kan groot zijn."""
    tunnel = next((c for c in (container_list or []) if "cloudflared" in c["name"]), None)
    if not tunnel:
        return None
    if time.time() - _tunnel_cache["at"] < 300 and _tunnel_cache["routes"] is not None:
        return _tunnel_cache["routes"]
    routes = None
    try:
        logs = docker_api("GET", f"/containers/{tunnel['id']}/logs",
                          params={"stdout": 1, "stderr": 1, "tail": 5000}, timeout=5.0, parse_json=False)
        found = _TUNNEL_CFG_RE.findall(logs or "")
        if found:
            cfg = json.loads(found[-1].replace('\\"', '"'))
            routes = [{"hostname": r.get("hostname"), "service": r.get("service")}
                      for r in cfg.get("ingress", []) if r.get("hostname")]
    except Exception:  # log niet leesbaar of onverwacht formaat
        routes = None
    _tunnel_cache.update(at=time.time(), routes=routes)
    return routes


def backup_days(local: dict, nas_index, label: str, today: date, days: int = 14) -> list:
    """Per dag (nieuwste eerst): staat de backup lokaal en op de NAS?
    local = {datum: grootte_mb}; nas_index = inhoud van nas_index.json (of None = onbekend)."""
    nas_dates = None
    if nas_index is not None:
        nas_dates = {m.group(2) for f in nas_index.get("files", [])
                     if (m := _NAS_RE.match(f)) and m.group(1) == label}
    result = []
    for i in range(days):
        d = (today - timedelta(days=i)).isoformat()
        result.append({
            "date": d,
            "local": d in local,
            "local_mb": local.get(d),
            "nas": None if nas_dates is None else d in nas_dates,
        })
    return result


def backups():
    local, predeploy = {}, []
    try:
        for fname in os.listdir(BACKUP_DIR):
            path = os.path.join(BACKUP_DIR, fname)
            if m := _DAILY_RE.match(fname):
                local[m.group(1)] = round(os.path.getsize(path) / 1024 / 1024, 1)
            elif _PREDEPLOY_RE.match(fname):
                st = os.stat(path)
                predeploy.append({"name": fname, "size_mb": round(st.st_size / 1024 / 1024, 1),
                                  "at": datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat()})
    except OSError:
        pass
    nas_index = _read_json(os.path.join(BACKUP_DIR, "nas_index.json"))
    label = "prod" if role() == "production" else "acc"
    return {
        "days": backup_days(local, nas_index, label, datetime.now(timezone.utc).date()),
        "nas_checked_at": (nas_index or {}).get("checked_at"),
        "nas_mounted": (nas_index or {}).get("mounted"),
        "predeploy": sorted(predeploy, key=lambda p: p["at"], reverse=True),
    }


def summary() -> dict:
    """Alles wat de Infrastructuur-pagina over deze machine toont."""
    clist = containers()
    runner = _read_json(os.path.join(DB_DIR, "runner_status.json"))
    return {
        "hostname": hostname(),
        "role": role(),
        "lan_ip": lan_ip(),
        "hardware": hardware(),
        "docker_available": clist is not None,
        "containers": clist or [],
        "deploy": _read_json(os.path.join(DB_DIR, "deploy_info.json")),
        "runner": runner,
        "backup_cron_enabled": not os.path.exists(os.path.join(DB_DIR, "cron_disabled")),
        "backups": backups(),
        "tunnel_routes": tunnel_routes(clist),
        "collected_at": datetime.now(timezone.utc).isoformat(),
    }
