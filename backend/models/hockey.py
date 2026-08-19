from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel
import uuid


def _new_uuid() -> str:
    return str(uuid.uuid4())


class HockeyPublication(SQLModel, table=True):
    __tablename__ = "hockey_publications"

    id:          str           = Field(default_factory=_new_uuid, primary_key=True)
    name:        str
    description: Optional[str] = Field(default=None)
    status:      str           = Field(default="active")   # active | finished
    group_id:    Optional[str] = Field(default=None, foreign_key="groups.id", index=True)
    created_by:  Optional[str] = Field(default=None, foreign_key="users.id")
    created_at:  datetime      = Field(default_factory=datetime.utcnow)
    season:      Optional[str] = Field(default=None)
    order:       int           = Field(default=0)
    published:   bool          = Field(default=False)
    info:        Optional[str] = Field(default=None)


class HockeyPublicationTag(SQLModel, table=True):
    __tablename__ = "hockey_publication_tags"

    id:    str = Field(default_factory=_new_uuid, primary_key=True)
    name:  str = Field(unique=True)
    order: int = Field(default=0)


class HockeyPublicationComp(SQLModel, table=True):
    __tablename__ = "hockey_publication_comps"

    id:             str           = Field(default_factory=_new_uuid, primary_key=True)
    publication_id: str           = Field(foreign_key="hockey_publications.id", index=True)
    competition_id: int           = Field(foreign_key="hockey_competitions.id")
    order:          int           = Field(default=0)
    label:          Optional[str] = Field(default=None)
    fase:           Optional[str] = Field(default=None)
    visible:        bool          = Field(default=True)
    scan_profile:   str           = Field(default="manual")  # manual | active


class HockeyPublicationCompTag(SQLModel, table=True):
    __tablename__ = "hockey_publication_comp_tags"

    id:           str = Field(default_factory=_new_uuid, primary_key=True)
    comp_link_id: str = Field(foreign_key="hockey_publication_comps.id", index=True)
    tag_id:       str = Field(foreign_key="hockey_publication_tags.id")
