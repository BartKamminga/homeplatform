"""yearof player parents/buddy/coaches

Revision ID: d2e4f6a8b0c1
Revises: c8e0a2b4d6f8
Create Date: 2026-10-06

Item 1185: drie vrije-tekstvelden op de spelerspagina, alleen door
beheerders in te vullen (niet via de profiellink).
"""
from alembic import op
import sqlalchemy as sa

revision = "d2e4f6a8b0c1"
down_revision = "c8e0a2b4d6f8"
branch_labels = None
depends_on = None

NEW_COLUMNS = ("parents", "buddy", "coaches")


def upgrade():
    bind = op.get_bind()
    columns = {c["name"] for c in sa.inspect(bind).get_columns("yearof_players")}
    # create_all draait in de deploy-pipeline voor deze migratie en kan de
    # kolommen dan al aangemaakt hebben.
    for name in NEW_COLUMNS:
        if name not in columns:
            op.add_column("yearof_players", sa.Column(name, sa.String(), nullable=True))


def downgrade():
    with op.batch_alter_table("yearof_players") as batch_op:
        for name in NEW_COLUMNS:
            batch_op.drop_column(name)
