"""Blokken per pagina live/concept zetten (item 1239).

Een blok in concept is alleen zichtbaar voor de platformbeheerder (groep
admins); bezoekers zien het niet. Standaard is elk blok live - opgeslagen
wordt alleen de lijst blokken die in concept staan. Voorlopig in
app_settings; bij het instantiemodel (1236) gaat dit per instantie.
"""

import json
import re
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
    "paris.hero",
    "timeline.standings",
    "timeline.ranking",
    "timeline.upcoming",
    # Hele pagina's in het menu (concept = niet in het menu)
    "page.action",
    "page.spotlight",
    "page.team",
    "page.timeline",
    "page.upload",
    "page.pinksterweekend",
}

# Fotoblok op een wedstrijdpagina, per wedstrijd: "photos:<match_ref>"
# (match_ref = "knhb:<id>", "custom:<uuid>" of "page:<naam>", bv. Parijs weekend).
MATCH_PHOTOS_RE = re.compile(r"photos:(knhb|custom|page):[A-Za-z0-9_-]+")


def is_known_block(block_id: str) -> bool:
    return block_id in KNOWN_BLOCKS or MATCH_PHOTOS_RE.fullmatch(block_id) is not None


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
