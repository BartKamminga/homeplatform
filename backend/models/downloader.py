from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel
import uuid


def new_uuid() -> str:
    return str(uuid.uuid4())


class DownloadJob(SQLModel, table=True):
    __tablename__ = "download_jobs"

    id:          str           = Field(default_factory=new_uuid, primary_key=True)
    url:         str
    source:      str           = Field(default="auto")   # beatport | youtube | soundcloud | auto
    title:       Optional[str] = Field(default=None)
    artist:      Optional[str] = Field(default=None)
    status:      str           = Field(default="queued")  # queued | downloading | done | error
    error:       Optional[str] = Field(default=None)
    output_path: Optional[str] = Field(default=None)
    format:      str           = Field(default="flac")
    created_at:  datetime      = Field(default_factory=datetime.utcnow)
    updated_at:  datetime      = Field(default_factory=datetime.utcnow)
    created_by:  Optional[str] = Field(default=None, foreign_key="users.id")
