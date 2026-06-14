"""phase schedule params: duration, break, phase_fields table

Revision ID: x3y4z5a6b7c8
Revises: w2x3y4z5a6b7
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa

revision = "x3y4z5a6b7c8"
down_revision = "w2x3y4z5a6b7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tournix_phases", sa.Column("match_duration_min", sa.Integer(), nullable=False, server_default="20"))
    op.add_column("tournix_phases", sa.Column("break_min", sa.Integer(), nullable=False, server_default="5"))
    op.create_table(
        "tournix_phase_fields",
        sa.Column("id",       sa.String(), nullable=False),
        sa.Column("phase_id", sa.String(), nullable=False),
        sa.Column("field_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["phase_id"], ["tournix_phases.id"]),
        sa.ForeignKeyConstraint(["field_id"], ["tournix_fields.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tournix_phase_fields_phase_id", "tournix_phase_fields", ["phase_id"])


def downgrade():
    op.drop_index("ix_tournix_phase_fields_phase_id", "tournix_phase_fields")
    op.drop_table("tournix_phase_fields")
    op.drop_column("tournix_phases", "break_min")
    op.drop_column("tournix_phases", "match_duration_min")
