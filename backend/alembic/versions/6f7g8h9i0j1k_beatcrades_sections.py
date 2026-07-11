"""BeatCrades: sections tabel + section_id op racks

Revision ID: 6f7g8h9i0j1k
Revises: 5e6f7g8h9i0j
Create Date: 2026-07-11
"""
import sqlalchemy as sa
from alembic import op

revision = "6f7g8h9i0j1k"
down_revision = "5e6f7g8h9i0j"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "download_sections",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    conn = op.get_bind()
    cols = [row[1] for row in conn.execute(sa.text("PRAGMA table_info(download_crade_groups)")).fetchall()]
    if "section_id" not in cols:
        op.add_column("download_crade_groups", sa.Column("section_id", sa.String(), nullable=True))


def downgrade():
    op.drop_column("download_crade_groups", "section_id")
    op.drop_table("download_sections")
