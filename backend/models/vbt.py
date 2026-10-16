"""VBT (Virtual Bike Trainer) — profiel per gebruiker, opgenomen ritten en de Strava-koppeling."""
from datetime import datetime
from typing import Optional
import uuid

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


def new_uuid() -> str:
    return str(uuid.uuid4())


class VbtProfile(SQLModel, table=True):
    __tablename__ = "vbt_profiles"

    user_id:    str = Field(foreign_key="users.id", primary_key=True)
    ftp:        int = Field(default=180)
    plan_slug:  Optional[str] = Field(default=None)            # actief trainingsplan (vbt_plans.slug); leeg = ftp-builder
    plan_start: Optional[str] = Field(default=None)            # yyyy-mm-dd, start van het trainingsplan
    plan_done:  Optional[dict] = Field(default=None, sa_column=Column(JSON))   # workout-id -> resultaat
    settings:   Optional[dict] = Field(default=None, sa_column=Column(JSON))   # hrMax, voice, traffic, ... (vrij uitbreidbaar)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class VbtRide(SQLModel, table=True):
    __tablename__ = "vbt_rides"

    id:          str = Field(default_factory=new_uuid, primary_key=True)
    user_id:     str = Field(foreign_key="users.id", index=True)
    client_id:   Optional[str] = Field(default=None, unique=True, index=True)   # id uit de browser: herhaald opslaan geeft geen dubbele rit
    started_at:  datetime
    kind:        str = Field(default="free")                   # free | workout
    course_key:  str = Field(index=True)                       # free-v1 of workout-id
    name:        str = Field(default="Free Ride")
    wo_id:       Optional[str] = Field(default=None)
    duration:    int = Field(default=0)                        # seconden rijtijd
    distance:    int = Field(default=0)                        # meter
    avg_w:       int = Field(default=0)
    max_w:       int = Field(default=0)
    avg_cad:     int = Field(default=0)
    avg_hr:      int = Field(default=0)
    kj:          int = Field(default=0)
    elevation:   int = Field(default=0)
    lap_time:    Optional[float] = Field(default=None)         # eerste volle ronde (vrije rit)
    jumped:      bool = Field(default=False)                   # in de workout gesprongen -> geen PB/ghost
    pb:          bool = Field(default=False)
    score:       Optional[int] = Field(default=None)           # cadansscore (workout)
    ftp:         Optional[int] = Field(default=None)
    samples:     Optional[list] = Field(default=None, sa_column=Column(JSON))
    in_progress: bool = Field(default=False)                  # live backup tijdens de rit, nog niet afgerond
    recovered:   bool = Field(default=False)                  # na een crash uit het journal hersteld (niet netjes afgesloten)
    review:      Optional[dict] = Field(default=None, sa_column=Column(JSON))   # workout-score met uitleg: score, power, cadence, tips
    elapsed:     int = Field(default=0)                       # klok-tijd van de rit (s), incl. pauzes
    pauses:      Optional[list] = Field(default=None, sa_column=Column(JSON))   # [{t, dur, reason}] - waar bleef de tijd
    events:      Optional[list] = Field(default=None, sa_column=Column(JSON))   # eventlog van de rit (zonder debug)
    hr_metrics:  Optional[dict] = Field(default=None, sa_column=Column(JSON))   # EF, decoupling, HR/W-fit (services/vbt_hr.py)
    deleted_at:  Optional[datetime] = Field(default=None)     # prullenbak: niets wordt definitief verwijderd
    rpe:         Optional[int] = Field(default=None)          # feedback na de rit: hoe zwaar (1-10, Borg CR10)
    readiness:   Optional[str] = Field(default=None)          # feedback: fresh | ok | tired | wrecked
    synced_at:   Optional[datetime] = Field(default=None)     # laatste live backup
    strava_upload_id:   Optional[str] = Field(default=None)
    strava_activity_id: Optional[str] = Field(default=None)
    strava_status:      Optional[str] = Field(default=None)    # uploading | done | error
    strava_error:       Optional[str] = Field(default=None)
    created_at:  datetime = Field(default_factory=datetime.utcnow)


class VbtStravaLink(SQLModel, table=True):
    __tablename__ = "vbt_strava_links"

    user_id:       str = Field(foreign_key="users.id", primary_key=True)
    athlete_id:    str
    athlete_name:  Optional[str] = Field(default=None)
    access_token:  str
    refresh_token: str
    expires_at:    int                                          # unix-seconden
    scope:         Optional[str] = Field(default=None)
    created_at:    datetime = Field(default_factory=datetime.utcnow)


class VbtWorkout(SQLModel, table=True):
    """Een workout: lijst intervallen [{d: sec, a: %FTP start, b: %FTP eind, c: cadans?, free?}]."""
    __tablename__ = "vbt_workouts"

    id:          str = Field(default_factory=new_uuid, primary_key=True)
    name:        str
    description: Optional[str] = Field(default=None)
    steps:       list = Field(default_factory=list, sa_column=Column(JSON))
    duration:    int = Field(default=0)                         # seconden
    source:      str = Field(default="custom", index=True)      # plan-slug, zwo of custom
    source_url:  Optional[str] = Field(default=None)
    owner_id:    Optional[str] = Field(default=None, foreign_key="users.id", index=True)   # None = voor iedereen
    content_hash: Optional[str] = Field(default=None, index=True)                          # ontdubbelen bij seed/import
    created_at:  datetime = Field(default_factory=datetime.utcnow)


class VbtPlan(SQLModel, table=True):
    __tablename__ = "vbt_plans"

    id:          str = Field(default_factory=new_uuid, primary_key=True)
    slug:        str = Field(index=True, unique=True)
    name:        str
    source_url:  Optional[str] = Field(default=None)
    day_offsets: list = Field(default_factory=list, sa_column=Column(JSON))   # dag n van de week -> dagen na maandag
    created_at:  datetime = Field(default_factory=datetime.utcnow)


class VbtPlanItem(SQLModel, table=True):
    """Een dag in een plan. key is stabiel (bv. ftpb-w2d4): daar hangen 'afgevinkt' en ritten aan."""
    __tablename__ = "vbt_plan_items"

    key:        str = Field(primary_key=True)
    plan_id:    str = Field(foreign_key="vbt_plans.id", index=True)
    week:       int
    day:        int
    kind:       str = Field(default="workout")                  # workout | rest | free
    workout_id: Optional[str] = Field(default=None, foreign_key="vbt_workouts.id")
    duration:   Optional[int] = Field(default=None)             # alleen voor free
