from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class AgentContext(SQLModel, table=True):
    """Een herbruikbare 'context': welke databron-functie de agent gebruikt om
    vooraf iets te lezen, een vrije opdrachttekst, en welke post-process-functie
    het antwoord mag afhandelen (item 906/907/939). data_source_key en
    post_process_key moeten allebei voorkomen in de registry van agent_key
    (services/agents/) - dat wordt afgedwongen in routers/agent_control.py,
    niet hier."""
    __tablename__ = "agent_contexts"

    key:               str      = Field(primary_key=True)
    agent_key:         str
    name:              str
    pre_run_info:      str      = Field(default="")  # vrije opdrachttekst: wat moet er met de data gebeuren
    data_source_key:   str      = Field(default="")
    post_process_key:  str      = Field(default="none")
    created_at:        datetime = Field(default_factory=datetime.utcnow)
    updated_at:        datetime = Field(default_factory=datetime.utcnow)


class AgentRunLog(SQLModel, table=True):
    """Eén rij per analyse-cyclus van een agent (Ghost/Vanger-patroon: de worker
    stuurt zijn complete resultaat in 1x terug, de backend verwerkt/bewaart het).
    Legt de volledige berichtenstroom vast: input (context+opdracht die naar
    Claude ging), output (reasoning/notes/notification/cmds) en de uitkomst van
    de post-processing - niet alleen het eindresultaat. Dient tegelijk als:
    kennis (notes van de meest recente rij) en uitgebreide log (alle rijen)."""
    __tablename__ = "agent_run_logs"

    id:                  Optional[int]   = Field(default=None, primary_key=True)
    agent_key:           str
    context_key:         Optional[str]   = None
    task_id:             Optional[int]   = None
    input_payload:       str             = Field(default="{}")   # JSON: context + opdracht zoals naar Claude gestuurd
    reasoning:           str
    notes:               str             = Field(default="")
    notification:        Optional[str]   = None
    cmds_json:           str             = Field(default="[]")   # JSON-lijst van toegevoegde cmds, voor audit
    post_process_result: str             = Field(default="{}")   # JSON: wat de post-processing heeft gedaan
    created_at:          datetime        = Field(default_factory=datetime.utcnow)


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
    context_key: Optional[str]    = None
    instruction: str
    params_json: str              = Field(default="{}")  # bv. {"competition_id": 123} - context-specifieke targetgegevens
    status:      str              = Field(default="pending")  # pending | done | failed
    result:      Optional[str]    = None
    created_at:  datetime         = Field(default_factory=datetime.utcnow)
    finished_at: Optional[datetime] = None
