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
    remote_control_url: Optional[str]    = Field(default=None)   # laatst geziene claude.ai/code-link uit /remote-control (container-logs, niet uit claude.ai's eigen sidebar - die is wisselvallig)
    memory_limit_mb:  int                = Field(default=2048)
    # Item 1134: git-toegang en live-meekijken zijn losse assen, geen gekoppeld
    # paar - een mindbox-sessie kan bv. git=False + interactive=True zijn.
    git_enabled:      bool               = Field(default=True)   # git-clone/deploy-key/workspace-volume; concurrency-limiet (max 1) geldt alleen hierop
    interactive:      bool               = Field(default=True)   # tmux+Remote Control (True) vs. headless claude -p + logbestand (False)
    use_case:         Optional[str]      = Field(default=None)   # sleutel uit USE_CASE_PROFILES (mindbox/dev/fiets/hockey_inside/poulebord), None = vrije sessie
    env_name:         str                = Field(default="prod")  # welke omgeving (prod/acc/local) de sessie's scripts/config moeten gebruiken
    created_by:       Optional[str]      = Field(default=None, foreign_key="users.id")
    created_at:       datetime           = Field(default_factory=datetime.utcnow)
    started_at:       Optional[datetime] = Field(default=None)
    stopped_at:       Optional[datetime] = Field(default=None)
    removed_at:       Optional[datetime] = Field(default=None)
