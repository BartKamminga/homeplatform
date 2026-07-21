import json
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class HockeyClub(SQLModel, table=True):
    __tablename__ = "hockey_clubs"

    id:              int           = Field(default=None, primary_key=True)
    external_id:     str           = Field(unique=True, index=True)   # federation_reference_id
    name:            str
    friendly_name:   str
    city:            Optional[str] = None
    logo_url:        Optional[str] = None
    club_type:       str           = Field(default="regular")
    # Velden uit club-detail (ingeladen via vanger)
    address:         Optional[str] = None
    zipcode:         Optional[str] = None
    phone:           Optional[str] = None
    email:           Optional[str] = None
    website:         Optional[str] = None
    tenue:           Optional[str] = None
    district:        Optional[str] = None
    payment_options: Optional[str] = None
    parking:         Optional[str] = None
    hockey_types:    Optional[str] = None   # JSON-string: ["Veldhockey","Zaalhockey",...]
    detail_loaded:   bool          = Field(default=False)
    discovered_at:   datetime      = Field(default_factory=datetime.utcnow)
    updated_at:      datetime      = Field(default_factory=datetime.utcnow)


class HockeyTeam(SQLModel, table=True):
    __tablename__ = "hockey_teams"

    id:                  int           = Field(default=None, primary_key=True)
    team_id:             int           = Field(unique=True, index=True)   # hockey.nl team id
    club_external_id:    str           = Field(index=True)               # → hockey_clubs.external_id
    name:                str
    short_name:          str
    logo_url:            Optional[str] = None
    hockey_type:         str                    # VE / ZA
    category_group_name: str                    # Junioren / Senioren / ...
    recent_poule_id:          Optional[int] = None
    no_new_poule_confirmed:   bool          = Field(default=False)
    discovered_at:            datetime      = Field(default_factory=datetime.utcnow)
    updated_at:               datetime      = Field(default_factory=datetime.utcnow)


class HockeyCompetition(SQLModel, table=True):
    __tablename__ = "hockey_competitions"

    id:           int           = Field(default=None, primary_key=True)
    external_id:  str           = Field(unique=True, index=True)  # "{name}|{season}"
    name:         str
    class_name:   str                    # Gewest / District / Landelijk
    district:     Optional[str] = None
    hockey_type:  str           = Field(default="")  # VE / ZA
    season:       str
    discovered_at: datetime     = Field(default_factory=datetime.utcnow)
    updated_at:    datetime     = Field(default_factory=datetime.utcnow)


class HockeyPoule(SQLModel, table=True):
    __tablename__ = "hockey_poules"

    id:             int      = Field(default=None, primary_key=True)
    poule_id:       int      = Field(unique=True, index=True)  # hockey.nl poule id
    name:           str
    competition_id: int      = Field(index=True)               # → hockey_competitions.id
    season:         str
    discovered_at:  datetime = Field(default_factory=datetime.utcnow)
    updated_at:     datetime = Field(default_factory=datetime.utcnow)
