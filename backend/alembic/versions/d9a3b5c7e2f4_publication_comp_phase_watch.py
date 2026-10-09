"""volglijst wacht op nieuwe fase / zaal-indeling op competitie-koppelingen

Revision ID: d9a3b5c7e2f4
Revises: c8f2a4d6e1b3
Create Date: 2026-10-09

Item 1254: drie kolommen op hockey_publication_comps. Met has-column-check,
omdat create_all in de deploy-pipeline voor de migratie draait.
"""
from alembic import op
import sqlalchemy as sa

revision = "d9a3b5c7e2f4"
down_revision = "c8f2a4d6e1b3"
branch_labels = None
depends_on = None

COLUMNS = [
    sa.Column("watch_next_phase_since", sa.DateTime(), nullable=True),
    sa.Column("watch_zaal_since", sa.DateTime(), nullable=True),
    sa.Column("watch_notified", sa.Integer(), nullable=False, server_default="0"),
]


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "hockey_publication_comps" not in inspector.get_table_names():
        return
    existing = {c["name"] for c in inspector.get_columns("hockey_publication_comps")}
    for column in COLUMNS:
        if column.name not in existing:
            op.add_column("hockey_publication_comps", column.copy())


def downgrade():
    pass
