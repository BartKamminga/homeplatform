"""mindbox_commands seed: de 8 bestaande gedocumenteerde commando's (item
1053) - zet MindBox.ps1's oude, hand-onderhouden commentaarblok om in echte
catalogus-rijen zodat -Explain ze meteen kan herleiden.

Revision ID: 9c3e7b1a4f6d
Revises: 2fa1c9b4d7e3
Create Date: 2026-09-02
"""
import uuid
from datetime import datetime

import sqlalchemy as sa
from alembic import op

revision = "9c3e7b1a4f6d"
down_revision = "2fa1c9b4d7e3"
branch_labels = None
depends_on = None

COMMANDS = [
    {
        "entity": None, "action": "Run", "param_kind": "none",
        "notation_template": "{env}.MindBox.Run(all)", "icon": "▶️",
        "description": "Alle nog niet afgeronde items ophalen, over alle cases heen",
        "steps": [
            {"kind": "api_call", "action_key": "RunAll",
             "instruction": "Download alle openstaande items en briefing.md",
             "cli_hint": "-Run -All -Env {env}"},
        ],
    },
    {
        "entity": "Case", "action": "Run", "param_kind": "id",
        "notation_template": "{env}.MindBox.Case.Run(#{param})", "icon": "\U0001F4C1",
        "description": "Alle items van deze case downloaden, inclusief briefing",
        "steps": [
            {"kind": "api_call", "action_key": "RunAll",
             "instruction": "Download items van deze case en briefing.md",
             "cli_hint": "-Run -All -CaseId {id} -Env {env}"},
        ],
    },
    {
        "entity": "File", "action": "Enhance", "param_kind": "id",
        "notation_template": "{env}.MindBox.File.Enhance(#{param})", "icon": "✎",
        "description": "Bestand bekijken en notities aanvullen",
        "steps": [
            {"kind": "api_call", "action_key": "Run",
             "instruction": "Bestand en briefing bekijken", "cli_hint": "-Run -Id {id} -Env {env}"},
            {"kind": "manual", "action_key": None,
             "instruction": "Aanvullende notities opstellen op basis van bestand en briefing",
             "cli_hint": None},
            {"kind": "api_call", "action_key": "Note",
             "instruction": "Notities opslaan", "cli_hint": '-Note -Id {id} -Text "..." -Env {env}'},
        ],
    },
    {
        "entity": "File", "action": "ParseToTekst", "param_kind": "id",
        "notation_template": "{env}.MindBox.File.ParseToTekst(#{param})", "icon": "\U0001F4C4",
        "description": "Platte tekst van het bestand extraheren en opslaan",
        "steps": [
            {"kind": "api_call", "action_key": "Run",
             "instruction": "Bestand bekijken", "cli_hint": "-Run -Id {id} -Env {env}"},
            {"kind": "manual", "action_key": None,
             "instruction": "Platte tekst extraheren uit het bestand", "cli_hint": None},
            {"kind": "api_call", "action_key": "ParsedText",
             "instruction": "Tekst opslaan", "cli_hint": '-ParsedText -Id {id} -Text "..." -Env {env}'},
        ],
    },
    {
        "entity": "File", "action": "ExtractAttachments", "param_kind": "id",
        "notation_template": "{env}.MindBox.File.ExtractAttachments(#{param})", "icon": "\U0001F4CE",
        "description": "Bijlagen uit een mail extraheren en als losse items opslaan",
        "steps": [
            {"kind": "api_call", "action_key": "Run",
             "instruction": "Bestand downloaden", "cli_hint": "-Run -Id {id} -Env {env}"},
            {"kind": "manual", "action_key": None,
             "instruction": "Lokaal extract-msg gebruiken om bijlagen te extraheren", "cli_hint": None},
            {"kind": "api_call", "action_key": "UploadAttachment",
             "instruction": "Elke bijlage uploaden, herhalen per bijlage",
             "cli_hint": "-UploadAttachment -ParentId {id} -FilePath <pad> -Env {env}"},
        ],
    },
    {
        "entity": "Case", "action": "Save", "param_kind": "name",
        "notation_template": "{env}.MindBox.Case.Save({param})", "icon": "\U0001F4BE",
        "description": "Sessie samenvatten en opslaan onder de case-naam",
        "steps": [
            {"kind": "manual", "action_key": None,
             "instruction": "Huidige sessie samenvatten", "cli_hint": None},
            {"kind": "api_call", "action_key": "SaveSession",
             "instruction": "Samenvatting opslaan als sessienotitie",
             "cli_hint": '-SaveSession -Name "{name}" -Text "..." -Env {env}'},
        ],
    },
    {
        "entity": "Case", "action": "Load", "param_kind": "name",
        "notation_template": "{env}.MindBox.Case.Load({param})", "icon": "\U0001F4C2",
        "description": "Case met bestanden, responses en sessienotities terugzien",
        "steps": [
            {"kind": "api_call", "action_key": "LoadSession",
             "instruction": "Case opzoeken op naam en volledig terugzien",
             "cli_hint": '-LoadSession -Name "{name}" -Env {env}'},
        ],
    },
    {
        "entity": "Case", "action": "ScanContacts", "param_kind": "id",
        "notation_template": "{env}.MindBox.Case.ScanContacts(#{param})", "icon": "\U0001F465",
        "description": "Deelnemers uit alle mails in de case herkennen en koppelen als contact",
        "steps": [
            {"kind": "api_call", "action_key": "RunAll",
             "instruction": "Alle bestanden van deze case downloaden",
             "cli_hint": "-Run -All -CaseId {id} -Env {env}"},
            {"kind": "manual", "action_key": None,
             "instruction": "Sender/to/cc extraheren uit elk bestand (bv. Python extract-msg), gevonden "
                             "e-mailadressen binnen de sessie matchen en bevestigen, niet blind koppelen",
             "cli_hint": None},
            {"kind": "api_call", "action_key": "Contact",
             "instruction": "Per bevestigde deelnemer koppelen, herhalen per item en per deelnemer",
             "cli_hint": '-Contact -Id <item_id> -Email <email> -Name "..." -Env {env}'},
        ],
    },
]


