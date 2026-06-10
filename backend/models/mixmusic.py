from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


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
    position: float              # seconden in het nummer
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TrackMeta(SQLModel, table=True):
    __tablename__ = "mixmusic_track_meta"
    id: Optional[int] = Field(default=None, primary_key=True)
    file_path: str = Field(unique=True, index=True)
    display_name: Optional[str] = Field(default=None)  # vriendelijke naam (overschrijft bestandsnaam)
    rating: Optional[int] = Field(default=None)        # 1–10
    genres: Optional[str] = Field(default=None)        # JSON: ["Ambient", "Rock"]
    moments: Optional[str] = Field(default=None)       # JSON: ["morning", "afternoon", "evening", "night"]
    updated_at: datetime = Field(default_factory=datetime.utcnow)
