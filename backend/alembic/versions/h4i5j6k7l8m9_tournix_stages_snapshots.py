"""tournix: stage column + snapshots table

Revision ID: h4i5j6k7l8m9
Revises: g3h4i5j6k7l8
Create Date: 2026-06-12
"""
from alembic import op
import sqlalchemy as sa

revision = "h4i5j6k7l8m9"
down_revision = "g3h4i5j6k7l8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("tournix_tournaments") as batch_op:
        batch_op.add_column(sa.Column("stage", sa.String(), nullable=False, server_default="inregel"))

    op.create_table(
        "tournix_snapshots",
        sa.Column("id",            sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tournament_id", sa.String(),  sa.ForeignKey("tournix_tournaments.id"), nullable=False),
        sa.Column("round",         sa.Integer(), nullable=False),
        sa.Column("snapshot_json", sa.String(),  nullable=False),
        sa.Column("created_at",    sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("tournix_snapshots")
    with op.batch_alter_table("tournix_tournaments") as batch_op:
        batch_op.drop_column("stage")
