"""Poulebord - eigen modellen. Verhuisd uit models/tournix.py (item 1268),
zodat Tournix gearchiveerd kan worden zonder Poulebord te breken. De tabel
blijft dezelfde (poulebord_boards), dus geen migratie."""

from datetime import datetime

from sqlmodel import Field, SQLModel


class PoulebordBoard(SQLModel, table=True):
    """Gedeeld board: een code-als-PK die de pins van een bezoeker bewaart."""
    __tablename__ = "poulebord_boards"

    id:         str      = Field(primary_key=True)   # 6-char short code
    name:       str
    club:       str      = Field(default="")
    pins:       str      = Field(default="[]")       # JSON: tournament IDs
    pool_pins:  str      = Field(default="[]")       # JSON: [{phaseId, poolName, tournamentName}]
    created_at: datetime = Field(default_factory=datetime.utcnow)
