from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class DevSession(SQLModel, table=True):
    """Eén headless Claude Code CLI-sessie in een losse Docker-container
    (dev-sessions, item over agent-control). De backend beheert alleen de
    container-lifecycle (create/start/stop/remove) - niet de terminal/sessie
    zelf; sturing gebeurt via Claude's eigen Remote Control-pairing
    (claude.ai/code of mobiel) of via SSH + tmux. Rij wordt nooit hard
    verwijderd (status "removed" bij delete) - zelfde auditgedachte als
    AgentTask/AgentRunLog."""
    __tablename__ = "dev_sessions"

    id:               Optional[int]      = Field(default=None, primary_key=True)
    name:             Optional[str]      = Field(default=None)   # vrije label, door gebruiker gekozen
    branch:           str                = Field(default="develop")
    initial_prompt:   Optional[str]      = Field(default=None)   # optioneel: prompt waarmee claude direct start i.p.v. lege shell
    container_name:   Optional[str]      = Field(default=None)   # homeplatform_devsession_{id}
    container_id:     Optional[str]      = Field(default=None)   # Docker container-ID, pas bekend na create
    workspace_volume: Optional[str]      = Field(default=None)   # claude_session_{id}_workspace
    home_volume:      Optional[str]      = Field(default=None)   # claude_session_{id}_home
    status:           str                = Field(default="creating")  # creating|running|stopped|error|removed
    error:            Optional[str]      = Field(default=None)
    memory_limit_mb:  int                = Field(default=2048)
    created_by:       Optional[str]      = Field(default=None, foreign_key="users.id")
    created_at:       datetime           = Field(default_factory=datetime.utcnow)
    started_at:       Optional[datetime] = Field(default=None)
    stopped_at:       Optional[datetime] = Field(default=None)
    removed_at:       Optional[datetime] = Field(default=None)
