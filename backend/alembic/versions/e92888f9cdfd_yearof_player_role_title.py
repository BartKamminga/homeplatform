"""yearof player role_title

Revision ID: e92888f9cdfd
Revises: b86d79722251
Create Date: 2026-09-17

"""
from alembic import op
import sqlalchemy as sa

revision = "e92888f9cdfd"
down_revision = "b86d79722251"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns("yearof_players")]
    if "role_title" not in columns:
        with op.batch_alter_table("yearof_players") as batch_op:
            batch_op.add_column(sa.Column("role_title", sa.String(), nullable=True))


def downgrade():
    with op.batch_alter_table("yearof_players") as batch_op:
        batch_op.drop_column("role_title")
