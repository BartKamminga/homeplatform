from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel
import uuid


def new_uuid() -> str:
    return str(uuid.uuid4())


class TournixClub(SQLModel, table=True):
    __tablename__ = "tournix_clubs"

    id:                       str           = Field(default_factory=new_uuid, primary_key=True)
    name:                     str           = Field(unique=True)
    abbreviation:             Optional[str] = Field(default=None)
    city:                     Optional[str] = Field(default=None)
    color:                    Optional[str] = Field(default=None)
    federation_reference_id:  Optional[str] = Field(default=None)


class Tournament(SQLModel, table=True):
    __tablename__ = "tournix_tournaments"

    id:               str               = Field(default_factory=new_uuid, primary_key=True)
    name:             str
    date:             Optional[datetime] = Field(default=None)
    location:         Optional[str]     = Field(default=None)
    location_club_id: Optional[str]     = Field(default=None, foreign_key="tournix_clubs.id")
    description:      Optional[str]     = Field(default=None)
    status:           str               = Field(default="draft")  # draft | active | finished
    group_id:         Optional[str]     = Field(default=None, foreign_key="groups.id", index=True)
    created_by:       Optional[str]     = Field(default=None, foreign_key="users.id")
    created_at:       datetime          = Field(default_factory=datetime.utcnow)
    stage:            str               = Field(default="inregel")  # inregel | test | productie
    num_pools:        int               = Field(default=1)
    pool_type:        str               = Field(default="half")   # "half" | "vol"
    knockout_type:    str               = Field(default="none")   # none | seeded
    knockout_advance: int               = Field(default=2)        # teams per pool advancing to KO


class TournixPool(SQLModel, table=True):
    __tablename__ = "tournix_pools"
    id:            str           = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    tournament_id: str           = Field(foreign_key="tournix_tournaments.id")
    name:          str
    order:         int           = Field(default=0)
    phase_id:      Optional[str] = Field(default=None, foreign_key="tournix_phases.id", index=True)


class TournixTeam(SQLModel, table=True):
    __tablename__ = "tournix_teams"

    id:             str           = Field(default_factory=new_uuid, primary_key=True)
    tournament_id:  str           = Field(foreign_key="tournix_tournaments.id", index=True)
    name:           str
    short_name:     Optional[str] = Field(default=None)
    color:          Optional[str] = Field(default=None)
    created_at:     datetime      = Field(default_factory=datetime.utcnow)
    pool_id:        Optional[str] = Field(default=None, foreign_key="tournix_pools.id")
    club_id:        Optional[str] = Field(default=None, foreign_key="tournix_clubs.id")

    # Placeholder-velden (voor pre-gegenereerde vervolg-fase schema's)
    is_placeholder:              bool          = Field(default=False)
    placeholder_source_phase_id: Optional[str] = Field(default=None, foreign_key="tournix_phases.id")
    placeholder_pool_name:       Optional[str] = Field(default=None)
    placeholder_position:        Optional[int] = Field(default=None)


class TournixField(SQLModel, table=True):
    __tablename__ = "tournix_fields"

    id:             str           = Field(default_factory=new_uuid, primary_key=True)
    tournament_id:  str           = Field(foreign_key="tournix_tournaments.id", index=True)
    name:           str
    created_at:     datetime      = Field(default_factory=datetime.utcnow)
    club_id:        Optional[str] = Field(default=None, foreign_key="tournix_clubs.id")


class TournixPhase(SQLModel, table=True):
    __tablename__ = "tournix_phases"

    id:            str      = Field(default_factory=new_uuid, primary_key=True)
    tournament_id: str      = Field(foreign_key="tournix_tournaments.id", index=True)
    name:          str
    order:         int      = Field(default=0)
    phase_type:    str      = Field(default="pool")  # "pool" | "ko"
    created_at:    datetime = Field(default_factory=datetime.utcnow)


class TournixMatch(SQLModel, table=True):
    __tablename__ = "tournix_matches"

    id:             str               = Field(default_factory=new_uuid, primary_key=True)
    tournament_id:  str               = Field(foreign_key="tournix_tournaments.id", index=True)
    team_a_id:      Optional[str]     = Field(default=None, foreign_key="tournix_teams.id")
    team_b_id:      Optional[str]     = Field(default=None, foreign_key="tournix_teams.id")
    field_id:       Optional[str]     = Field(default=None, foreign_key="tournix_fields.id")
    phase_id:       Optional[str]     = Field(default=None, foreign_key="tournix_phases.id", index=True)
    round:          Optional[int]     = Field(default=None)
    scheduled_at:   Optional[datetime] = Field(default=None)
    score_a:         Optional[int]  = Field(default=None)
    score_b:         Optional[int]  = Field(default=None)
    shootout_winner: Optional[str]  = Field(default=None)  # "a" | "b" — only for tied KO matches
    status:          str            = Field(default="scheduled")  # scheduled | playing | finished
    match_type:      str            = Field(default="pool")       # pool | ko
    created_at:     datetime          = Field(default_factory=datetime.utcnow)


class TournixPhaseTeam(SQLModel, table=True):
    __tablename__ = "tournix_phase_teams"

    id:         str           = Field(default_factory=new_uuid, primary_key=True)
    phase_id:   str           = Field(foreign_key="tournix_phases.id", index=True)
    team_id:    str           = Field(foreign_key="tournix_teams.id")
    group_name: Optional[str] = Field(default=None)


class TournixPrediction(SQLModel, table=True):
    __tablename__ = "tournix_predictions"

    id:         str      = Field(default_factory=new_uuid, primary_key=True)
    match_id:   str      = Field(foreign_key="tournix_matches.id", index=True)
    user_id:    str      = Field(foreign_key="users.id", index=True)
    pred_a:     int
    pred_b:     int
    points:     Optional[int] = Field(default=None)
    created_at: datetime      = Field(default_factory=datetime.utcnow)


class TournixSnapshot(SQLModel, table=True):
    __tablename__ = "tournix_snapshots"

    id:             Optional[int] = Field(default=None, primary_key=True)
    tournament_id:  str           = Field(foreign_key="tournix_tournaments.id", index=True)
    round:          int
    snapshot_json:  str
    created_at:     datetime      = Field(default_factory=datetime.utcnow)
