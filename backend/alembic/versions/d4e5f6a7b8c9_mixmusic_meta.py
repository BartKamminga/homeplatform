"""mixmusic_meta

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-10

"""
from alembic import op
import sqlalchemy as sa

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None

DEFAULT_GENRES = [
    "Ambient", "Chillen", "Electronic", "Hip-Hop",
    "Jazz", "Klassiek", "Pop", "R&B", "Rock", "Workout",
]


def upgrade() -> None:
    op.create_table(
        "mixmusic_genres",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(), nullable=False, unique=True),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "mixmusic_track_meta",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column("file_path", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("genres", sa.String(), nullable=True),
        sa.Column("moments", sa.String(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    now = "2026-06-10T00:00:00"
    for name in DEFAULT_GENRES:
        op.execute(
            f"INSERT INTO mixmusic_genres (name, created_at) VALUES ('{name}', '{now}')"
        )


def downgrade() -> None:
    op.drop_table("mixmusic_track_meta")
    op.drop_table("mixmusic_genres")
