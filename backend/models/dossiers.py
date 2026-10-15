"""Dossiers (item 1355) - één plek per vraagstuk: stukken, notities, links en
mailvoorstellen, plus een samenvatting die Bart en Claude bijhouden. Bewust
klein gehouden (2 tabellen) na de ervaringen met MindBox."""
from datetime import datetime
from typing import Optional
import uuid

from sqlmodel import Field, SQLModel


def new_uuid() -> str:
    return str(uuid.uuid4())


class Dossier(SQLModel, table=True):
    __tablename__ = "dossiers"

    id:            str      = Field(default_factory=new_uuid, primary_key=True)
    user_id:       str      = Field(foreign_key="users.id", index=True)
    name:          str
    slug:          str      = Field(index=True)  # uniek per user (services-laag)
    # Markdown "stand van zaken" - bijgehouden door Bart en Claude.
    summary:       Optional[str] = Field(default=None)
    # Vrije tekst met zoektermen/afzenders/periode voor de mailronde in Claude Desktop.
    mail_criteria: Optional[str] = Field(default=None)
    status:        str      = Field(default="active")  # active | archived
    created_at:    datetime = Field(default_factory=datetime.utcnow)
    updated_at:    datetime = Field(default_factory=datetime.utcnow)


class DossierEntry(SQLModel, table=True):
    """Eén stuk in een dossier. kind: note | mail | document | link | session.
    review: None (gewoon onderdeel) | proposed (mailvoorstel van Claude, wacht op
    Bart) | rejected (afgewezen; blijft bewaard zodat external_ref hem niet
    opnieuw laat voorstellen)."""
    __tablename__ = "dossier_entries"

    id:                str      = Field(default_factory=new_uuid, primary_key=True)
    dossier_id:        str      = Field(foreign_key="dossiers.id", index=True)
    user_id:           str      = Field(foreign_key="users.id", index=True)
    kind:              str      = Field(default="note")
    title:             str
    body:              Optional[str] = Field(default=None)
    source_url:        Optional[str] = Field(default=None)
    file_path:         Optional[str] = Field(default=None)  # relatief onder UPLOAD_ROOT: dossiers/{user_id}/{uuid}{ext}
    original_filename: Optional[str] = Field(default=None)
    content_type:      Optional[str] = Field(default=None)
    size_bytes:        Optional[int] = Field(default=None)
    content_hash:      Optional[str] = Field(default=None, index=True)
    parent_entry_id:   Optional[str] = Field(default=None, foreign_key="dossier_entries.id", index=True)
    occurred_at:       Optional[datetime] = Field(default=None)
    external_ref:      Optional[str] = Field(default=None, index=True)
    review:            Optional[str] = Field(default=None)
    reason:            Optional[str] = Field(default=None)  # waarom Claude een mail voorstelt
    pinned:            bool     = Field(default=False)
    created_at:        datetime = Field(default_factory=datetime.utcnow)
    updated_at:        datetime = Field(default_factory=datetime.utcnow)
