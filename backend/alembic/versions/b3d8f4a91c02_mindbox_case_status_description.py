"""mindbox_cases.status + description toevoegen (Bart: case moet net als
bestand een status kennen, en een omschrijving die bovenaan getoond wordt)

Revision ID: b3d8f4a91c02
Revises: 9c3e7b1a4f6d
Create Date: 2026-09-02
"""
import sqlalchemy as sa
from alembic import op

revision = "b3d8f4a91c02"
down_revision = "9c3e7b1a4f6d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_cols = {r[1] for r in bind.execute(sa.text("PRAGMA table_info(mindbox_cases)")).fetchall()}
    if "status" not in existing_cols:
        op.add_column("mindbox_cases", sa.Column("status", sa.String(), nullable=False, server_default="new"))
    if "description" not in existing_cols:
        op.add_column("mindbox_cases", sa.Column("description", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("mindbox_cases", "description")
    op.drop_column("mindbox_cases", "status")
