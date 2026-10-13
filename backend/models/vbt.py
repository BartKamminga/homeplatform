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
    plan_start: Optional[str] = Field(default=None)            # yyyy-mm-dd, start van het trainingsplan
    plan_done:  Optional[dict] = Field(default=None, sa_column=Column(JSON))   # workout-id -> resultaat
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class VbtRide(SQLModel, table=True):
    __tablename__ = "vbt_rides"

    id:          str = Field(default_factory=new_uuid, primary_key=True)
    user_id:     str = Field(foreign_key="users.id", index=True)
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
