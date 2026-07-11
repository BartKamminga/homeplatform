from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel
import uuid


def new_uuid() -> str:
    return str(uuid.uuid4())


class DownloadCradeGroup(SQLModel, table=True):
    __tablename__ = "download_crade_groups"

    id:         str           = Field(default_factory=new_uuid, primary_key=True)
    name:       str
    created_at: datetime      = Field(default_factory=datetime.utcnow)
    updated_at: datetime      = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = Field(default=None, foreign_key="users.id")


class DownloadCrade(SQLModel, table=True):
    __tablename__ = "download_crades"

    id:         str           = Field(default_factory=new_uuid, primary_key=True)
    name:       str
    subdir:     str           = Field(default="")   # veilige mapnaam onder DOWNLOAD_DIR
    group_id:   Optional[str] = Field(default=None, foreign_key="download_crade_groups.id")
    source_url: Optional[str] = Field(default=None)
    format:     str           = Field(default="flac")
    created_at: datetime      = Field(default_factory=datetime.utcnow)
    updated_at: datetime      = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = Field(default=None, foreign_key="users.id")


class DownloadJob(SQLModel, table=True):
    __tablename__ = "download_jobs"

    id:           str           = Field(default_factory=new_uuid, primary_key=True)
    url:          str
    source:       str           = Field(default="auto")
    title:        Optional[str] = Field(default=None)
    artist:       Optional[str] = Field(default=None)
    status:       str           = Field(default="queued")
    error:        Optional[str] = Field(default=None)
    output_path:  Optional[str] = Field(default=None)
    progress_log: Optional[str] = Field(default=None)
    format:       str           = Field(default="flac")
    crade_id:     Optional[str] = Field(default=None, foreign_key="download_crades.id")
    created_at:   datetime      = Field(default_factory=datetime.utcnow)
    updated_at:   datetime      = Field(default_factory=datetime.utcnow)
    created_by:   Optional[str] = Field(default=None, foreign_key="users.id")
