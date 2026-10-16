"""dossier_outbox: outbox voor mail zonder dossier - item 1355

Revision ID: b4d6f8a0c2e5
Revises: a3c5e7f9b1d4
Create Date: 2026-10-15

With has-table check, because create_all runs before the migration in the deploy pipeline.
"""
from alembic import op
import sqlalchemy as sa

revision = "b4d6f8a0c2e5"
down_revision = "a3c5e7f9b1d4"
branch_labels = None
depends_on = None


def upgrade():
    if "dossier_outbox" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "dossier_outbox",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("summary", sa.String(), nullable=True),
        sa.Column("sender_role", sa.String(), nullable=True),
        sa.Column("received_at", sa.DateTime(), nullable=True),
        sa.Column("value", sa.String(), nullable=False),
        sa.Column("urgency", sa.String(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("draft_reply", sa.String(), nullable=True),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("source_url", sa.String(), nullable=True),
        sa.Column("external_ref", sa.String(), nullable=True, index=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table("dossier_outbox")
