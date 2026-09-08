"""mindbox_deadlines tabel (item 1117) - agent-gecureerde, chronologische
lijst van belangrijke datums. Geen automatische extractie: een rij komt hier
alleen in als de agent 'm tijdens een sessie voorstelt en Bart bevestigt.

Revision ID: c4d6e8f0a2b4
Revises: b3c5d7e9f1a3
Create Date: 2026-09-08
"""
import sqlalchemy as sa
from alembic import op

revision = "c4d6e8f0a2b4"
down_revision = "b3c5d7e9f1a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mindbox_deadlines",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("case_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["case_id"], ["mindbox_cases.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mindbox_deadlines_user_id", "mindbox_deadlines", ["user_id"])
    op.create_index("ix_mindbox_deadlines_date", "mindbox_deadlines", ["date"])
    op.create_index("ix_mindbox_deadlines_case_id", "mindbox_deadlines", ["case_id"])


def downgrade() -> None:
    op.drop_index("ix_mindbox_deadlines_case_id", table_name="mindbox_deadlines")
    op.drop_index("ix_mindbox_deadlines_date", table_name="mindbox_deadlines")
    op.drop_index("ix_mindbox_deadlines_user_id", table_name="mindbox_deadlines")
    op.drop_table("mindbox_deadlines")
