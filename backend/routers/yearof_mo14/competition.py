"""Competitie-tab (items 1229-1232): instellingen voor de tab + featureflag.

De tab zelf toont bestaande openbare hockey-data (poulewedstrijden,
kansverdeling, herindelingsprognose, landelijke ranglijst); hier alleen:
- welke poule/team/publicatie de site volgt (straks multi-team via 1215);
- of de tab al voor bezoekers zichtbaar is. Tot die tijd ziet alleen een
  platformbeheerder (groep admins) de tab, en alleen die kan hem vrijgeven.
"""

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from core.auth import require_admin
from core.database import get_session
from models.core import User
from models.hockey_discovery import HockeyPoule, HockeyPouleStanding
from models.settings import AppSetting

from ._shared import POULE_ID, TEAM_NAME

router = APIRouter(tags=["yearof-mo14"])

COMPETITION_PUBLIC_KEY = "yearof_competition_public"
# Publicatie (Poulebord-tournament) van de MO14 - zelfde id als in de frontend
# (NationalQueries); bron voor ranglijst en herindelingsprognose.
MO14_TOURNAMENT_ID = "05615c6e-5c10-4151-b8a1-691779f8f467"


def _competition_public(session: Session) -> bool:
    row = session.get(AppSetting, COMPETITION_PUBLIC_KEY)
    return bool(row and row.value == "1")


@router.get("/competition")
def get_competition_config(session: Session = Depends(get_session)):
    """Publiek - wat de Competitie-tab nodig heeft: of hij vrijgegeven is en
    welke poule/team/publicatie. Bevat alleen openbare competitiegegevens."""
    poule = session.get(HockeyPoule, POULE_ID)
    team_id = None
    if poule:
        standing = session.exec(
            select(HockeyPouleStanding)
            .where(HockeyPouleStanding.poule_id == poule.poule_id, HockeyPouleStanding.team_name == TEAM_NAME)
        ).first()
        team_id = standing.team_id if standing else None
    return {
        "public": _competition_public(session),
        "poule_id": POULE_ID,
        "poule_name": poule.name if poule else None,
        "team_id": team_id,
        "team_name": TEAM_NAME,
        "tournament_id": MO14_TOURNAMENT_ID,
    }


class CompetitionFlagIn(BaseModel):
    public: bool


@router.put("/competition/public")
def set_competition_public(
    body: CompetitionFlagIn,
    session: Session = Depends(get_session),
    _: User = Depends(require_admin),
):
    """Alleen platformbeheerder (groep admins) - tab vrijgeven voor bezoekers."""
    row = session.get(AppSetting, COMPETITION_PUBLIC_KEY) or AppSetting(key=COMPETITION_PUBLIC_KEY)
    row.value = "1" if body.public else "0"
    row.updated_at = datetime.utcnow()
    session.add(row)
    session.commit()
    return {"public": body.public}
