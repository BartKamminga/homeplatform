"""dontforget_tasks_init

Revision ID: c6443825b65a
Revises: a127797a8c22
Create Date: 2026-06-05

"""

from alembic import op
import sqlalchemy as sa

revision = "c6443825b65a"
down_revision = "a127797a8c22"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tasks",
        sa.Column("id", sa.String(), nullable=False, primary_key=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("photo_path", sa.String(), nullable=True),
        sa.Column("when", sa.String(), nullable=False, server_default="morning"),
        sa.Column("repeat", sa.String(), nullable=False, server_default="once"),
        sa.Column("priority", sa.String(), nullable=False, server_default="normal"),
        sa.Column("done", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("source", sa.String(), nullable=False, server_default="user"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column(
            "completed_by",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "group_id",
            sa.String(),
            sa.ForeignKey("groups.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_tasks_group_id", "tasks", ["group_id"])
    op.create_index("ix_tasks_user_id", "tasks", ["user_id"])
    op.create_index("ix_tasks_done", "tasks", ["done"])


def downgrade() -> None:
    op.drop_index("ix_tasks_done", table_name="tasks")
    op.drop_index("ix_tasks_user_id", table_name="tasks")
    op.drop_index("ix_tasks_group_id", table_name="tasks")
    op.drop_table("tasks")
