from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlmodel import Session

from core.auth import get_current_user, require_admin
from core.database import get_session
from core.exceptions import AppError
from core.logging import log_action
from models.core import User
import services.mindbox_commands as svc

# Los router-bestand (i.p.v. toevoegen aan het al 380+ regels tellende
# routers/mindbox.py) - zie CLAUDE.md bestandsgrens-afspraak, item 1053.
router = APIRouter(prefix="/api/mindbox", tags=["mindbox"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class MindboxCommandStepIn(BaseModel):
    kind:         str
    action_key:   Optional[str] = None
    instruction:  str
    cli_hint:     Optional[str] = None


class MindboxCommandStepOut(BaseModel):
    position:     int
    kind:         str
    action_key:   Optional[str]
    instruction:  str
    cli_hint:     Optional[str]


class MindboxCommandCreate(BaseModel):
    entity:             Optional[str] = None
    action:             str
    param_kind:         str = "none"
    notation_template:  str
    icon:               Optional[str] = None
    description:        Optional[str] = None
    steps:              list[MindboxCommandStepIn]


class MindboxCommandUpdate(MindboxCommandCreate):
    pass


class MindboxCommandOut(BaseModel):
    id:                 str
    entity:             Optional[str]
    action:             str
    notation_key:       str
    param_kind:         str
    notation_template:  str
    icon:               str
    description:        Optional[str]
    steps:              list[MindboxCommandStepOut]
    created_at:         datetime
    updated_at:         datetime


class MindboxActionOut(BaseModel):
    key:       str
    group:     str
    label:     str
    template:  str


def _command_to_out(session: Session, command) -> MindboxCommandOut:
    steps = svc.get_steps(session, command.id)
    return MindboxCommandOut(
        id=command.id, entity=command.entity, action=command.action,
        notation_key=command.notation_key, param_kind=command.param_kind,
        notation_template=command.notation_template, icon=command.icon,
        description=command.description, created_at=command.created_at, updated_at=command.updated_at,
        steps=[
            MindboxCommandStepOut(
                position=s.position, kind=s.kind, action_key=s.action_key,
                instruction=s.instruction, cli_hint=s.cli_hint,
            )
            for s in steps
        ],
    )


# ---------------------------------------------------------------------------
# Elementaire-acties-referentie (statisch, zie services.mindbox_commands)
# ---------------------------------------------------------------------------

@router.get("/commands/actions", response_model=list[MindboxActionOut])
def list_actions():
    return svc.get_actions()


# ---------------------------------------------------------------------------
# Resolve — het generieke endpoint dat MindBox.ps1's -Explain aanroept
# ---------------------------------------------------------------------------

@router.get("/commands/resolve")
def resolve_command(
    notation: str,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return svc.resolve_command(session, notation)


# ---------------------------------------------------------------------------
# Script-download — ONGEAUTHENTICEERD, voor onboarding op een nieuwe machine
# (item 1053, Bart: "ik wil dit heel erg makkelijk kunnen doen"). Veilig
# zonder auth: het script bevat geen geheimen, alleen logica - de API-key
# komt pas later, per machine, via `-Setup` in een lokaal configbestand dat
# nooit wordt meegeserveerd.
# ---------------------------------------------------------------------------

def _find_script_path() -> Path:
    here = Path(__file__).resolve()
    candidates = [
        here.parent.parent / "MindBox.ps1",          # Docker: bind-mounted als /app/MindBox.ps1
        here.parent.parent.parent / "MindBox.ps1",    # Lokale dev: repo-root/MindBox.ps1
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise AppError("MindBox.ps1 niet gevonden op de server", status_code=500)


@router.get("/commands/script", response_class=PlainTextResponse)
def get_script():
    return _find_script_path().read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@router.get("/commands", response_model=list[MindboxCommandOut])
def list_commands(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    return [_command_to_out(session, c) for c in svc.get_commands(session)]


@router.post("/commands", response_model=MindboxCommandOut)
def create_command(
    data: MindboxCommandCreate,
    session: Session = Depends(get_session),
    user: User = Depends(require_admin),
):
    command = svc.create_command(
        session, user, data.entity, data.action, data.param_kind, data.notation_template,
        data.icon, data.description, [s.model_dump() for s in data.steps],
    )
    log_action(session, "mindbox.command.create", site="mindbox", user_id=user.id,
               payload={"command_id": command.id, "notation_key": command.notation_key})
    return _command_to_out(session, command)


@router.patch("/commands/{command_id}", response_model=MindboxCommandOut)
def update_command(
    command_id: str,
    data: MindboxCommandUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(require_admin),
):
    command = svc.update_command(
        session, command_id, data.entity, data.action, data.param_kind, data.notation_template,
        data.icon, data.description, [s.model_dump() for s in data.steps],
    )
    log_action(session, "mindbox.command.update", site="mindbox", user_id=user.id,
               payload={"command_id": command.id, "notation_key": command.notation_key})
    return _command_to_out(session, command)


@router.delete("/commands/{command_id}")
def delete_command(
    command_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(require_admin),
):
    svc.delete_command(session, command_id)
    log_action(session, "mindbox.command.delete", site="mindbox", user_id=user.id,
               payload={"command_id": command_id})
    return {"ok": True}
