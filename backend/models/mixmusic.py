from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, Column
from sqlalchemy import JSON as SAJSON, UniqueConstraint


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
    user_id: Optional[str] = Field(default=None, index=True)
    group_id: Optional[str] = Field(default=None, index=True)
    position: float
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TrackMeta(SQLModel, table=True):
    __tablename__ = "mixmusic_track_meta"
    __table_args__ = (
        UniqueConstraint("file_path", "user_id", name="uq_trackmeta_file_user"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    file_path: str = Field(index=True)
    user_id: Optional[str] = Field(default=None, index=True)
    group_id: Optional[str] = Field(default=None, index=True)
    display_name: Optional[str] = Field(default=None)
    rating: Optional[int] = Field(default=None, ge=1, le=10)
    genres: Optional[list] = Field(default=None, sa_column=Column(SAJSON))
    moments: Optional[list] = Field(default=None, sa_column=Column(SAJSON))
    play_count: int = Field(default=0)
    play_seconds: int = Field(default=0)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TrackExcluded(SQLModel, table=True):
    __tablename__ = "mixmusic_excluded_tracks"
    __table_args__ = (
        UniqueConstraint("file_path", "group_id", name="uq_excluded_file_group"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    file_path: str = Field(index=True)
    group_id: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
