"""mindbox_commands seed: Case.GenerateTextPreviews (item 1058, vervolg) -
hele case downloaden (context+kennis+contacten+bestanden+tijdlijn), en voor
elk bestand zonder parsed_text een losse tekstpreview genereren, geupload
en gelinkt aan de bron met linktype text_preview.

Revision ID: c9d0e1f2a3b4
Revises: b7c8d9e0f1a2
Create Date: 2026-09-03
"""
import uuid
from datetime import datetime

import sqlalchemy as sa
from alembic import op

revision = "c9d0e1f2a3b4"
down_revision = "b7c8d9e0f1a2"
branch_labels = None
depends_on = None

COMMAND = {
    "entity": "Case", "action": "GenerateTextPreviews", "param_kind": "id",
    "notation_template": "{env}.MindBox.Case.GenerateTextPreviews(#{param})", "icon": "\U0001F50D",
    "description": "Hele case downloaden en voor bestanden zonder tekstpreview er een genereren en linken aan de bron",
    "steps": [
        {"kind": "api_call", "action_key": "ExportCase",
         "instruction": "Hele case downloaden (context, kennis, contacten, bestandenlijst, tijdlijn)",
         "cli_hint": "-ExportCase -CaseId {id} -Env {env}"},
        {"kind": "manual", "action_key": None,
         "instruction": "Voor elk bestand zonder parsed_text bepalen of het tekstueel te herleiden is "
                         "(mail/pdf/document, geen puur beeldmateriaal); zo ja, leesbare previewtekst "
                         "extraheren/genereren als los .txt-bestand",
         "cli_hint": None},
        {"kind": "api_call", "action_key": "Upload",
         "instruction": "Elke gegenereerde preview uploaden en linken aan het bronbestand, herhalen per bestand",
         "cli_hint": "-Upload -CaseId {id} -FilePath <pad> -TargetId <bron_item_id> -LinkType text_preview -Env {env}"},
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
        "(SELECT id FROM mindbox_commands WHERE notation_key = 'Case.GenerateTextPreviews')"
    )
    op.execute("DELETE FROM mindbox_commands WHERE notation_key = 'Case.GenerateTextPreviews'")
