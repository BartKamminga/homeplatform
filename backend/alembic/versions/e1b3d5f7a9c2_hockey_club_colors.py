"""clubkleur op hockey_clubs (automatisch uit het logo + handmatige correctie)

Revision ID: e1b3d5f7a9c2
Revises: d9a3b5c7e2f4
Create Date: 2026-10-09

Wedstrijdkop yearof-mo14: primary_color wordt 1x uit het clublogo bepaald,
primary_color_manual overschrijft. Met has-column-check, omdat create_all in de
deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "e1b3d5f7a9c2"
down_revision = "d9a3b5c7e2f4"
branch_labels = None
depends_on = None

COLUMNS = [
    sa.Column("primary_color", sa.String(), nullable=True),
    sa.Column("primary_color_manual", sa.String(), nullable=True),
]


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "hockey_clubs" not in inspector.get_table_names():
        return
    existing = {c["name"] for c in inspector.get_columns("hockey_clubs")}
    for column in COLUMNS:
        if column.name not in existing:
            op.add_column("hockey_clubs", column.copy())


def downgrade():
    pass
