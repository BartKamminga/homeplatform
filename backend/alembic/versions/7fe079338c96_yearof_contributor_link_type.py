"""yearof_contributor_links.report_type (item 1147) - kies bij het aanmaken
van een invullinkje of het een interview of een wedstrijdverslag oplevert
(bv. een vooraf-preview i.p.v. alleen een na-de-wedstrijd-interview).

Revision ID: 7fe079338c96
Revises: 006c1d86d072
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa

revision = "7fe079338c96"
down_revision = "006c1d86d072"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    cols = {c["name"] for c in sa.inspect(bind).get_columns("yearof_contributor_links")}
    if "report_type" not in cols:
        op.add_column(
            "yearof_contributor_links",
            sa.Column("report_type", sa.Text(), nullable=False, server_default="interview"),
        )


def downgrade():
    op.drop_column("yearof_contributor_links", "report_type")
