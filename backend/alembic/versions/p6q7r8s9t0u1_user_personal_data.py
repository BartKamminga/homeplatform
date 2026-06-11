"""user personal data: active_group + per-user metas/hearts

Revision ID: p6q7r8s9t0u1
Revises: o5p6q7r8s9t0
Create Date: 2026-06-11
"""
import sqlalchemy as sa
from alembic import op

revision = "p6q7r8s9t0u1"
down_revision = "o5p6q7r8s9t0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # ── users: active_group_id ───────────────────────────────────────────────
    user_cols = {c["name"] for c in inspector.get_columns("users")}
    if "active_group_id" not in user_cols:
        bind.execute(sa.text("ALTER TABLE users ADD COLUMN active_group_id TEXT"))

    # ── mixmusic_track_meta: add user_id, drop file_path unique, composite unique
    meta_cols = {c["name"] for c in inspector.get_columns("mixmusic_track_meta")}
    if "user_id" not in meta_cols:
        # SQLite cannot DROP UNIQUE inline — recreate the table
        bind.execute(sa.text("""
            CREATE TABLE mixmusic_track_meta_new (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                user_id   TEXT,
                display_name TEXT,
                rating    INTEGER,
                genres    TEXT,
                moments   TEXT,
                updated_at DATETIME NOT NULL,
                UNIQUE(file_path, user_id)
            )
        """))
        bind.execute(sa.text("""
            INSERT INTO mixmusic_track_meta_new
                (id, file_path, user_id, display_name, rating, genres, moments, updated_at)
            SELECT id, file_path, NULL, display_name, rating, genres, moments, updated_at
            FROM mixmusic_track_meta
        """))
        bind.execute(sa.text("DROP TABLE mixmusic_track_meta"))
        bind.execute(sa.text(
            "ALTER TABLE mixmusic_track_meta_new RENAME TO mixmusic_track_meta"
        ))
        bind.execute(sa.text(
            "CREATE INDEX ix_mixmusic_track_meta_file_path ON mixmusic_track_meta(file_path)"
        ))
        bind.execute(sa.text(
            "CREATE INDEX ix_mixmusic_track_meta_user_id ON mixmusic_track_meta(user_id)"
        ))

    # ── mixmusic_track_hearts: add user_id ───────────────────────────────────
    heart_cols = {c["name"] for c in inspector.get_columns("mixmusic_track_hearts")}
    if "user_id" not in heart_cols:
        bind.execute(sa.text(
            "ALTER TABLE mixmusic_track_hearts ADD COLUMN user_id TEXT"
        ))
        bind.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_mixmusic_track_hearts_user_id "
            "ON mixmusic_track_hearts(user_id)"
        ))


def downgrade() -> None:
    bind = op.get_bind()

    # Remove active_group_id from users (SQLite: recreate)
    bind.execute(sa.text("""
        CREATE TABLE users_downgrade AS
        SELECT id, username, email, password_hash, locale, is_active,
               created_at, updated_at, deleted_at
        FROM users
    """))
    bind.execute(sa.text("DROP TABLE users"))
    bind.execute(sa.text("ALTER TABLE users_downgrade RENAME TO users"))

    # Restore mixmusic_track_meta without user_id
    bind.execute(sa.text("""
        CREATE TABLE mixmusic_track_meta_old (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL UNIQUE,
            display_name TEXT,
            rating INTEGER,
            genres TEXT,
            moments TEXT,
            updated_at DATETIME NOT NULL
        )
    """))
    bind.execute(sa.text("""
        INSERT OR IGNORE INTO mixmusic_track_meta_old
            (id, file_path, display_name, rating, genres, moments, updated_at)
        SELECT id, file_path, display_name, rating, genres, moments, updated_at
        FROM mixmusic_track_meta WHERE user_id IS NULL
    """))
    bind.execute(sa.text("DROP TABLE mixmusic_track_meta"))
    bind.execute(sa.text(
        "ALTER TABLE mixmusic_track_meta_old RENAME TO mixmusic_track_meta"
    ))
