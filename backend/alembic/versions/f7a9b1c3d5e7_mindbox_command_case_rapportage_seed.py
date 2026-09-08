"""mindbox_commands seed: Case.Rapportage (item 1125) - Bart, 8-9-2026: "ik
wil met case precies zo'n output kunnen opvragen" (naar aanleiding van de 2
handmatige dossier-rapportages van vandaag). On-demand, chronologische
dossier-HTML per case, opgeslagen IN de case (herschrijfbaar i.p.v.
dupliceren - zie item 1125/TEXT_EXTENSIONS-uitbreiding met .html), met een
Kalender-item als geschiedenis-marker.

Revision ID: f7a9b1c3d5e7
Revises: e6f8a0b2c4d6
Create Date: 2026-09-08
"""
import uuid
from datetime import datetime

import sqlalchemy as sa
from alembic import op

revision = "f7a9b1c3d5e7"
down_revision = "e6f8a0b2c4d6"
branch_labels = None
depends_on = None

COMMAND = {
    "entity": "Case", "action": "Rapportage", "param_kind": "id",
    "notation_template": "{env}.MindBox.Case.Rapportage(#{param})", "icon": "\U0001F4CB",
    "description": "Chronologische dossier-rapportage (HTML) van deze case opstellen of bijwerken",
    "steps": [
        {"kind": "api_call", "action_key": "RunAll",
         "instruction": "Alle items van deze case downloaden, inclusief briefing.md per bestand",
         "cli_hint": "-Run -All -CaseId {id} -Env {env}"},
        {"kind": "manual", "action_key": None,
         "instruction": "Controleren of er al een 'status-rapportage.html'-item in deze case bestaat "
                         "(-List -CaseId {id}); zo ja, de vorige inhoud en updated_at als uitgangspunt "
                         "gebruiken (alleen de ontwikkelingen sinds die datum hoeven toegevoegd te worden).",
         "cli_hint": None},
        {"kind": "manual", "action_key": None,
         "instruction": "Chronologische dossier-rapportage opstellen/bijwerken: per dossier/deelonderwerp "
                         "binnen de case een tijdlijn-narratief (wat gebeurde wanneer, wie was betrokken, "
                         "welke besluiten vielen, huidige status). Zelfstandig HTML-bestand, inline CSS, "
                         "professionele/verzorgde stijl - zelfde kwaliteitsniveau als de referentie-"
                         "voorbeelden in mindbox_work/dossier-rapportage-*.html.",
         "cli_hint": None},
        {"kind": "manual", "action_key": None,
         "instruction": "Rapportage wegschrijven onder de vaste naam 'status-rapportage.html': bestaat het "
                         "item nog niet, dan uploaden (-Upload); bestaat het al, dan de inhoud bijwerken "
                         "(-UpdateContent) in plaats van een nieuwe kopie te maken - moet 'overzichtelijk' "
                         "blijven (Bart), dus altijd precies 1 actuele rapportage per case.",
         "cli_hint": None},
        {"kind": "api_call", "action_key": "AddDeadline",
         "instruction": "Kalender-item toevoegen als geschiedenis-marker van deze update, gekoppeld aan de case",
         "cli_hint": '-AddDeadline -Date <vandaag> -Title "Rapportage bijgewerkt: <case-naam>" -CaseId {id} -Env {env}'},
        {"kind": "manual", "action_key": None,
         "instruction": "Afsluiten met gerichte vragen aan Bart over onduidelijke of onvolledige "
                         "deelgebieden die uit de mail alleen niet te reconstrueren waren.",
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

    notation_key = f"{COMMAND['entity']}.{COMMAND['action']}"
    existing = bind.execute(
        sa.text("SELECT id FROM mindbox_commands WHERE notation_key = :notation_key"),
        {"notation_key": notation_key},
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
        "(SELECT id FROM mindbox_commands WHERE notation_key = 'Case.Rapportage')"
    )
    op.execute("DELETE FROM mindbox_commands WHERE notation_key = 'Case.Rapportage'")
