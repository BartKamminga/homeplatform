"""tournix: match_type + knockout settings

Revision ID: k7l8m9n0o1p2
Revises: j6k7l8m9n0o1
Create Date: 2026-06-12
"""
from alembic import op
import sqlalchemy as sa

revision = "k7l8m9n0o1p2"
down_revision = "j6k7l8m9n0o1"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    t_cols = {c["name"] for c in inspector.get_columns("tournix_tournaments")}
    with op.batch_alter_table("tournix_tournaments") as b:
        if "knockout_type" not in t_cols:
            b.add_column(sa.Column("knockout_type",    sa.String(),  nullable=False, server_default="none"))
        if "knockout_advance" not in t_cols:
            b.add_column(sa.Column("knockout_advance", sa.Integer(), nullable=False, server_default="2"))

    m_cols = {c["name"] for c in inspector.get_columns("tournix_matches")}
    with op.batch_alter_table("tournix_matches") as b:
        if "match_type" not in m_cols:
            b.add_column(sa.Column("match_type", sa.String(), nullable=False, server_default="pool"))


def downgrade():
    with op.batch_alter_table("tournix_matches") as b:
        b.drop_column("match_type")
    with op.batch_alter_table("tournix_tournaments") as b:
        b.drop_column("knockout_advance")
        b.drop_column("knockout_type")
