"""yearof photo player tag favorite

Revision ID: a4c6e8f0b2d1
Revises: f8b2d4e6a0c3
Create Date: 2026-10-06

Item 1199: favoriete fotos per speelster (op de foto-speler-tag).
"""
from alembic import op
import sqlalchemy as sa

revision = "a4c6e8f0b2d1"
down_revision = "f8b2d4e6a0c3"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    # create_all draait in de deploy-pipeline voor deze migratie.
    columns = {c["name"] for c in sa.inspect(bind).get_columns("yearof_photo_player_tags")}
    if "favorite" not in columns:
        op.add_column(
            "yearof_photo_player_tags",
            sa.Column("favorite", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade():
    with op.batch_alter_table("yearof_photo_player_tags") as batch_op:
        batch_op.drop_column("favorite")
