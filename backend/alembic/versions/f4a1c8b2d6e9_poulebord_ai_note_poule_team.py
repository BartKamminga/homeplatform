"""poulebord: ai_note ook op poule- en teamniveau (naast competitie) - item 957

Revision ID: f4a1c8b2d6e9
Revises: adf7f4ad885c
Create Date: 2026-08-26
"""
import sqlalchemy as sa
from alembic import op

revision = "f4a1c8b2d6e9"
down_revision = "adf7f4ad885c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("hockey_poules") as batch:
        batch.add_column(sa.Column("ai_note", sa.Text(), nullable=True))
    with op.batch_alter_table("hockey_poule_standings") as batch:
        batch.add_column(sa.Column("ai_note", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("hockey_poule_standings") as batch:
        batch.drop_column("ai_note")
    with op.batch_alter_table("hockey_poules") as batch:
        batch.drop_column("ai_note")
