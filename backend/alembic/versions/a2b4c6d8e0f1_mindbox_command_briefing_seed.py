"""mindbox_commands seed: Briefing (item 1115) - globaal commando dat alle
openstaande items downloadt en de agent instrueert er een gestructureerde
ochtendbriefing van te maken (agenda/taken/mail/aandachtspunten), geinspireerd
op het losse ochtendpost-project maar zonder eigen LLM-aanroep - past in
MindBox' bestaande architectuur (item 1050: verwerking door Bart+Claude Code
samen in een sessie, geen server-side API-call).

Revision ID: a2b4c6d8e0f1
Revises: 68f469c7ffc7
Create Date: 2026-09-08
"""
import uuid
from datetime import datetime

import sqlalchemy as sa
from alembic import op

revision = "a2b4c6d8e0f1"
down_revision = "68f469c7ffc7"
branch_labels = None
depends_on = None

COMMAND = {
    "entity": None, "action": "Briefing", "param_kind": "none",
    "notation_template": "{env}.MindBox.Briefing()", "icon": "\U0001F305",
    "description": "Ochtendbriefing genereren uit alle openstaande items, over alle cases heen",
    "steps": [
        {"kind": "api_call", "action_key": "RunAll",
         "instruction": "Download alle openstaande items en briefing.md",
         "cli_hint": "-Run -All -Env {env}"},
        {"kind": "manual", "action_key": None,
         "instruction": "Op basis van de gedownloade items een beknopte ochtendbriefing opstellen met "
                         "vaste structuur: 1) Agenda vandaag (chronologisch, tijd/naam/context), "
                         "2) Taken & deadlines (gesorteerd op urgentie), 3) Mail/berichten die aandacht "
                         "vragen (alleen items met actie/beslissing), 4) Aandachtspunten (conflicten, "
                         "ontbrekende info). Beknopt en actiegericht, geen details verzinnen die niet "
                         "zijn aangeleverd.",
         "cli_hint": None},
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

    notation_key = COMMAND["action"]
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
        "(SELECT id FROM mindbox_commands WHERE notation_key = 'Briefing')"
    )
    op.execute("DELETE FROM mindbox_commands WHERE notation_key = 'Briefing'")
