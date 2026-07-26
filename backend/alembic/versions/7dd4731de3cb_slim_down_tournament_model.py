"""slim_down_tournament_model

Revision ID: 7dd4731de3cb
Revises: oo2pp3qq4rr5
Create Date: 2026-07-26 19:56:48.128877

"""
from alembic import op
import sqlalchemy as sa


revision = "7dd4731de3cb"
down_revision = "oo2pp3qq4rr5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("tournix_tournaments") as batch_op:
        batch_op.drop_column("date")
        batch_op.drop_column("location")
        batch_op.drop_column("location_club_id")
        batch_op.drop_column("stage")
        batch_op.drop_column("num_pools")
        batch_op.drop_column("pool_type")
        batch_op.drop_column("knockout_type")
        batch_op.drop_column("knockout_advance")


def downgrade() -> None:
    with op.batch_alter_table("tournix_tournaments") as batch_op:
        batch_op.add_column(sa.Column("knockout_advance", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("knockout_type", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("pool_type", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("num_pools", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("stage", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("location_club_id", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("location", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("date", sa.DateTime(), nullable=True))