def _sql_str(value):
    return "'" + value.replace("'", "''") + "'" if value is not None else "NULL"


def upgrade() -> None:
    bind = op.get_bind()
    user_row = bind.execute(sa.text("SELECT id FROM users ORDER BY created_at LIMIT 1")).fetchone()
    if not user_row:
        return  # lege (dev-)database zonder user - niets te seeden
    user_id = user_row[0]
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    for cmd in COMMANDS:
        notation_key = f"{cmd['entity']}.{cmd['action']}" if cmd["entity"] else cmd["action"]
        existing = bind.execute(
            sa.text(
                "SELECT id FROM mindbox_commands WHERE user_id = :user_id AND notation_key = :notation_key"
            ),
            {"user_id": user_id, "notation_key": notation_key},
        ).fetchone()
        if existing:
            continue  # al aangemaakt (bv. door een eerdere run of handmatig via de website)

        command_id = str(uuid.uuid4())
        op.execute(
            "INSERT INTO mindbox_commands "
            "(id, user_id, entity, action, notation_key, param_kind, notation_template, icon, "
            "description, created_at, updated_at) VALUES ("
            f"{_sql_str(command_id)}, {_sql_str(user_id)}, {_sql_str(cmd['entity'])}, "
            f"{_sql_str(cmd['action'])}, {_sql_str(notation_key)}, {_sql_str(cmd['param_kind'])}, "
            f"{_sql_str(cmd['notation_template'])}, {_sql_str(cmd['icon'])}, "
            f"{_sql_str(cmd['description'])}, {_sql_str(now)}, {_sql_str(now)})"
        )
        for position, step in enumerate(cmd["steps"]):
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
        "(SELECT id FROM mindbox_commands WHERE notation_key IN "
        "('Run', 'Case.Run', 'File.Enhance', 'File.ParseToTekst', "
        "'File.ExtractAttachments', 'Case.Save', 'Case.Load', 'Case.ScanContacts'))"
    )
    op.execute(
        "DELETE FROM mindbox_commands WHERE notation_key IN "
        "('Run', 'Case.Run', 'File.Enhance', 'File.ParseToTekst', "
        "'File.ExtractAttachments', 'Case.Save', 'Case.Load', 'Case.ScanContacts')"
    )
