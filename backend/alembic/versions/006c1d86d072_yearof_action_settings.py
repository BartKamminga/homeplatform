"""yearof_action_settings (item 1150) - singleton-instellingen voor de
inzamelactie (doelbedrag, opgehaald bedrag, betaallink).

Revision ID: 006c1d86d072
Revises: 417f0fcb8f74
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa

revision = "006c1d86d072"
down_revision = "417f0fcb8f74"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    existing = {r[0] for r in bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}
    if "yearof_action_settings" not in existing:
        op.create_table(
            "yearof_action_settings",
            sa.Column("id",            sa.Text(),     nullable=False),
            sa.Column("goal_amount",   sa.Integer(),  nullable=False),
            sa.Column("raised_amount", sa.Integer(),  nullable=False),
            sa.Column("donation_url",  sa.Text(),     nullable=True),
            sa.Column("updated_at",    sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade():
    op.drop_table("yearof_action_settings")
