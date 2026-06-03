from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel
import uuid


def new_uuid() -> str:
    return str(uuid.uuid4())


class ChangelogEntry(SQLModel, table=True):
    __tablename__ = "changelog"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    version: str = Field(index=True)
    site: str = Field(default="core", index=True)
    title: str
    description: Optional[str] = Field(default=None)
    released_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
