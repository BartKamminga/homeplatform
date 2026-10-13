"""VBT (Virtual Bike Trainer): profiel, ritten, Strava-koppeling + site-registratie

Revision ID: c3e5a7b9d1f4
Revises: b8d0f2a4c6e3
Create Date: 2026-10-13

Met has-table-checks, omdat create_all in de deploy-pipeline voor de migratie draait.
"""
import uuid

from alembic import op
import sqlalchemy as sa

revision = "c3e5a7b9d1f4"
down_revision = "b8d0f2a4c6e3"
branch_labels = None
depends_on = None


def upgrade():
    tables = sa.inspect(op.get_bind()).get_table_names()

    if "vbt_profiles" not in tables:
        op.create_table(
            "vbt_profiles",
            sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), primary_key=True),
            sa.Column("ftp", sa.Integer(), nullable=False, server_default="180"),
            sa.Column("plan_start", sa.String(), nullable=True),
            sa.Column("plan_done", sa.JSON(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )

    if "vbt_rides" not in tables:
        op.create_table(
            "vbt_rides",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("started_at", sa.DateTime(), nullable=False),
            sa.Column("kind", sa.String(), nullable=False),
            sa.Column("course_key", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("wo_id", sa.String(), nullable=True),
            sa.Column("duration", sa.Integer(), nullable=False),
            sa.Column("distance", sa.Integer(), nullable=False),
            sa.Column("avg_w", sa.Integer(), nullable=False),
            sa.Column("max_w", sa.Integer(), nullable=False),
            sa.Column("avg_cad", sa.Integer(), nullable=False),
            sa.Column("avg_hr", sa.Integer(), nullable=False),
            sa.Column("kj", sa.Integer(), nullable=False),
            sa.Column("elevation", sa.Integer(), nullable=False),
            sa.Column("lap_time", sa.Float(), nullable=True),
            sa.Column("jumped", sa.Boolean(), nullable=False),
            sa.Column("pb", sa.Boolean(), nullable=False),
            sa.Column("score", sa.Integer(), nullable=True),
            sa.Column("ftp", sa.Integer(), nullable=True),
            sa.Column("samples", sa.JSON(), nullable=True),
            sa.Column("strava_upload_id", sa.String(), nullable=True),
            sa.Column("strava_activity_id", sa.String(), nullable=True),
            sa.Column("strava_status", sa.String(), nullable=True),
            sa.Column("strava_error", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_vbt_rides_user_id", "vbt_rides", ["user_id"])
        op.create_index("ix_vbt_rides_course_key", "vbt_rides", ["course_key"])

    if "vbt_strava_links" not in tables:
        op.create_table(
            "vbt_strava_links",
            sa.Column("user_id", sa.String(), sa.ForeignKey("users.id"), primary_key=True),
            sa.Column("athlete_id", sa.String(), nullable=False),
            sa.Column("athlete_name", sa.String(), nullable=True),
            sa.Column("access_token", sa.String(), nullable=False),
            sa.Column("refresh_token", sa.String(), nullable=False),
            sa.Column("expires_at", sa.Integer(), nullable=False),
            sa.Column("scope", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
        )

    op.execute(
        "INSERT OR IGNORE INTO sites (id, name, slug, module, icon, is_active, created_at) "
        f"VALUES ('{uuid.uuid4()}', 'VBT', 'vbt', 'vbt', '🚴', 1, datetime('now'))"
    )


def downgrade():
    op.execute("DELETE FROM sites WHERE slug = 'vbt'")
    op.drop_table("vbt_strava_links")
    op.drop_index("ix_vbt_rides_course_key", table_name="vbt_rides")
    op.drop_index("ix_vbt_rides_user_id", table_name="vbt_rides")
    op.drop_table("vbt_rides")
    op.drop_table("vbt_profiles")
