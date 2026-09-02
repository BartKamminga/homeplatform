"""mindbox_commands seed: Case.CreateFromDisk (item 1053) - case vullen
vanaf een lokale map (mindbox_work/<naam>/), bouwt voort op de nieuwe
elementaire -Upload-actie (rechtstreeks een bestand in een case, geen
bijlage van een bestaand item zoals -UploadAttachment).

Revision ID: 5b8d2a9f1c3e
Revises: b3d8f4a91c02
Create Date: 2026-09-02
"""
import uuid
from datetime import datetime

import sqlalchemy as sa
from alembic import op

revision = "5b8d2a9f1c3e"
down_revision = "b3d8f4a91c02"
branch_labels = None
depends_on = None

COMMAND = {
    "entity": "Case", "action": "CreateFromDisk", "param_kind": "name",
    "notation_template": "{env}.MindBox.Case.CreateFromDisk({param})", "icon": "\U0001F5C2️",
    "description": "Case aanmaken/aanvullen met alle bestanden uit mindbox_work/<naam>/",
    "steps": [
        {"kind": "api_call", "action_key": "SaveSession",
         "instruction": "Case opzoeken of aanmaken op naam",
         "cli_hint": '-SaveSession -Name "{name}" -Text "Case aangemaakt vanaf lokale map" -Env {env}'},
        {"kind": "manual", "action_key": None,
         "instruction": "Bestanden in mindbox_work\\{name}\\ oplijsten en het case-id uit de vorige stap noteren",
         "cli_hint": None},
        {"kind": "api_call", "action_key": "Upload",
         "instruction": "Elk bestand uploaden naar de case, herhalen per bestand",
         "cli_hint": "-Upload -CaseId <case_id> -FilePath <pad> -Env {env}"},
    ],
}


def _sql_str(value):
    return "'" + value.replace("'", "''") + "'" if value is not None else "NULL"


def upgrade() -> None:
    bind = op.get_bind()
    user_row = bind.execute(sa.text("SELECT id FROM users ORDER BY created_at LIMIT 1")).fetchone()
    if not user_row:
        return  # lege (dev-)database zonder user - niets te seeden
    user_id = user_row[0]
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    notation_key = f"{COMMAND['entity']}.{COMMAND['action']}"
    existing = bind.execute(
        sa.text("SELECT id FROM mindbox_commands WHERE user_id = :user_id AND notation_key = :notation_key"),
        {"user_id": user_id, "notation_key": notation_key},
    ).fetchone()
    if existing:
        return  # al aangemaakt (bv. handmatig via de website of -DefineCommand)

    command_id = str(uuid.uuid4())
    op.execute(
        "INSERT INTO mindbox_commands "
        "(id, user_id, entity, action, notation_key, param_kind, notation_template, icon, "
        "description, created_at, updated_at) VALUES ("
        f"{_sql_str(command_id)}, {_sql_str(user_id)}, {_sql_str(COMMAND['entity'])}, "
        f"{_sql_str(COMMAND['action'])}, {_sql_str(notation_key)}, {_sql_str(COMMAND['param_kind'])}, "
        f"{_sql_str(COMMAND['notation_template'])}, {_sql_str(COMMAND['icon'])}, "
        f"{_sql_str(COMMAND['description'])}, {_sql_str(now)}, {_sql_str(now)})"
    )
    for position, step in enumerate(COMMAND["steps"]):
        step_id = str(uuid.uuid4())
        op.execute(
            "INSERT INTO mindbox_command_steps "
            "(id, command_id, position, kind, action_key, instruction, cli_hint) VALUES ("
            f"{_sql_str(step_id)}, {_sql_str(command_id)}, {position}, {_sql_str(step['kind'])}, "
            f"{_sql_str(step['action_key'])}, {_sql_str(step['instruction'])}, "
            f"{_sql_str(step['cli_hint'])})"
        )


def downgrade() -> None:
    op.execute(
        "DELETE FROM mindbox_command_steps WHERE command_id IN "
        "(SELECT id FROM mindbox_commands WHERE notation_key = 'Case.CreateFromDisk')"
    )
    op.execute("DELETE FROM mindbox_commands WHERE notation_key = 'Case.CreateFromDisk'")
