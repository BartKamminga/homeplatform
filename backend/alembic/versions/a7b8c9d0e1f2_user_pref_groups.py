"""users: voeg pref_group_dontforget en pref_group_mixmusic toe

Revision ID: a7b8c9d0e1f2
Revises: z6a7b8c9d0e1
Create Date: 2026-06-12
"""
import sqlalchemy as sa
from alembic import op

revision = "a7b8c9d0e1f2"
down_revision = "z6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("pref_group_dontforget", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("pref_group_mixmusic", sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("pref_group_mixmusic")
        batch_op.drop_column("pref_group_dontforget")
