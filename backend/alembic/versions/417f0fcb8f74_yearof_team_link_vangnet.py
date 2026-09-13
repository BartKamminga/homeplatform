"""yearof_team_links.expires_at - vangnet-vervaldatum voor het teamlinkje
(item 1149), instelbaar bij aanmaken, default 10 dagen. Bestaande rijen
blijven NULL (geen vangnet met terugwerkende kracht).

Revision ID: 417f0fcb8f74
Revises: 5a581acfdf20
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa

revision = "417f0fcb8f74"
down_revision = "5a581acfdf20"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    cols = {c["name"] for c in sa.inspect(bind).get_columns("yearof_team_links")}
    if "expires_at" not in cols:
        op.add_column("yearof_team_links", sa.Column("expires_at", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("yearof_team_links", "expires_at")
