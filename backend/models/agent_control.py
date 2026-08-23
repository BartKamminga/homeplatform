from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class AgentNotification(SQLModel, table=True):
    __tablename__ = "agent_notifications"

    id:         Optional[int]    = Field(default=None, primary_key=True)
    agent_key:  str
    message:    str
    link:       Optional[str]    = None
    created_at: datetime         = Field(default_factory=datetime.utcnow)
    read_at:    Optional[datetime] = None


class AgentTask(SQLModel, table=True):
    __tablename__ = "agent_tasks"

    id:          Optional[int]    = Field(default=None, primary_key=True)
    agent_key:   str
    instruction: str
    status:      str              = Field(default="pending")  # pending | done | failed
    result:      Optional[str]    = None
    created_at:  datetime         = Field(default_factory=datetime.utcnow)
    finished_at: Optional[datetime] = None
