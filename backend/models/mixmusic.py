from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, Column
from sqlalchemy import JSON as SAJSON


class Genre(SQLModel, table=True):
    __tablename__ = "mixmusic_genres"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    color: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TrackHeart(SQLModel, table=True):
    __tablename__ = "mixmusic_track_hearts"
    id: Optional[int] = Field(default=None, primary_key=True)
    file_path: str = Field(index=True)
    position: float
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TrackMeta(SQLModel, table=True):
    __tablename__ = "mixmusic_track_meta"
    id: Optional[int] = Field(default=None, primary_key=True)
    file_path: str = Field(unique=True, index=True)
    display_name: Optional[str] = Field(default=None)
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    genres: Optional[list] = Field(default=None, sa_column=Column(SAJSON))
    moments: Optional[list] = Field(default=None, sa_column=Column(SAJSON))
    updated_at: datetime = Field(default_factory=datetime.utcnow)
