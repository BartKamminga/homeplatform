"""tournix: pools table + num_pools/pool_type/pool_id columns

Revision ID: j6k7l8m9n0o1
Revises: i5j6k7l8m9n0
Create Date: 2026-06-12
"""
from alembic import op
import sqlalchemy as sa

revision = "j6k7l8m9n0o1"
down_revision = "i5j6k7l8m9n0"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "tournix_pools" not in existing_tables:
        op.create_table(
            "tournix_pools",
            sa.Column("id",            sa.String(),  primary_key=True),
            sa.Column("tournament_id", sa.String(),  sa.ForeignKey("tournix_tournaments.id"), nullable=False),
            sa.Column("name",          sa.String(),  nullable=False),
            sa.Column("order",         sa.Integer(), nullable=False, server_default="0"),
        )

    existing_cols = {c["name"] for c in inspector.get_columns("tournix_tournaments")}
    with op.batch_alter_table("tournix_tournaments") as b:
        if "num_pools" not in existing_cols:
            b.add_column(sa.Column("num_pools", sa.Integer(), nullable=False, server_default="1"))
        if "pool_type" not in existing_cols:
            b.add_column(sa.Column("pool_type", sa.String(),  nullable=False, server_default="half"))

    existing_team_cols = {c["name"] for c in inspector.get_columns("tournix_teams")}
    with op.batch_alter_table("tournix_teams") as b:
        if "pool_id" not in existing_team_cols:
            b.add_column(sa.Column("pool_id", sa.String(), nullable=True))


def downgrade():
    with op.batch_alter_table("tournix_teams") as b:
        b.drop_column("pool_id")
    with op.batch_alter_table("tournix_tournaments") as b:
        b.drop_column("pool_type")
        b.drop_column("num_pools")
    op.drop_table("tournix_pools")
