import re
from datetime import datetime
from typing import Optional

from sqlmodel import Session, col, select

from core.exceptions import AppError
from models.core import User
from models.mindbox_commands import MindboxCommand, MindboxCommandStep

# Item 1053 (Bart): "MindBox.ps1 moet dun blijven" - de elementaire acties
# hieronder komen 1-op-1 overeen met MindBox.ps1's bestaande switches. Hier
# iets aan toevoegen is een BEWUSTE, zeldzame code-wijziging (nieuwe
# backend-route + nieuwe PS-switch + een regel hier) - dit is dus geen
# databasetabel maar een statische bron van waarheid, geserveerd via
# GET /commands/actions voor de stappen-editor (website) en als referentie
# bij -DefineCommand/-Explain-foutmeldingen in MindBox.ps1.
ELEMENTARY_ACTIONS = [
    {"key": "List", "group": "Lezen", "label": "-List — bestanden oplijsten",
     "template": "-List [-CaseId {id}] -Env {env}"},
    {"key": "ListCases", "group": "Lezen", "label": "-ListCases — cases oplijsten",
     "template": "-ListCases -Env {env}"},
    {"key": "ListContexts", "group": "Lezen", "label": "-ListContexts — contexts oplijsten",
     "template": "-ListContexts -Env {env}"},
    {"key": "ListContacts", "group": "Lezen", "label": "-ListContacts — contacts oplijsten",
     "template": "-ListContacts [-Email {email}] -Env {env}"},
    {"key": "Get", "group": "Lezen", "label": "-Get — één item tonen",
     "template": "-Get -Id {id} -Env {env}"},
    {"key": "Run", "group": "Bestand", "label": "-Run — bestand downloaden + briefing",
     "template": "-Run -Id {id} -Env {env}"},
    {"key": "RunAll", "group": "Bestand", "label": "-Run -All — alle/case-items downloaden",
     "template": "-Run -All -CaseId {id} -Env {env}"},
    {"key": "Status", "group": "Bestand", "label": "-Status — status bijwerken",
     "template": "-Status -Id {id} -Value {value} -Env {env}"},
    {"key": "Note", "group": "Bestand", "label": "-Note — notities (Bart) bijwerken",
     "template": '-Note -Id {id} -Text "..." -Env {env}'},
    {"key": "ParsedText", "group": "Bestand", "label": "-ParsedText — geparste tekst opslaan",
     "template": '-ParsedText -Id {id} -Text "..." -Env {env}'},
    {"key": "UploadAttachment", "group": "Bestand", "label": "-UploadAttachment — bijlage uploaden",
     "template": "-UploadAttachment -ParentId {id} -FilePath <pad> -Env {env}"},
    {"key": "Upload", "group": "Bestand", "label": "-Upload — bestand rechtstreeks in een case zetten",
     "template": "-Upload -CaseId {id} -FilePath <pad> -Env {env}"},
    {"key": "Contact", "group": "Contact", "label": "-Contact — contact toevoegen aan item (many-to-many)",
     "template": "-Contact -Id {id} -Email {email} -Env {env}"},
    {"key": "UnlinkContact", "group": "Contact", "label": "-UnlinkContact — contact loskoppelen van item",
     "template": "-UnlinkContact -Id {id} -ContactId {contact_id} -Env {env}"},
    {"key": "ContactNote", "group": "Contact", "label": "-ContactNote — profiel-notitie bijwerken",
     "template": '-ContactNote -Email {email} -Text "..." -Env {env}'},
    {"key": "Respond", "group": "Case-samenwerking", "label": "-Respond — concept-antwoord posten",
     "template": '-Respond -CaseId {id} -Ids "..." -Content "..." -Env {env}'},
    {"key": "AddEvent", "group": "Case-samenwerking", "label": "-AddEvent — sessienotitie/event toevoegen",
     "template": '-AddEvent -CaseId {id} -Text "..." -Env {env}'},
    {"key": "SaveSession", "group": "Sessie", "label": "-SaveSession — sessie opslaan onder naam",
     "template": '-SaveSession -Name "{name}" -Text "..." -Env {env}'},
    {"key": "LoadSession", "group": "Sessie", "label": "-LoadSession — case+bestanden terugzien",
     "template": '-LoadSession -Name "{name}" -Env {env}'},
    {"key": "Setup", "group": "Setup", "label": "-Setup — eenmalige login/API-key",
     "template": "-Setup -Env {env}"},
]

# Matcht bv. "Acc.MindBox.Case.Run(#abc-123)" of "Local.MindBox.Run(all)".
NOTATION_RE = re.compile(
    r"^(?P<env>\w+)\.MindBox\.(?:(?P<entity>[A-Za-z]+)\.)?(?P<action>[A-Za-z]+)\((?:#)?(?P<param>[^)]*)\)$"
)


def _notation_key(entity: Optional[str], action: str) -> str:
    return f"{entity}.{action}" if entity else action


def get_actions() -> list[dict]:
    return ELEMENTARY_ACTIONS


def get_commands(session: Session, user: User) -> list[MindboxCommand]:
    return list(session.exec(
        select(MindboxCommand)
        .where(MindboxCommand.user_id == user.id)
        .order_by(col(MindboxCommand.notation_key))
    ).all())


def get_command(session: Session, user: User, command_id: str) -> MindboxCommand:
    command = session.get(MindboxCommand, command_id)
    if not command:
        raise AppError("Commando niet gevonden", status_code=404)
    if command.user_id != user.id:
        raise AppError("Geen toegang", status_code=403)
    return command


