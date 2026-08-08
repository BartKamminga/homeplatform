from fastapi import APIRouter, Depends
from core.auth import require_admin
from models.core import User

router = APIRouter(prefix="/api", tags=["infra"])

DOCKER_SOCK = "/var/run/docker.sock"


def _docker(path: str):
    try:
        import httpx
        transport = httpx.HTTPTransport(uds=DOCKER_SOCK)
        with httpx.Client(transport=transport, base_url="http://docker", timeout=5.0) as c:
            r = c.get(path)
            r.raise_for_status()
            return r.json()
    except Exception:
        return None


@router.get("/admin/infrastructure")
def get_infrastructure(_: User = Depends(require_admin)):
    raw = _docker("/containers/json?all=false")
    if raw is None:
        return {"available": False, "containers": [], "hardware": _hardware()}

    containers = []
    for c in sorted(raw, key=lambda x: x.get("Names", [""])[0]):
        name = c["Names"][0].lstrip("/") if c.get("Names") else c["Id"][:12]
        inspect = _docker(f"/containers/{c['Id']}/json") or {}

        state  = inspect.get("State", {})
        health = (state.get("Health") or {}).get("Status")

        mounts = [
            {
                "source":      m.get("Source", ""),
                "destination": m.get("Destination", ""),
                "type":        m.get("Type", "bind"),
                "rw":          m.get("RW", True),
            }
            for m in inspect.get("Mounts", [])
        ]

        ports = []
        for p in c.get("Ports", []):
            pub = p.get("PublicPort")
            priv = p.get("PrivatePort")
            typ = p.get("Type", "tcp")
            if pub:
                ports.append({"public": pub, "private": priv, "type": typ})

        containers.append({
            "id":          c["Id"][:12],
            "name":        name,
            "image":       c.get("Image", ""),
            "status":      c.get("State", ""),
            "status_text": c.get("Status", ""),
            "health":      health,
            "ports":       ports,
            "mounts":      mounts,
        })

    return {"available": True, "containers": containers, "hardware": _hardware()}


def _hardware():
    try:
        import psutil, time as _t
        mem  = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        return {
            "cpu_percent": psutil.cpu_percent(interval=0.2),
            "memory":  {"total_gb": round(mem.total / 1024**3, 1), "used_gb": round(mem.used / 1024**3, 1), "percent": mem.percent},
            "disk":    {"total_gb": round(disk.total / 1024**3, 1), "used_gb": round(disk.used / 1024**3, 1), "percent": disk.percent},
            "uptime_s": int(_t.time() - psutil.boot_time()),
        }
    except Exception:
        return None
