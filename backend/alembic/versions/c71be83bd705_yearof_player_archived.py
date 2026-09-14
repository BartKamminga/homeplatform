"""yearof player archived_at (archiveren i.p.v. verwijderen)

Revision ID: c71be83bd705
Revises: 99863b7a641a
Create Date: 2026-09-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "c71be83bd705"
down_revision = "99863b7a641a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c["name"] for c in inspector.get_columns("yearof_players")}
    if "archived_at" not in existing_cols:
        op.add_column("yearof_players", sa.Column("archived_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("yearof_players", "archived_at")
