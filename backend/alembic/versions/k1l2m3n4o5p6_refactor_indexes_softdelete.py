"""refactor: indexes, soft deletes, JSON columns

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-06-10
"""
from alembic import op
import sqlalchemy as sa

revision = "k1l2m3n4o5p6"
down_revision = "j0k1l2m3n4o5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Soft delete: tasks ---
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.add_column(sa.Column("deleted_at", sa.DateTime(), nullable=True))

    # --- Soft delete: users ---
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("deleted_at", sa.DateTime(), nullable=True))

    # --- Index: tasks (user_id, done) voor gefilterde taaklijsten ---
    op.create_index("ix_tasks_user_done", "tasks", ["user_id", "done"])

    # --- Index: sites.is_active ---
    op.create_index("ix_sites_is_active", "sites", ["is_active"])

    # --- Index: audit_log.created_at ---
    op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_audit_log_created_at", "audit_log")
    op.drop_index("ix_sites_is_active", "sites")
    op.drop_index("ix_tasks_user_done", "tasks")

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("deleted_at")

    with op.batch_alter_table("tasks") as batch_op:
        batch_op.drop_column("deleted_at")
