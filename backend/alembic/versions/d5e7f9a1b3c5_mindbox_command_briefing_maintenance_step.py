"""mindbox_commands update: Briefing (item 1115/1117, vervolg) - Bart, 8-9-2026:
"zorg ervoor dat op prod altijd gekeken word naar het verrijken van kennis,
het opbouwen/bijhouden van de kalender en contexten en contacten... dat moet
altijd geschieden". Voegt een 5e stap toe die dit ACTIEF (geen voorstel, in
tegenstelling tot de case-/antwoord-voorstellen in stap 2) laat uitvoeren bij
elke Briefing-run.

Revision ID: d5e7f9a1b3c5
Revises: c4d6e8f0a2b4
Create Date: 2026-09-08
"""
import uuid

from alembic import op
import sqlalchemy as sa

revision = "d5e7f9a1b3c5"
down_revision = "c4d6e8f0a2b4"
branch_labels = None
depends_on = None

NOTATION_KEY = "Briefing"

MAINTENANCE_STEP = {
    "kind": "manual", "action_key": None,
    "instruction": "Doorlopend bijhouden (niet optioneel, ALTIJD doen - geen voorstel nodig, in "
                   "tegenstelling tot de case-/antwoord-voorstellen in stap 2): nieuwe achtergrond-/"
                   "organisatie-info toevoegen aan Kennis (-UpdateKnowledge) zodra die naar voren komt, "
                   "nieuwe/gewijzigde belangrijke datums vastleggen in de Kalender (-AddDeadline), "
                   "personen die herhaaldelijk voorkomen vastleggen als Contact met rolnotitie "
                   "(-Contact/-ContactNote), en terugkerende cases (bv. vaste overlegstructuren) "
                   "voorzien van een Context die het patroon beschrijft.",
    "cli_hint": None,
}


def _sql_str(value):
    return "'" + value.replace("'", "''") + "'" if value is not None else "NULL"


def upgrade() -> None:
    bind = op.get_bind()
    row = bind.execute(
        sa.text("SELECT id FROM mindbox_commands WHERE notation_key = :k"), {"k": NOTATION_KEY},
    ).fetchone()
    if not row:
        return  # commando (nog) niet aanwezig - niets bij te werken
    command_id = row[0]
    existing_positions = bind.execute(
        sa.text("SELECT MAX(position) FROM mindbox_command_steps WHERE command_id = :c"), {"c": command_id},
    ).fetchone()
    next_position = (existing_positions[0] or 0) + 1
    step_id = str(uuid.uuid4())
    op.execute(
        "INSERT INTO mindbox_command_steps "
        "(id, command_id, position, kind, action_key, instruction, cli_hint) VALUES ("
        f"{_sql_str(step_id)}, {_sql_str(command_id)}, {next_position}, {_sql_str(MAINTENANCE_STEP['kind'])}, "
        f"{_sql_str(MAINTENANCE_STEP['action_key'])}, {_sql_str(MAINTENANCE_STEP['instruction'])}, "
        f"{_sql_str(MAINTENANCE_STEP['cli_hint'])})"
    )


def downgrade() -> None:
    bind = op.get_bind()
    row = bind.execute(
        sa.text("SELECT id FROM mindbox_commands WHERE notation_key = :k"), {"k": NOTATION_KEY},
    ).fetchone()
    if not row:
        return
    command_id = row[0]
    op.execute(
        "DELETE FROM mindbox_command_steps WHERE command_id = "
        f"{_sql_str(command_id)} AND instruction = {_sql_str(MAINTENANCE_STEP['instruction'])}"
    )
