from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel

from models.mindbox import new_uuid


class MindboxCommand(SQLModel, table=True):
    """Herbruikbaar 'commando' in de env.MindBox.Entity.Cmd(#id)-notatie (Bart,
    item 1053: 'MindBox.ps1 moet dun blijven, commando's horen in de backend')
    - combineert 1+ elementaire acties (zie services.mindbox_commands.
    ELEMENTARY_ACTIONS) tot een kopieerbare recipe die zowel de website als
    MindBox.ps1 (-Explain) kunnen herleiden. notation_key is de unieke
    sleutel waarop resolve_command() zoekt, bv. "Case.Run" of "Run" (geen
    entity = globaal commando, zie MindboxCommand.entity)."""
    __tablename__ = "mindbox_commands"

    id:                str      = Field(default_factory=new_uuid, primary_key=True)
    user_id:           str      = Field(foreign_key="users.id", index=True)
    entity:            Optional[str] = Field(default=None)  # "Case" | "File" | ... | None (globaal)
    action:            str                                   # "Run" | "Enhance" | "ParseToTekst" | ...
    notation_key:      str      = Field(index=True)          # f"{entity}.{action}" of alleen action
    param_kind:        str      = Field(default="none")      # "none" | "id" | "name"
    notation_template: str                                   # "{env}.MindBox.Case.Run(#{param})"
    icon:              str      = Field(default="⚙️")        # emoji, getoond op de kopieerknop
    description:       Optional[str] = Field(default=None)
    created_at:        datetime = Field(default_factory=datetime.utcnow)
    updated_at:        datetime = Field(default_factory=datetime.utcnow)


class MindboxCommandStep(SQLModel, table=True):
    """Eén stap in de recipe van een MindboxCommand, uitgevoerd op volgorde
    (position). kind="api_call" heeft een cli_hint (letterlijke MindBox.ps1-
    aanroep met placeholders {id}/{name}/{env}, ingevuld door resolve_command);
    kind="manual" vereist LLM/Bart-oordeel (bv. "vat de sessie samen") en
    heeft geen cli_hint. action_key verwijst naar services.mindbox_commands.
    ELEMENTARY_ACTIONS - puur UI-gemak om bij bewerken de juiste dropdown-
    optie voor te selecteren, niet leidend voor resolve_command()."""
    __tablename__ = "mindbox_command_steps"

    id:            str      = Field(default_factory=new_uuid, primary_key=True)
    command_id:    str      = Field(foreign_key="mindbox_commands.id", index=True)
    position:      int
    kind:          str                                       # "api_call" | "manual"
    action_key:    Optional[str] = Field(default=None)
    instruction:   str                                        # NL tekst, placeholders {id}/{name}/{env}
    cli_hint:      Optional[str] = Field(default=None)        # bv. "-Run -Id {id} -Env {env}"
