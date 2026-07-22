"""match location fields + comp cmd types

Revision ID: gg3hh4ii5jj6
Revises: ff2gg3hh4ii5
Create Date: 2026-07-22
"""
import sqlalchemy as sa
from alembic import op

revision = "gg3hh4ii5jj6"
down_revision = "ff2gg3hh4ii5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    cols = {r[1] for r in bind.execute(sa.text("PRAGMA table_info(hockey_poule_matches)")).fetchall()}
    with op.batch_alter_table("hockey_poule_matches") as batch_op:
        if "location_name" not in cols:
            batch_op.add_column(sa.Column("location_name", sa.Text(), nullable=True))
        if "field_type" not in cols:
            batch_op.add_column(sa.Column("field_type", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("hockey_poule_matches") as batch_op:
        batch_op.drop_column("location_name")
        batch_op.drop_column("field_type")
