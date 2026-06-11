"""mixmusic group scope: group_id on track_meta and track_hearts

Revision ID: q7r8s9t0u1v2
Revises: p6q7r8s9t0u1
Create Date: 2026-06-11
"""
import sqlalchemy as sa
from alembic import op

revision = "q7r8s9t0u1v2"
down_revision = "p6q7r8s9t0u1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    meta_cols = {c["name"] for c in inspector.get_columns("mixmusic_track_meta")}
    if "group_id" not in meta_cols:
        bind.execute(sa.text(
            "ALTER TABLE mixmusic_track_meta ADD COLUMN group_id TEXT"
        ))
        bind.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_mixmusic_track_meta_group_id "
            "ON mixmusic_track_meta(group_id)"
        ))
        # partial unique index: one record per (file_path, group_id) for group records
        bind.execute(sa.text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_trackmeta_file_group "
            "ON mixmusic_track_meta(file_path, group_id) WHERE group_id IS NOT NULL"
        ))

    heart_cols = {c["name"] for c in inspector.get_columns("mixmusic_track_hearts")}
    if "group_id" not in heart_cols:
        bind.execute(sa.text(
            "ALTER TABLE mixmusic_track_hearts ADD COLUMN group_id TEXT"
        ))
        bind.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_mixmusic_track_hearts_group_id "
            "ON mixmusic_track_hearts(group_id)"
        ))


def downgrade() -> None:
    pass  # SQLite: column drops require table recreation — not worth it for a downgrade
