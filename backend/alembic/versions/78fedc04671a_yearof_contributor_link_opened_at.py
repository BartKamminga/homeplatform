"""yearof_contributor_links.opened_at (item 1147) - eerste keer dat de
invulpagina geopend werd, voor statusweergave (geopend/ingevuld/concept/
gepubliceerd) in het beheerderscherm.

Revision ID: 78fedc04671a
Revises: 7fe079338c96
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa

revision = "78fedc04671a"
down_revision = "7fe079338c96"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    cols = {c["name"] for c in sa.inspect(bind).get_columns("yearof_contributor_links")}
    if "opened_at" not in cols:
        op.add_column("yearof_contributor_links", sa.Column("opened_at", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("yearof_contributor_links", "opened_at")
