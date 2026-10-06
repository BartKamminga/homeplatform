"""yearof link visits is_admin

Revision ID: f8b2d4e6a0c3
Revises: e5a7c9b1d3f2
Create Date: 2026-10-06

Item 1193: bezoeken van beheerders (ingelogd of "niet meetellen") worden
gemarkeerd i.p.v. overgeslagen, zodat ze apart zichtbaar zijn.
"""
from alembic import op
import sqlalchemy as sa

revision = "f8b2d4e6a0c3"
down_revision = "e5a7c9b1d3f2"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    # create_all draait in de deploy-pipeline voor deze migratie.
    columns = {c["name"] for c in sa.inspect(bind).get_columns("yearof_link_visits")}
    if "is_admin" not in columns:
        op.add_column(
            "yearof_link_visits",
            sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade():
    with op.batch_alter_table("yearof_link_visits") as batch_op:
        batch_op.drop_column("is_admin")
