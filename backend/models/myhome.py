"""MyHome - digitale tweeling van je eigen huis (item 1314).

Een huis bestaat uit verdiepingen met ruimtes (plattegrond-polygonen in meters). Bronnen (tekeningen,
foto's) en tekstuele verbeteringen zijn de invoerkant; de v1-API is de uitleeskant voor Hue, HA, enz.
"""
from datetime import datetime
from typing import Optional
import uuid

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


def new_uuid() -> str:
    return str(uuid.uuid4())


class Home(SQLModel, table=True):
    __tablename__ = "myhome_homes"

    id:                 str      = Field(default_factory=new_uuid, primary_key=True)
    user_id:            str      = Field(foreign_key="users.id", index=True)
    name:               str
    garden_orientation: Optional[str] = Field(default=None)   # windrichting van de tuinzijde: N, NO, O, ... ZW
    notes:              Optional[str] = Field(default=None)
    meta:               Optional[dict] = Field(default=None, sa_column=Column(JSON))   # vrij uitbreidbaar
    created_at:         datetime = Field(default_factory=datetime.utcnow)
    updated_at:         datetime = Field(default_factory=datetime.utcnow)


class HomeFloor(SQLModel, table=True):
    __tablename__ = "myhome_floors"

    id:        str   = Field(default_factory=new_uuid, primary_key=True)
    home_id:   str   = Field(foreign_key="myhome_homes.id", index=True)
    key:       str                                    # stabiele sleutel binnen het huis, bv. "ground"
    name:      str
    level:     float = Field(default=0)               # vloerhoogte in meters
    sort:      int   = Field(default=0)
    ha_floor:  Optional[str]  = Field(default=None)   # naam van de verdieping in Home Assistant
    roof:      Optional[dict] = Field(default=None, sa_column=Column(JSON))   # {line: [[x,h]...], z_from, z_to}


class HomeRoom(SQLModel, table=True):
    __tablename__ = "myhome_rooms"

    id:          str  = Field(default_factory=new_uuid, primary_key=True)
    home_id:     str  = Field(foreign_key="myhome_homes.id", index=True)
    floor_id:    str  = Field(foreign_key="myhome_floors.id", index=True)
    key:         str
    name:        str
    kind:        str  = Field(default="living")       # living, bedroom, wet, circulation, storage, outdoor
    polygon:     Optional[list] = Field(default=None, sa_column=Column(JSON))   # [[x, z], ...] in meters
    label_at:    Optional[list] = Field(default=None, sa_column=Column(JSON))   # [x, z], optioneel
    ha_area:     Optional[str]  = Field(default=None)
    link_status: str  = Field(default="none")         # linked, proposed, none
    notes:       Optional[str]  = Field(default=None)
    sort:        int  = Field(default=0)
    meta:        Optional[dict] = Field(default=None, sa_column=Column(JSON))   # uiterlijk: wall_color, floor_color, ...


class HomeSource(SQLModel, table=True):
    __tablename__ = "myhome_sources"

    id:         str      = Field(default_factory=new_uuid, primary_key=True)
    home_id:    str      = Field(foreign_key="myhome_homes.id", index=True)
    kind:       str      = Field(default="drawing")   # drawing, photo, document
    title:      str
    file_path:  str                                   # pad onder /api/uploads (categorie myhome)
    floor_key:  Optional[str] = Field(default=None)
    room_id:    Optional[str] = Field(default=None)   # foto van een ruimte (muur, hoek, raam)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class HomeNote(SQLModel, table=True):
    """Verbetering of aanvulling in gewone taal ("slaapkamer D is van Thom"); wordt verwerkt in het model."""
    __tablename__ = "myhome_notes"

    id:          str      = Field(default_factory=new_uuid, primary_key=True)
    home_id:     str      = Field(foreign_key="myhome_homes.id", index=True)
    text:        str
    status:      str      = Field(default="open")     # open, applied, rejected
    response:    Optional[str] = Field(default=None)
    created_at:  datetime = Field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = Field(default=None)


class HomeDevice(SQLModel, table=True):
    """IoT-apparaat in het huis (lamp, sensor, thermostaat, ...), optioneel gekoppeld aan een ruimte."""
    __tablename__ = "myhome_devices"

    id:           str  = Field(default_factory=new_uuid, primary_key=True)
    home_id:      str  = Field(foreign_key="myhome_homes.id", index=True)
    room_id:      Optional[str] = Field(default=None, foreign_key="myhome_rooms.id", index=True)
    name:         str
    kind:         str  = Field(default="other")       # light, sensor, switch, plug, thermostat, camera, speaker, ...
    source:       str  = Field(default="manual")      # manual, hue, home_assistant, tado, ...
    external_id:  Optional[str] = Field(default=None, index=True)   # id in het bronsysteem (entity_id, Hue-id)
    manufacturer: Optional[str] = Field(default=None)
    model:        Optional[str] = Field(default=None)
    notes:        Optional[str] = Field(default=None)
    meta:         Optional[dict] = Field(default=None, sa_column=Column(JSON))
    updated_at:   datetime = Field(default_factory=datetime.utcnow)


class HomePushJob(SQLModel, table=True):
    """Een goedgekeurde wijziging die naar HA (en via HA naar Hue) moet; uitgevoerd door de applier in HA."""
    __tablename__ = "myhome_push_jobs"

    id:         str      = Field(default_factory=new_uuid, primary_key=True)
    home_id:    str      = Field(foreign_key="myhome_homes.id", index=True)
    kind:       str                                   # rename_device, move_device, rename_area
    target:     str                                   # sleutel om dubbelingen te voorkomen, bv. ha_device_id of areanaam
    payload:    Optional[dict] = Field(default=None, sa_column=Column(JSON))
    status:     str      = Field(default="pending", index=True)   # pending, applied, failed
    result:     Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    applied_at: Optional[datetime] = Field(default=None)
