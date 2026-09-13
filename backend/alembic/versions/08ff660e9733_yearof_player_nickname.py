"""yearof_players.nickname - bijnaam-veld voor spelersprofielen (item 1144).

Revision ID: 08ff660e9733
Revises: 582125c6fb4f
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa

revision = "08ff660e9733"
down_revision = "582125c6fb4f"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    cols = {c["name"] for c in sa.inspect(bind).get_columns("yearof_players")}
    if "nickname" not in cols:
        op.add_column("yearof_players", sa.Column("nickname", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("yearof_players", "nickname")
