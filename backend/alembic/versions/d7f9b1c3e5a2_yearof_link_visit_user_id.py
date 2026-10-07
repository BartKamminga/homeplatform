"""yearof link visit user_id

Revision ID: d7f9b1c3e5a2
Revises: c6e8a0b2d4f1
Create Date: 2026-10-07

Bezoekers-tray: per bezoek vastleggen welke ingelogde gebruiker het was
(NULL = onbekend apparaat of niet meetellen-apparaat zonder login).
"""
from alembic import op
import sqlalchemy as sa

revision = "d7f9b1c3e5a2"
down_revision = "c6e8a0b2d4f1"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    # create_all draait in de deploy-pipeline voor deze migratie.
    columns = {c["name"] for c in sa.inspect(bind).get_columns("yearof_link_visits")}
    if "user_id" not in columns:
        op.add_column("yearof_link_visits", sa.Column("user_id", sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table("yearof_link_visits") as batch_op:
        batch_op.drop_column("user_id")
