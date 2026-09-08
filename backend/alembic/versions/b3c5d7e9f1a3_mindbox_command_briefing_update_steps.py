"""mindbox_commands update: Briefing (item 1115, vervolg) - 2 uitbreidingen op
verzoek van Bart na de eerste live-test op acc: (1) synthese-instructie vraagt
nu ook om, per item dat opvolging nodig heeft, een VOORSTEL (geen automatische
actie) voor een nieuwe case en/of een concept-antwoord, (2) de briefing wordt
niet meer alleen getoond maar ook weggeschreven als gedateerd bestand in een
doorlopende case "Ochtendbriefingen" - zodat er een historie ontstaat, net
als bij Case.GenerateTextPreviews (c9d0e1f2a3b4) al voor previews gebeurt.

Revision ID: b3c5d7e9f1a3
Revises: a2b4c6d8e0f1
Create Date: 2026-09-08
"""
import uuid

from alembic import op
import sqlalchemy as sa

revision = "b3c5d7e9f1a3"
down_revision = "a2b4c6d8e0f1"
branch_labels = None
depends_on = None

NOTATION_KEY = "Briefing"

NEW_STEPS = [
    {"kind": "api_call", "action_key": "RunAll",
     "instruction": "Download alle openstaande items en briefing.md",
     "cli_hint": "-Run -All -Env {env}"},
    {"kind": "manual", "action_key": None,
     "instruction": "Op basis van de gedownloade items een beknopte ochtendbriefing opstellen met "
                     "vaste structuur: 1) Agenda vandaag (chronologisch, tijd/naam/context), "
                     "2) Taken & deadlines (gesorteerd op urgentie), 3) Mail/berichten die aandacht "
                     "vragen (alleen items met actie/beslissing), 4) Aandachtspunten (conflicten, "
                     "ontbrekende info, en per item dat opvolging nodig heeft: een VOORSTEL of er een "
                     "nieuwe case en/of een concept-antwoord bij past - zelf geen case aanmaken of "
                     "antwoord versturen, alleen voorstellen). Beknopt en actiegericht, geen details "
                     "verzinnen die niet zijn aangeleverd.",
     "cli_hint": None},
    {"kind": "manual", "action_key": None,
     "instruction": "Case 'Ochtendbriefingen' opzoeken (-ListCases); bestaat die nog niet, dan aanmaken "
                     "(-CreateCase -Name \"Ochtendbriefingen\")",
     "cli_hint": None},
    {"kind": "api_call", "action_key": "Upload",
     "instruction": "Briefing als gedateerd .md-bestand (bv. briefing-2026-09-08.md) wegschrijven en "
                     "uploaden in de case 'Ochtendbriefingen'",
     "cli_hint": "-Upload -CaseId <ochtendbriefingen_case_id> -FilePath <pad> -Env {env}"},
]

OLD_STEPS = [
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
]


def _sql_str(value):
    return "'" + value.replace("'", "''") + "'" if value is not None else "NULL"


def _replace_steps(bind, steps):
    row = bind.execute(
        sa.text("SELECT id FROM mindbox_commands WHERE notation_key = :k"),
        {"k": NOTATION_KEY},
    ).fetchone()
    if not row:
        return  # commando (nog) niet aanwezig - niets bij te werken
    command_id = row[0]
    op.execute(f"DELETE FROM mindbox_command_steps WHERE command_id = {_sql_str(command_id)}")
    for position, step in enumerate(steps):
        step_id = str(uuid.uuid4())
        op.execute(
            "INSERT INTO mindbox_command_steps "
            "(id, command_id, position, kind, action_key, instruction, cli_hint) VALUES ("
            f"{_sql_str(step_id)}, {_sql_str(command_id)}, {position}, {_sql_str(step['kind'])}, "
            f"{_sql_str(step['action_key'])}, {_sql_str(step['instruction'])}, "
            f"{_sql_str(step['cli_hint'])})"
        )


def upgrade() -> None:
    bind = op.get_bind()
    _replace_steps(bind, NEW_STEPS)


def downgrade() -> None:
    bind = op.get_bind()
    _replace_steps(bind, OLD_STEPS)
