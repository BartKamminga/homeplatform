"""Blokken per pagina live/concept zetten (item 1239).

Een blok in concept is alleen zichtbaar voor de platformbeheerder (groep
admins); bezoekers zien het niet. Standaard is elk blok live - opgeslagen
wordt alleen de lijst blokken die in concept staan. Voorlopig in
app_settings; bij het instantiemodel (1236) gaat dit per instantie.
"""

import json
import re
from typing import Union
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from core.auth import require_admin
from core.database import get_session
from models.core import User
from models.settings import AppSetting

router = APIRouter(tags=["yearof-mo14"])

CONCEPT_BLOCKS_KEY = "yearof_concept_blocks"

# Bekende blokken - voorkomt dat er willekeurige sleutels in de instelling belanden.
KNOWN_BLOCKS = {
    "competition.chances",
    "competition.results",
    "competition.regrouping",
    "competition.standings",
    "topklasse.overview",
    "topklasse.regrouping",
    "topklasse.national",
    "action.thermometer",  # ook op Home en onder de wedstrijd-/spelerslinks
    "action.sponsors",     # ook onder de spelerslink
    "home.hero",
    "home.last_match",
    "home.standings",
    "home.next_match",
    "home.interview_candidates",
    "home.player_spotlight",
    "home.spotlight",
    "timeline.standings",
    "timeline.ranking",
    "timeline.upcoming",
    # Hele pagina's in het menu (concept = niet in het menu)
    "page.action",
    "page.spotlight",
    "page.team",
    "page.timeline",
    "page.upload",
}

# Eigen pagina's (custom_pages.py): "page.<id>" = hele pagina, "hero.<id>" = kop.
CUSTOM_PAGE_BLOCK_RE = re.compile(r"(page|hero)\.[a-z0-9-]{1,40}")

# Fotoblok op een wedstrijdpagina, per wedstrijd: "photos:<match_ref>"
# (match_ref = "knhb:<id>", "custom:<uuid>" of "page:<naam>", bv. Parijs weekend).
MATCH_PHOTOS_RE = re.compile(r"photos:(knhb|custom|page):[A-Za-z0-9_-]+")

# Kopstijl (A/B/C) van 1 wedstrijdpagina: "header:<match_ref>" - alleen als instelling.
MATCH_HEADER_RE = re.compile(r"header:(knhb|custom):[A-Za-z0-9_-]+")


def is_known_block(block_id: str) -> bool:
    return (block_id in KNOWN_BLOCKS or MATCH_PHOTOS_RE.fullmatch(block_id) is not None
            or MATCH_HEADER_RE.fullmatch(block_id) is not None
            or CUSTOM_PAGE_BLOCK_RE.fullmatch(block_id) is not None)


def match_photos_concept(session: Session) -> set[str]:
    """match_refs waarvan het fotoblok op concept staat."""
    return {b.split(":", 1)[1] for b in _concept_blocks(session) if b.startswith("photos:")}


def _concept_blocks(session: Session) -> list[str]:
    row = session.get(AppSetting, CONCEPT_BLOCKS_KEY)
    if not row or not row.value:
        return []
    try:
        return [b for b in json.loads(row.value) if is_known_block(b)]
    except ValueError:
        return []


@router.get("/blocks")
def get_blocks(session: Session = Depends(get_session)):
    """Publiek - welke blokken in concept staan (de frontend verbergt die voor bezoekers)."""
    return {"concept": _concept_blocks(session)}


class BlockStateIn(BaseModel):
    live: bool


@router.put("/blocks/{block_id}")
def set_block_state(
    block_id: str,
    body: BlockStateIn,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    """Alleen platformbeheerder - blok live of concept zetten."""
    if not is_known_block(block_id):
        raise HTTPException(status_code=404, detail="Onbekend blok")
    concept = set(_concept_blocks(session))
    if body.live:
        concept.discard(block_id)
    else:
        concept.add(block_id)
    row = session.get(AppSetting, CONCEPT_BLOCKS_KEY) or AppSetting(key=CONCEPT_BLOCKS_KEY)
    row.value = json.dumps(sorted(concept))
    row.updated_at = datetime.utcnow()
    session.add(row)
    session.commit()
    return {"concept": sorted(concept)}


# Instellingen per blok/pagina (item 1248), bv. {"competition.results": {"window": 3}}.
# Alleen kleine, platte waarden - de frontend kent per blok de mogelijke keuzes.
BLOCK_SETTINGS_KEY = "yearof_block_settings"
SettingValue = Union[str, int, bool, None]


def load_block_settings(session: Session) -> dict:
    row = session.get(AppSetting, BLOCK_SETTINGS_KEY)
    try:
        return json.loads(row.value) if row and row.value else {}
    except ValueError:
        return {}


@router.get("/block-settings")
def get_block_settings(session: Session = Depends(get_session)):
    """Publiek - instellingen per blok (aantallen, weergave)."""
    return load_block_settings(session)


@router.put("/block-settings/{block_id}")
def set_block_settings(
    block_id: str,
    body: dict[str, SettingValue],
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    """Alleen platformbeheerder - instellingen van 1 blok samenvoegen (None = weghalen)."""
    if not is_known_block(block_id):
        raise HTTPException(status_code=404, detail="Onbekend blok")
    if len(body) > 10 or any(len(k) > 40 or (isinstance(v, str) and len(v) > 200) for k, v in body.items()):
        raise HTTPException(status_code=422, detail="Te veel of te lange instellingen")
    settings = load_block_settings(session)
    merged = {**settings.get(block_id, {}), **body}
    settings[block_id] = {k: v for k, v in merged.items() if v is not None}
    row = session.get(AppSetting, BLOCK_SETTINGS_KEY) or AppSetting(key=BLOCK_SETTINGS_KEY)
    row.value = json.dumps(settings)
    row.updated_at = datetime.utcnow()
    session.add(row)
    session.commit()
    return settings[block_id]
