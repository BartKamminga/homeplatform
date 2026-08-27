"""push_subscriptions table (item 891) - Web Push-abonnementen (1 rij per
browser/toestel-installatie die notificaties heeft toegestaan). endpoint
uniek (de push-dienst genereert 'm per subscribe-call).

Revision ID: 0289f61e20a4
Revises: bb8b517077ea
Create Date: 2026-08-27
"""
from alembic import op
import sqlalchemy as sa

revision = "0289f61e20a4"
down_revision = "bb8b517077ea"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    existing = bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
    if "push_subscriptions" in {r[0] for r in existing}:
        return

    op.create_table(
        "push_subscriptions",
        sa.Column("id",            sa.Text(),     nullable=False),
        sa.Column("user_id",       sa.Text(),     nullable=False),
        sa.Column("site",          sa.Text(),     nullable=False),
        sa.Column("endpoint",      sa.Text(),     nullable=False),
        sa.Column("p256dh",        sa.Text(),     nullable=False),
        sa.Column("auth",          sa.Text(),     nullable=False),
        sa.Column("created_at",    sa.DateTime(), nullable=False),
        sa.Column("last_used_at",  sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_push_subscriptions_user_id", "push_subscriptions", ["user_id"])
    op.create_index("ix_push_subscriptions_site", "push_subscriptions", ["site"])
    op.create_index("ux_push_subscriptions_endpoint", "push_subscriptions", ["endpoint"], unique=True)


def downgrade():
    op.drop_table("push_subscriptions")
