"""actual_format op download_jobs, track_count op download_crades

Revision ID: 1k2l3m4n5o6p
Revises: 0j1k2l3m4n5o
Create Date: 2026-07-16
"""

from alembic import op

revision = "1k2l3m4n5o6p"
down_revision = "0j1k2l3m4n5o"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE download_jobs ADD COLUMN actual_format TEXT")
    op.execute("ALTER TABLE download_crades ADD COLUMN track_count INTEGER")


def downgrade():
    pass
