"""data_shape_flags tabel - signalering van scandata-vorm-afwijkingen (item 1167)

Revision ID: b2c3d4e5f6a7
Revises: 9a1ecb4c1146
Create Date: 2026-09-19
"""
from alembic import op
import sqlalchemy as sa

revision = "e318326111e7"
down_revision = "9a1ecb4c1146"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    existing = bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
    if "data_shape_flags" in {r[0] for r in existing}:
        return

    op.create_table(
        "data_shape_flags",
        sa.Column("id",             sa.Integer(), nullable=False),
        sa.Column("poule_id",       sa.Integer(), nullable=False),
        sa.Column("competition_id", sa.Integer(), nullable=False),
        sa.Column("missing_field",  sa.Text(),    nullable=False),
        sa.Column("detail",         sa.Text(),    nullable=True),
        sa.Column("created_at",     sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["competition_id"], ["hockey_competitions.id"]),
    )
    op.create_index("ix_data_shape_flags_poule_id", "data_shape_flags", ["poule_id"])
    op.create_index("ix_data_shape_flags_competition_id", "data_shape_flags", ["competition_id"])
    op.create_index("ix_data_shape_flags_created_at", "data_shape_flags", ["created_at"])


def downgrade():
    op.execute("DROP TABLE IF EXISTS data_shape_flags")
