"""updated_at + soft delete voor groups, themes, sites; updated_at voor users

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-06-10
"""
from alembic import op
import sqlalchemy as sa

revision = "l2m3n4o5p6q7"
down_revision = "k1l2m3n4o5p6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("updated_at", sa.DateTime(), nullable=True))

    with op.batch_alter_table("groups") as batch_op:
        batch_op.add_column(sa.Column("created_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("deleted_at", sa.DateTime(), nullable=True))

    with op.batch_alter_table("themes") as batch_op:
        batch_op.add_column(sa.Column("created_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("deleted_at", sa.DateTime(), nullable=True))

    with op.batch_alter_table("sites") as batch_op:
        batch_op.add_column(sa.Column("created_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("deleted_at", sa.DateTime(), nullable=True))

    # Index op audit_log.user_id (aanvullend op created_at die al bestaat)
    op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_log_user_id", "audit_log")

    with op.batch_alter_table("sites") as batch_op:
        batch_op.drop_column("deleted_at")
        batch_op.drop_column("created_at")

    with op.batch_alter_table("themes") as batch_op:
        batch_op.drop_column("deleted_at")
        batch_op.drop_column("created_at")

    with op.batch_alter_table("groups") as batch_op:
        batch_op.drop_column("deleted_at")
        batch_op.drop_column("created_at")

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("updated_at")
