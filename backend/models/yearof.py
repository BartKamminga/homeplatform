"""YearOf MO14 ("MO14 à Paris") — supportersite Victoria MO14-1.

Single-tenant (bewust, zie roadmap item 1142/1143): geen team_slug-kolom,
hardcoded voor dit ene team. Generaliseren pas bij een echt tweede team.
"""

from datetime import datetime
from typing import Optional
import uuid

from sqlmodel import Field, SQLModel


def new_uuid() -> str:
    return str(uuid.uuid4())


class YearOfPlayer(SQLModel, table=True):
    __tablename__ = "yearof_players"

    id:           str            = Field(default_factory=new_uuid, primary_key=True)
    name:         str
    nickname:     Optional[str]  = Field(default=None)
    shirt_number: Optional[int]  = Field(default=None)
    position:     Optional[str]  = Field(default=None)
    photo_url:    Optional[str]  = Field(default=None)
    bio:          Optional[str]  = Field(default=None)
    fun_facts:    Optional[str]  = Field(default=None)  # JSON: [{"label": ..., "value": ...}]
    created_at:   datetime       = Field(default_factory=datetime.utcnow)
    updated_at:   datetime       = Field(default_factory=datetime.utcnow)


class YearOfTeamLink(SQLModel, table=True):
    """Teamlinkje (viewer-toegang), code-als-PK naar het PoulebordBoard-patroon.

    Fase 3 (v1): simpel - handmatig aangemaakt/vervangen door de beheerder,
    de meest recente niet-ingetrokken code is geldig. De per-wedstrijd
    rotatie + vangnet-dagen + content-scoping volgen in fase 1149 (fase 7).
    """
    __tablename__ = "yearof_team_links"

    id:         str            = Field(primary_key=True)  # 6-char code
    created_at: datetime        = Field(default_factory=datetime.utcnow)
    revoked_at: Optional[datetime] = Field(default=None)


class YearOfCustomEntry(SQLModel, table=True):
    """Handmatig ingevoerde tijdlijn-items naast de KNHB/Poulebord-sync.

    kind="oefen": oefenwedstrijd (opponent/score optioneel ingevuld).
    kind="bijzonder": vrije invoer (teamuitje, feestje, Pinksterweekend-reis).
    """
    __tablename__ = "yearof_custom_entries"

    id:          str            = Field(default_factory=new_uuid, primary_key=True)
    kind:        str             = Field(default="oefen")  # "oefen" | "bijzonder"
    title:       str
    date:        str             # ISO datum/datetime-string, zelfde stijl als HockeyPouleMatch.match_date
    opponent:    Optional[str]   = Field(default=None)
    is_home:     Optional[bool]  = Field(default=None)
    score_us:    Optional[int]   = Field(default=None)
    score_them:  Optional[int]   = Field(default=None)
    description: Optional[str]  = Field(default=None)
    is_pinned:   bool            = Field(default=False)  # bv. de Pinksterweekend-pagina
    created_at:  datetime        = Field(default_factory=datetime.utcnow)
    updated_at:  datetime        = Field(default_factory=datetime.utcnow)
