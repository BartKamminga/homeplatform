import json
from datetime import datetime
from typing import Optional
from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

# Gemengde FK-conventie (RFTR-B4, roadmap 987 - vastgelegd, niet gestandaardiseerd):
# HockeyPoule.competition_id / HockeyPublicationComp.competition_id verwijzen naar
# de INTERNE PK van HockeyCompetition (id). HockeyPouleStanding.poule_id /
# HockeyPouleMatch.poule_id / HockeyTeam.recent_poule_id / HockeyTeamPoule.poule_id
# verwijzen naar het EXTERNE HockeyPoule.poule_id (hockey.nl's eigen id) - net als
# HockeyPouleStanding.team_id / HockeyTeamPoule.team_id naar het externe
# HockeyTeam.team_id verwijzen, niet naar de interne PK. Dit is bewust zo gelaten
# (zie routers/hockey_scenario.py waar beide conventies samenkomen): standaardiseren
# zou elk schrijfpad in hockey_vanger_ingest.py/hockey_capture.py/hockey_clubs.py
# raken voor een zuiver stijl-argument, geen bug.


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
    last_scanned_at: Optional[datetime] = None


class HockeyTeam(SQLModel, table=True):
    __tablename__ = "hockey_teams"

    id:                  int           = Field(default=None, primary_key=True)
    team_id:             int           = Field(unique=True, index=True)   # hockey.nl team id
    club_external_id:    str           = Field(index=True, foreign_key="hockey_clubs.external_id")
    name:                str
    short_name:          str
    logo_url:            Optional[str] = None
    hockey_type:         str                    # VE / ZA
    category_group_name: str                    # Junioren / Senioren / ...
    recent_poule_id:          Optional[int] = None
    no_new_poule_confirmed:   bool          = Field(default=False)
    season_pending:           bool          = Field(default=False)
    discovered_at:            datetime      = Field(default_factory=datetime.utcnow)
    updated_at:               datetime      = Field(default_factory=datetime.utcnow)
    last_scanned_at:          Optional[datetime] = None


class HockeyTeamPoule(SQLModel, table=True):
    """Extra (niet-primaire) poule-koppeling voor een team dat in hetzelfde
    seizoen ook in een andere competitie speelt (bv. een bekertoernooi naast
    de reguliere competitie) - item 990. De primaire poule blijft
    HockeyTeam.recent_poule_id; deze tabel draagt uitsluitend de aanvullende
    koppelingen zodat de veelvoorkomende 1-poule-teams ongewijzigd blijven."""
    __tablename__ = "hockey_team_poules"

    id:                     int           = Field(default=None, primary_key=True)
    team_id:                int           = Field(index=True)   # hockey.nl team id (zelfde conventie als HockeyPouleStanding.team_id)
    poule_id:               int           = Field(index=True)   # hockey.nl poule id (zelfde conventie als HockeyTeam.recent_poule_id)
    season:                 str
    no_new_poule_confirmed: bool          = Field(default=False)
    season_pending:         bool          = Field(default=False)
    discovered_at:          datetime      = Field(default_factory=datetime.utcnow)
    updated_at:             datetime      = Field(default_factory=datetime.utcnow)
    last_scanned_at:        Optional[datetime] = None


class HockeyCompetition(SQLModel, table=True):
    __tablename__ = "hockey_competitions"

    id:           int           = Field(default=None, primary_key=True)
    external_id:  str           = Field(unique=True, index=True)  # "{name}|{class_name}|{district}|{season}"
    name:         str
    class_name:   str                    # Gewest / District / Landelijk
    district:     Optional[str] = None
    hockey_type:  str           = Field(default="")  # VE / ZA
    season:       str
    hl_comp_id:   Optional[int] = Field(default=None, unique=True, index=True)   # hockey.nl competition id
    discovered_at: datetime     = Field(default_factory=datetime.utcnow)
    updated_at:    datetime     = Field(default_factory=datetime.utcnow)


class HockeyPoule(SQLModel, table=True):
    __tablename__ = "hockey_poules"

    id:              int            = Field(default=None, primary_key=True)
    poule_id:        int            = Field(unique=True, index=True)  # hockey.nl poule id
    name:            str
    competition_id:  int            = Field(index=True, foreign_key="hockey_competitions.id")
    season:          str
    discovered_at:   datetime       = Field(default_factory=datetime.utcnow)
    updated_at:      datetime       = Field(default_factory=datetime.utcnow)
    last_scanned_at: Optional[datetime] = None
    ai_note:         Optional[str]  = Field(default=None)  # korte analyse-tekst van de poulebord-agent (item 957)


class HockeyPouleStanding(SQLModel, table=True):
    __tablename__ = "hockey_poule_standings"
    __table_args__ = (
        UniqueConstraint("poule_id", "team_id", name="ux_hockey_poule_standings_poule_team"),
    )

    id:            int           = Field(default=None, primary_key=True)
    poule_id:      int           = Field(index=True)
    team_id:       int           = Field(index=True)
    team_name:     str
    position:      Optional[int] = None
    played:        int           = Field(default=0)
    won:           int           = Field(default=0)
    drawn:         int           = Field(default=0)
    lost:          int           = Field(default=0)
    goals_for:     int           = Field(default=0)
    goals_against: int           = Field(default=0)
    points:        int           = Field(default=0)
    updated_at:    datetime      = Field(default_factory=datetime.utcnow)
    ai_note:       Optional[str] = Field(default=None)  # korte team-analyse van de poulebord-agent (item 957)


class VangerCmd(SQLModel, table=True):
    __tablename__ = "vanger_cmd_queue"

    id:             int           = Field(default=None, primary_key=True)
    cmd_type:       str           = Field(index=True)   # get_poule | scan_club
    params:         str                                 # JSON: {team_id, poule_id, label} or {external_id, label}
    status:         str           = Field(default="pending", index=True)  # pending|in_progress|done|failed|skipped
    created_at:     datetime      = Field(default_factory=datetime.utcnow)
    started_at:     Optional[datetime] = None
    finished_at:    Optional[datetime] = None
    error:          Optional[str] = None
    result_summary: Optional[str] = None  # JSON: {raw_bytes, duration_ms, teams, matches_total, ...}


class HockeyPouleMatch(SQLModel, table=True):
    __tablename__ = "hockey_poule_matches"
    __table_args__ = (
        UniqueConstraint("poule_id", "match_id", name="ux_hockey_poule_matches_poule_match"),
    )

    id:             int           = Field(default=None, primary_key=True)
    poule_id:       int           = Field(index=True)
    match_id:       Optional[int] = Field(default=None, index=True)
    home_team_id:   Optional[int] = None
    home_team_name: str           = Field(default="")
    away_team_id:   Optional[int] = None
    away_team_name: str           = Field(default="")
    match_date:     Optional[str] = None
    status:         str           = Field(default="")
    home_score:     Optional[int] = None
    away_score:     Optional[int] = None
    round:          Optional[int] = None
    location_name:  Optional[str] = None
    field_type:     Optional[str] = None
    updated_at:     datetime      = Field(default_factory=datetime.utcnow)
