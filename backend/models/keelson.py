"""Keelson - manage every dimension of building and running software systems (item 1340).

A system (an app, site or the platform itself) holds elements: concrete things such as an
environment, a pipeline, a contract or a budget. Every element has a kind from the catalog
(services/keelson_catalog_*.py), which places it in one of the dimensions. Links connect elements
with a verb; checks are the per-system checklists for setting up, running and evolving.
"""
from datetime import datetime
from typing import Optional
import uuid

from sqlalchemy import Column, JSON, UniqueConstraint
from sqlmodel import Field, SQLModel


def new_uuid() -> str:
    return str(uuid.uuid4())


class KeelsonSystem(SQLModel, table=True):
    __tablename__ = "keelson_systems"

    id:          str  = Field(default_factory=new_uuid, primary_key=True)
    key:         str  = Field(unique=True, index=True)       # matches roadmap_items.site / changelog.site
    name:        str
    kind:        str  = Field(default="product")             # platform, product, tool
    status:      str  = Field(default="active")              # active, planned, archived
    description: Optional[str]  = Field(default=None)
    owner:       Optional[str]  = Field(default=None)
    meta:        Optional[dict] = Field(default=None, sa_column=Column(JSON))
    seeded:      bool = Field(default=False)                 # created by the HomePlatform seed
    created_at:  datetime = Field(default_factory=datetime.utcnow)
    updated_at:  datetime = Field(default_factory=datetime.utcnow)


class KeelsonElement(SQLModel, table=True):
    __tablename__ = "keelson_elements"
    __table_args__ = (UniqueConstraint("system_id", "key", name="uq_keelson_element_key"),)

    id:          str  = Field(default_factory=new_uuid, primary_key=True)
    system_id:   str  = Field(foreign_key="keelson_systems.id", index=True)
    key:         str                                         # stable within a system, used for upserts
    kind:        str  = Field(index=True)                    # catalog kind, e.g. Environment
    name:        str
    status:      str  = Field(default="present")             # present, partial, missing
    description: Optional[str]  = Field(default=None)
    attributes:  Optional[dict] = Field(default=None, sa_column=Column(JSON))
    source:      str  = Field(default="manual")              # manual, seed
    created_at:  datetime = Field(default_factory=datetime.utcnow)
    updated_at:  datetime = Field(default_factory=datetime.utcnow)


class KeelsonLink(SQLModel, table=True):
    __tablename__ = "keelson_links"
    __table_args__ = (UniqueConstraint("from_id", "to_id", "verb", name="uq_keelson_link"),)

    id:         str = Field(default_factory=new_uuid, primary_key=True)
    from_id:    str = Field(foreign_key="keelson_elements.id", index=True)
    to_id:      str = Field(foreign_key="keelson_elements.id", index=True)
    verb:       str
    source:     str = Field(default="manual")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class KeelsonCheck(SQLModel, table=True):
    __tablename__ = "keelson_checks"
    __table_args__ = (UniqueConstraint("system_id", "key", name="uq_keelson_check_key"),)

    id:         str  = Field(default_factory=new_uuid, primary_key=True)
    system_id:  str  = Field(foreign_key="keelson_systems.id", index=True)
    key:        str                                          # dimension.phase.index from the catalog
    dimension:  str
    phase:      str                                          # setup, run, evolve
    title:      str
    done:       bool = Field(default=False)
    done_at:    Optional[datetime] = Field(default=None)
    notes:      Optional[str] = Field(default=None)
    sort:       int  = Field(default=0)
