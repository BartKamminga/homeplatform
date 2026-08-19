"""publication_comp scan_profile: merge heads + auto-scan profiel per competitie-koppeling

Revision ID: e5f6g7h8i9j0
Revises: c0d1e2f3g4h5, d1e2f3a4b5c6
Create Date: 2026-08-19
"""
import sqlalchemy as sa
from alembic import op

revision = "e5f6g7h8i9j0"
down_revision = ("c0d1e2f3g4h5", "d1e2f3a4b5c6")
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "hockey_publication_comps",
        sa.Column("scan_profile", sa.String(), nullable=False, server_default="manual"),
    )


def downgrade():
    op.drop_column("hockey_publication_comps", "scan_profile")
