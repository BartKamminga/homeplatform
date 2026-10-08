"""Eigen pagina's (item 1239): max 3, bv. Parijs weekend of een toernooipagina.

Een eigen pagina heeft een menunaam, een kop (icoon, titel, ondertitel) en
eigen berichten/fotos onder de verwijzing "page:<id>" (zelfde opslag als een
wedstrijdpagina). Live/concept via de blokken: "page.<id>" (hele pagina) en
"hero.<id>" (kop). Voorlopig in app_settings; bij het instantiemodel (1236)
gaat dit per instantie.
"""

import json
import re
import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session

from core.auth import require_admin
from core.database import get_session
from models.core import User
from models.settings import AppSetting

router = APIRouter(tags=["yearof-mo14"])

CUSTOM_PAGES_KEY = "yearof_custom_pages"
MAX_PAGES = 3
PAGE_ID_RE = re.compile(r"[a-z0-9-]{1,40}")

# Zonder opgeslagen instelling: Parijs weekend (bestond al als vaste pagina).
DEFAULT_PAGES = [{
    "id": "pinksterweekend",
    "label": "Parijs weekend",
    "title": "Het grote Parijs-weekend",
    "subtitle": "15-17 mei 2027 — het hoogtepunt van de hele actie.",
    "icon": "\U0001F5FC",
}]


def load_pages(session: Session) -> list[dict]:
    row = session.get(AppSetting, CUSTOM_PAGES_KEY)
    if not row:
        return [dict(p) for p in DEFAULT_PAGES]
    try:
        return json.loads(row.value or "[]")
    except ValueError:
        return []


def _save(session: Session, pages: list[dict]) -> None:
    row = session.get(AppSetting, CUSTOM_PAGES_KEY) or AppSetting(key=CUSTOM_PAGES_KEY)
    row.value = json.dumps(pages, ensure_ascii=False)
    row.updated_at = datetime.utcnow()
    session.add(row)
    session.commit()


def _slug(label: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")[:30] or "pagina"
    return f"{base}-{secrets.token_hex(2)}"


class PageIn(BaseModel):
    label: str = Field(min_length=1, max_length=30)
    title: str = Field(default="", max_length=80)
    subtitle: str = Field(default="", max_length=160)
    icon: str = Field(default="", max_length=8)


@router.get("/custom-pages")
def list_custom_pages(session: Session = Depends(get_session)):
    """Publiek - menu en kop van de eigen pagina's (live/concept staat in /blocks)."""
    return load_pages(session)


@router.post("/custom-pages")
def create_custom_page(body: PageIn, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    pages = load_pages(session)
    if len(pages) >= MAX_PAGES:
        raise HTTPException(status_code=400, detail=f"Maximaal {MAX_PAGES} eigen pagina's")
    page = {"id": _slug(body.label), **body.model_dump()}
    pages.append(page)
    _save(session, pages)
    return page


@router.put("/custom-pages/{page_id}")
def update_custom_page(page_id: str, body: PageIn, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    pages = load_pages(session)
    page = next((p for p in pages if p["id"] == page_id), None)
    if not page:
        raise HTTPException(status_code=404, detail="Pagina niet gevonden")
    page.update(body.model_dump())
    _save(session, pages)
    return page


@router.delete("/custom-pages/{page_id}")
def delete_custom_page(page_id: str, session: Session = Depends(get_session), _: User = Depends(require_admin)):
    """Haalt de pagina uit het menu. Berichten/fotos onder page:<id> blijven
    bewaard (niet zichtbaar) - niets wordt definitief verwijderd."""
    pages = load_pages(session)
    remaining = [p for p in pages if p["id"] != page_id]
    if len(remaining) == len(pages):
        raise HTTPException(status_code=404, detail="Pagina niet gevonden")
    _save(session, remaining)
    return {"ok": True}


def is_custom_page_id(page_id: Optional[str]) -> bool:
    return bool(page_id) and PAGE_ID_RE.fullmatch(page_id) is not None
