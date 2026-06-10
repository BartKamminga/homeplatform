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


def _existing_cols(inspector, table: str) -> set:
    return {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    user_cols = _existing_cols(inspector, "users")
    if "updated_at" not in user_cols:
        with op.batch_alter_table("users") as batch_op:
            batch_op.add_column(sa.Column("updated_at", sa.DateTime(), nullable=True))

    group_cols = _existing_cols(inspector, "groups")
    group_adds = [
        c for c in [
            ("created_at", sa.Column("created_at", sa.DateTime(), nullable=True)),
            ("deleted_at", sa.Column("deleted_at", sa.DateTime(), nullable=True)),
        ] if c[0] not in group_cols
    ]
    if group_adds:
        with op.batch_alter_table("groups") as batch_op:
            for _, col in group_adds:
                batch_op.add_column(col)

    theme_cols = _existing_cols(inspector, "themes")
    theme_adds = [
        c for c in [
            ("created_at", sa.Column("created_at", sa.DateTime(), nullable=True)),
            ("deleted_at", sa.Column("deleted_at", sa.DateTime(), nullable=True)),
        ] if c[0] not in theme_cols
    ]
    if theme_adds:
        with op.batch_alter_table("themes") as batch_op:
            for _, col in theme_adds:
                batch_op.add_column(col)

    site_cols = _existing_cols(inspector, "sites")
    site_adds = [
        c for c in [
            ("created_at", sa.Column("created_at", sa.DateTime(), nullable=True)),
            ("deleted_at", sa.Column("deleted_at", sa.DateTime(), nullable=True)),
        ] if c[0] not in site_cols
    ]
    if site_adds:
        with op.batch_alter_table("sites") as batch_op:
            for _, col in site_adds:
                batch_op.add_column(col)

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("audit_log")}
    if "ix_audit_log_user_id" not in existing_indexes:
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
