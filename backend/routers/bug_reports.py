"""Bug-report-widget (item 887) - schrijft ALTIJD naar de canonieke roadmap-
database op prod, ongeacht vanuit welke omgeving de melding wordt gemaakt.
Acc en prod hebben elk hun eigen, losse SQLite-database (aparte volumes,
zie docker-compose.g4.yml/docker-compose.acc.yml) - een melding die je op
acc test zou anders in acc's eigen database belanden en nooit door Bart
gezien worden (roadmap.ps1 zelf praat om diezelfde reden ook altijd
rechtstreeks tegen prod's API, nooit tegen de lokale omgeving).

Op prod zelf: rechtstreeks lokaal opslaan (dat IS de canonieke database).
Op acc/dev: server-naar-server doorgestuurd naar prod's eigen API met een
losse, servergebonden PROD_API_KEY (nooit naar de browser verstuurd - de
browser praat alleen met de lokale omgeving, zoals altijd)."""

import json
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlmodel import Session

from core.auth import get_current_user
from core.database import get_session
from core.settings import settings
from models.core import RoadmapItem, User
from routers.uploads import ALLOWED_EXTENSIONS, ALLOWED_TYPES, _safe_path

router = APIRouter(prefix="/api/bug-reports", tags=["bug-reports"])
logger = logging.getLogger(__name__)


def _is_forwarding() -> bool:
    return settings.ENVIRONMENT != "production" and bool(settings.PROD_API_BASE and settings.PROD_API_KEY)


async def _save_screenshot_locally(screenshot: UploadFile, user: User) -> Optional[str]:
    import uuid
    from pathlib import Path

    ext = Path(screenshot.filename or "screenshot.png").suffix.lower() or ".png"
    if ext not in ALLOWED_EXTENSIONS:
        return None
    base_type = (screenshot.content_type or "").split(";")[0].strip()
    if base_type not in ALLOWED_TYPES:
        return None

    content = await screenshot.read()
    filename = f"{uuid.uuid4()}{ext}"
    abs_path = _safe_path("roadmap", user.id, filename)
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(content)
    return f"/api/uploads/roadmap/{user.id}/{filename}"


async def _forward_to_prod(description: str, site: str, notes: str, screenshot: Optional[UploadFile]) -> None:
    headers = {"Authorization": f"Bearer {settings.PROD_API_KEY}"}
    async with httpx.AsyncClient(base_url=settings.PROD_API_BASE, timeout=15.0) as client:
        image_url = None
        if screenshot:
            content = await screenshot.read()
            files = {"file": (screenshot.filename or "screenshot.png", content, screenshot.content_type or "image/png")}
            upload_res = await client.post("/api/uploads", params={"category": "roadmap"}, headers=headers, files=files)
            if upload_res.status_code < 400:
                image_url = upload_res.json().get("url")

        await client.post(
            "/api/roadmap",
            headers=headers,
            json={
                "title": description.strip()[:80],
                "description": description.strip(),
                "site": site,
                "priority": "medium",
                "status": "idea",
                "notes": notes,
                "images": json.dumps([image_url]) if image_url else None,
            },
        )


@router.post("")
async def create_bug_report(
    description: str = Form(...),
    site: str = Form("platform"),
    notes: str = Form(""),
    screenshot: Optional[UploadFile] = File(None),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if _is_forwarding():
        try:
            await _forward_to_prod(description, site, notes, screenshot)
        except Exception as exc:
            logger.error("Bug-report doorsturen naar prod mislukt: %s", exc)
            return {"ok": False, "error": "Doorsturen naar prod mislukt - is PROD_API_KEY nog geldig?"}
        return {"ok": True}

    image_url = await _save_screenshot_locally(screenshot, user) if screenshot else None
    item = RoadmapItem(
        title=description.strip()[:80],
        description=description.strip(),
        site=site,
        priority="medium",
        status="idea",
        notes=notes,
        images=json.dumps([image_url]) if image_url else None,
    )
    session.add(item)
    session.commit()
    return {"ok": True}
