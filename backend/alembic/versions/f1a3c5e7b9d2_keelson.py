"""keelson: systems, elements, links and checks - item 1340

Revision ID: f1a3c5e7b9d2
Revises: c4e6a8b0d2f4
Create Date: 2026-10-15

With has-table checks, because create_all runs before the migration in the deploy pipeline.
"""
from alembic import op
import sqlalchemy as sa

revision = "f1a3c5e7b9d2"
down_revision = "c4e6a8b0d2f4"
branch_labels = None
depends_on = None


def upgrade():
    tables = sa.inspect(op.get_bind()).get_table_names()
    if "keelson_systems" not in tables:
        op.create_table(
            "keelson_systems",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("key", sa.String(), nullable=False, unique=True, index=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("kind", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("description", sa.String(), nullable=True),
            sa.Column("owner", sa.String(), nullable=True),
            sa.Column("meta", sa.JSON(), nullable=True),
            sa.Column("seeded", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
    if "keelson_elements" not in tables:
        op.create_table(
            "keelson_elements",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("system_id", sa.String(), sa.ForeignKey("keelson_systems.id"), nullable=False, index=True),
            sa.Column("key", sa.String(), nullable=False),
            sa.Column("kind", sa.String(), nullable=False, index=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("description", sa.String(), nullable=True),
            sa.Column("attributes", sa.JSON(), nullable=True),
            sa.Column("source", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("system_id", "key", name="uq_keelson_element_key"),
        )
    if "keelson_links" not in tables:
        op.create_table(
            "keelson_links",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("from_id", sa.String(), sa.ForeignKey("keelson_elements.id"), nullable=False, index=True),
            sa.Column("to_id", sa.String(), sa.ForeignKey("keelson_elements.id"), nullable=False, index=True),
            sa.Column("verb", sa.String(), nullable=False),
            sa.Column("source", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("from_id", "to_id", "verb", name="uq_keelson_link"),
        )
    if "keelson_checks" not in tables:
        op.create_table(
            "keelson_checks",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("system_id", sa.String(), sa.ForeignKey("keelson_systems.id"), nullable=False, index=True),
            sa.Column("key", sa.String(), nullable=False),
            sa.Column("dimension", sa.String(), nullable=False),
            sa.Column("phase", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("done", sa.Boolean(), nullable=False),
            sa.Column("done_at", sa.DateTime(), nullable=True),
            sa.Column("notes", sa.String(), nullable=True),
            sa.Column("sort", sa.Integer(), nullable=False),
            sa.UniqueConstraint("system_id", "key", name="uq_keelson_check_key"),
        )


def downgrade():
    for table in ("keelson_checks", "keelson_links", "keelson_elements", "keelson_systems"):
        op.drop_table(table)
