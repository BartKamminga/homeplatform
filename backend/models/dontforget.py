from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel
import uuid


def new_uuid() -> str:
    return str(uuid.uuid4())


class Task(SQLModel, table=True):
    __tablename__ = "tasks"

    id:           str      = Field(default_factory=new_uuid, primary_key=True)
    title:        str
    photo_path:   Optional[str]      = Field(default=None)
    when:         str      = Field(default="morning")
    repeat:       str      = Field(default="once")
    day_of_week:  Optional[int]      = Field(default=None)
    priority:     str      = Field(default="normal")
    done:         bool     = Field(default=False)
    source:       str      = Field(default="user")
    created_at:   datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = Field(default=None)
    completed_by: Optional[str]      = Field(default=None, foreign_key="users.id")
    deleted_at:   Optional[datetime] = Field(default=None)
    user_id:      str      = Field(foreign_key="users.id", index=True)
    group_id:     Optional[str]      = Field(default=None, foreign_key="groups.id", index=True)