def get_command_by_notation_key(session: Session, user: User, notation_key: str) -> Optional[MindboxCommand]:
    return session.exec(
        select(MindboxCommand).where(
            MindboxCommand.user_id == user.id, MindboxCommand.notation_key == notation_key
        )
    ).first()


def get_steps(session: Session, command_id: str) -> list[MindboxCommandStep]:
    return list(session.exec(
        select(MindboxCommandStep)
        .where(MindboxCommandStep.command_id == command_id)
        .order_by(col(MindboxCommandStep.position))
    ).all())


def _validate_steps(steps: list[dict]) -> None:
    if not steps:
        raise AppError("Geef minimaal 1 stap op", status_code=400)
    for step in steps:
        if step.get("kind") not in ("api_call", "manual"):
            raise AppError("Stap-kind moet api_call of manual zijn", status_code=400)
        if not (step.get("instruction") or "").strip():
            raise AppError("Elke stap heeft een instructie nodig", status_code=400)


def replace_steps(session: Session, user: User, command_id: str, steps: list[dict]) -> list[MindboxCommandStep]:
    get_command(session, user, command_id)  # eigendom-check
    for existing in get_steps(session, command_id):
        session.delete(existing)
    session.commit()
    created = []
    for i, step in enumerate(steps):
        kind = step["kind"]
        row = MindboxCommandStep(
            command_id=command_id,
            position=i,
            kind=kind,
            action_key=step.get("action_key"),
            instruction=step["instruction"],
            cli_hint=step.get("cli_hint") if kind == "api_call" else None,
        )
        session.add(row)
        created.append(row)
    session.commit()
    for row in created:
        session.refresh(row)
    return created


def create_command(
    session: Session, user: User, entity: Optional[str], action: str, param_kind: str,
    notation_template: str, icon: Optional[str], description: Optional[str], steps: list[dict],
) -> MindboxCommand:
    _validate_steps(steps)
    notation_key = _notation_key(entity, action)
    if get_command_by_notation_key(session, user, notation_key):
        raise AppError(f"Commando '{notation_key}' bestaat al", status_code=409)
    command = MindboxCommand(
        user_id=user.id, entity=entity, action=action, notation_key=notation_key,
        param_kind=param_kind, notation_template=notation_template,
        icon=icon or "⚙️", description=description,
    )
    session.add(command)
    session.commit()
    session.refresh(command)
    replace_steps(session, user, command.id, steps)
    session.refresh(command)
    return command


def update_command(
    session: Session, user: User, command_id: str, entity: Optional[str], action: str, param_kind: str,
    notation_template: str, icon: Optional[str], description: Optional[str], steps: list[dict],
) -> MindboxCommand:
    # Item 1053: de editor stuurt altijd de VOLLEDIGE formulierstaat mee (geen
    # los-te-patchen velden zoals bij MindboxCase) - dus hier bewust een volle
    # vervanging i.p.v. partial-update-semantiek.
    command = get_command(session, user, command_id)
    _validate_steps(steps)
    notation_key = _notation_key(entity, action)
    if notation_key != command.notation_key and get_command_by_notation_key(session, user, notation_key):
        raise AppError(f"Commando '{notation_key}' bestaat al", status_code=409)
    command.entity = entity
    command.action = action
    command.notation_key = notation_key
    command.param_kind = param_kind
    command.notation_template = notation_template
    command.icon = icon or "⚙️"
    command.description = description
    command.updated_at = datetime.utcnow()
    session.add(command)
    session.commit()
    replace_steps(session, user, command.id, steps)
    session.refresh(command)
    return command


def delete_command(session: Session, user: User, command_id: str) -> None:
    command = get_command(session, user, command_id)
    for step in get_steps(session, command_id):
        session.delete(step)
    session.delete(command)
    session.commit()


def _render(text: Optional[str], env: str, param: str) -> Optional[str]:
    if text is None:
        return None
    return (
        text.replace("{env}", env)
            .replace("{id}", param)
            .replace("{name}", param)
            .replace("{param}", param)
    )


def resolve_command(session: Session, user: User, notation: str) -> dict:
    match = NOTATION_RE.match(notation.strip())
    if not match:
        raise AppError(
            f"Kan notatie niet parsen: '{notation}'. Verwacht formaat: "
            "env.MindBox.Entity.Actie(#id) of env.MindBox.Actie(...)",
            status_code=400,
        )
    env = match.group("env")
    entity = match.group("entity")
    action = match.group("action")
    param = match.group("param") or ""
    notation_key = _notation_key(entity, action)

    command = get_command_by_notation_key(session, user, notation_key)
    if not command:
        known = ", ".join(c.notation_key for c in get_commands(session, user)) or "(nog geen commando's)"
        raise AppError(f"Onbekend commando '{notation_key}'. Bekende commando's: {known}", status_code=404)

    steps = get_steps(session, command.id)
    return {
        "notation": notation,
        "command": {
            "id": command.id,
            "notation_key": command.notation_key,
            "icon": command.icon,
            "description": command.description,
        },
        "param_kind": command.param_kind,
        "steps": [
            {
                "position": s.position,
                "kind": s.kind,
                "instruction": _render(s.instruction, env, param),
                "cli_hint": _render(s.cli_hint, env, param),
            }
            for s in steps
        ],
    }
