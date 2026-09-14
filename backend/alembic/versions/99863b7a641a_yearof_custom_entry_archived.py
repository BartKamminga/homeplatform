"""yearof custom entry archived_at (archiveren i.p.v. verwijderen)

Revision ID: 99863b7a641a
Revises: f74cbd7e781e
Create Date: 2026-09-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "99863b7a641a"
down_revision = "f74cbd7e781e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = {c["name"] for c in inspector.get_columns("yearof_custom_entries")}
    if "archived_at" not in existing_cols:
        op.add_column("yearof_custom_entries", sa.Column("archived_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("yearof_custom_entries", "archived_at")
