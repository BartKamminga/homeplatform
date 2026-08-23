from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class AgentRunLog(SQLModel, table=True):
    """Eén rij per analyse-cyclus van een agent (Ghost/Vanger-patroon: de worker
    stuurt zijn complete resultaat in 1x terug, de backend verwerkt/bewaart het).
    Dient tegelijk als: kennis (notes van de meest recente rij), uitgebreide log
    (alle rijen, met reasoning) en audit-trail (welke cmds een run toevoegde)."""
    __tablename__ = "agent_run_logs"

    id:           Optional[int] = Field(default=None, primary_key=True)
    agent_key:    str
    reasoning:    str
    notes:        str            = Field(default="")
    notification: Optional[str]  = None
    cmds_json:    str             = Field(default="[]")  # JSON-lijst van toegevoegde cmds, voor audit
    created_at:   datetime        = Field(default_factory=datetime.utcnow)


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
