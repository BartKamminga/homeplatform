"""yearof scoped short links + link visits

Revision ID: e5a7c9b1d3f2
Revises: d2e4f6a8b0c1
Create Date: 2026-10-06

Item 1186: wedstrijd- en spelerslinks krijgen een eigen scope en vervaldatum.
Item 1193: bezoeken per deelbare link tellen.
"""
from alembic import op
import sqlalchemy as sa

revision = "e5a7c9b1d3f2"
down_revision = "d2e4f6a8b0c1"
branch_labels = None
depends_on = None

SHORT_LINK_COLUMNS = (
    ("link_type", sa.String(), "site"),
    ("player_id", sa.String(), None),
    ("expires_at", sa.DateTime(), None),
    ("revoked_at", sa.DateTime(), None),
)


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # create_all draait in de deploy-pipeline voor deze migratie en kan
    # kolommen/tabellen dan al aangemaakt hebben.
    columns = {c["name"] for c in inspector.get_columns("yearof_short_links")}
    for name, type_, default in SHORT_LINK_COLUMNS:
        if name not in columns:
            op.add_column(
                "yearof_short_links",
                sa.Column(name, type_, nullable=default is None, server_default=default),
            )
    op.execute("UPDATE yearof_short_links SET link_type = 'match' WHERE match_ref IS NOT NULL")

    if "yearof_link_visits" not in inspector.get_table_names():
        op.create_table(
            "yearof_link_visits",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("link_kind", sa.String(), nullable=False),
            sa.Column("link_code", sa.String(), nullable=False),
            sa.Column("visitor_id", sa.String(), nullable=False),
            sa.Column("visited_at", sa.DateTime(), nullable=False),
        )
    indexes = {i["name"] for i in sa.inspect(bind).get_indexes("yearof_link_visits")}
    for col in ("link_kind", "link_code"):
        name = f"ix_yearof_link_visits_{col}"
        if name not in indexes:
            op.create_index(name, "yearof_link_visits", [col])


def downgrade():
    op.drop_table("yearof_link_visits")
    with op.batch_alter_table("yearof_short_links") as batch_op:
        for name, _, _ in SHORT_LINK_COLUMNS:
            batch_op.drop_column(name)
