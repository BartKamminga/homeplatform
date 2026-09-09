"""mindbox_command_steps: Case.Rapportage altijd als nieuw gedateerd bestand
(niet meer overschrijven) - Bart, 9-9-2026: "altijd een nieuwe aanmaken met de
juiste datum" i.p.v. de vaste naam 'status-rapportage.html' bijwerken (zoals
item 1125/f7a9b1c3d5e7 origineel deed). Zo blijft de geschiedenis van eerdere
rapportages behouden i.p.v. dat de vorige versie verdwijnt.

Revision ID: b7d9e1f3a5c7
Revises: e2a4c6f8b0d2
Create Date: 2026-09-09
"""
import sqlalchemy as sa
from alembic import op

revision = "b7d9e1f3a5c7"
down_revision = "e2a4c6f8b0d2"
branch_labels = None
depends_on = None

NOTATION_KEY = "Case.Rapportage"

OLD_CHECK_INSTRUCTION = (
    "Controleren of er al een 'status-rapportage.html'-item in deze case bestaat "
    "(-List -CaseId {id}); zo ja, de vorige inhoud en updated_at als uitgangspunt "
    "gebruiken (alleen de ontwikkelingen sinds die datum hoeven toegevoegd te worden)."
)
NEW_CHECK_INSTRUCTION = (
    "Controleren of er al eerdere rapportages in deze case bestaan (-List -CaseId {id}, "
    "zoek naar 'status-rapportage-*.html'); zo ja, de meest recente inhoud en datum als "
    "uitgangspunt gebruiken (alleen de ontwikkelingen sinds die datum hoeven toegevoegd te "
    "worden) - maar de vorige versie blijft ongewijzigd staan."
)

OLD_WRITE_INSTRUCTION = (
    "Rapportage wegschrijven onder de vaste naam 'status-rapportage.html': bestaat het "
    "item nog niet, dan uploaden (-Upload); bestaat het al, dan de inhoud bijwerken "
    "(-UpdateContent) in plaats van een nieuwe kopie te maken - moet 'overzichtelijk' "
    "blijven (Bart), dus altijd precies 1 actuele rapportage per case."
)
NEW_WRITE_INSTRUCTION = (
    "Rapportage altijd wegschrijven als NIEUW bestand met de datum van vandaag in de naam: "
    "'status-rapportage-<YYYY-MM-DD>.html' (dus altijd -Upload, nooit -UpdateContent op een "
    "bestaand rapportage-item) - zo blijft de geschiedenis van eerdere rapportages behouden "
    "i.p.v. dat de vorige versie overschreven wordt."
)


def _sql_str(value):
    return "'" + value.replace("'", "''") + "'" if value is not None else "NULL"


def upgrade() -> None:
    bind = op.get_bind()
    command_row = bind.execute(
        sa.text("SELECT id FROM mindbox_commands WHERE notation_key = :k"),
        {"k": NOTATION_KEY},
    ).fetchone()
    if not command_row:
        return  # command (nog) niet geseed - niets bij te werken
    command_id = command_row[0]

    op.execute(
        f"UPDATE mindbox_command_steps SET instruction = {_sql_str(NEW_CHECK_INSTRUCTION)} "
        f"WHERE command_id = {_sql_str(command_id)} AND instruction = {_sql_str(OLD_CHECK_INSTRUCTION)}"
    )
    op.execute(
        f"UPDATE mindbox_command_steps SET instruction = {_sql_str(NEW_WRITE_INSTRUCTION)} "
        f"WHERE command_id = {_sql_str(command_id)} AND instruction = {_sql_str(OLD_WRITE_INSTRUCTION)}"
    )


def downgrade() -> None:
    bind = op.get_bind()
    command_row = bind.execute(
        sa.text("SELECT id FROM mindbox_commands WHERE notation_key = :k"),
        {"k": NOTATION_KEY},
    ).fetchone()
    if not command_row:
        return
    command_id = command_row[0]

    op.execute(
        f"UPDATE mindbox_command_steps SET instruction = {_sql_str(OLD_CHECK_INSTRUCTION)} "
        f"WHERE command_id = {_sql_str(command_id)} AND instruction = {_sql_str(NEW_CHECK_INSTRUCTION)}"
    )
    op.execute(
        f"UPDATE mindbox_command_steps SET instruction = {_sql_str(OLD_WRITE_INSTRUCTION)} "
        f"WHERE command_id = {_sql_str(command_id)} AND instruction = {_sql_str(NEW_WRITE_INSTRUCTION)}"
    )
