"""DB-migratie: hockey_publications tabellen (split uit tournix_*)

Maak 4 nieuwe hockey_* tabellen aan en migreer bestaande data:
  tournix_tournaments          -> hockey_publications
  tournix_fase_tags            -> hockey_publication_tags
  tournix_tournament_competitions -> hockey_publication_comps
  tournix_competition_fase_tags   -> hockey_publication_comp_tags

Revision ID: fade12ab34cd
Revises: z6a7b8c9d0e1
Create Date: 2026-08-12
"""
import sqlalchemy as sa
from alembic import op

revision = "fade12ab34cd"
down_revision = "z6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "hockey_publications",
        sa.Column("id",          sa.String(),  primary_key=True, nullable=False),
        sa.Column("name",        sa.String(),  nullable=False),
        sa.Column("description", sa.String(),  nullable=True),
        sa.Column("status",      sa.String(),  nullable=False, server_default="active"),
        sa.Column("group_id",    sa.String(),  nullable=True),
        sa.Column("created_by",  sa.String(),  nullable=True),
        sa.Column("created_at",  sa.DateTime(), nullable=False),
        sa.Column("season",      sa.String(),  nullable=True),
        sa.Column("order",       sa.Integer(), nullable=False, server_default="0"),
        sa.Column("published",   sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("info",        sa.Text(),    nullable=True),
    )
    op.create_index("ix_hockey_publications_group_id", "hockey_publications", ["group_id"])

    op.create_table(
        "hockey_publication_tags",
        sa.Column("id",    sa.String(),  primary_key=True, nullable=False),
        sa.Column("name",  sa.String(),  nullable=False, unique=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "hockey_publication_comps",
        sa.Column("id",             sa.String(),  primary_key=True, nullable=False),
        sa.Column("publication_id", sa.String(),  sa.ForeignKey("hockey_publications.id"), nullable=False),
        sa.Column("competition_id", sa.Integer(), sa.ForeignKey("hockey_competitions.id"), nullable=False),
        sa.Column("order",          sa.Integer(), nullable=False, server_default="0"),
        sa.Column("label",          sa.String(),  nullable=True),
        sa.Column("fase",           sa.String(),  nullable=True),
        sa.Column("visible",        sa.Boolean(), nullable=False, server_default="1"),
    )
    op.create_index("ix_hockey_publication_comps_publication_id", "hockey_publication_comps", ["publication_id"])

    op.create_table(
        "hockey_publication_comp_tags",
        sa.Column("id",           sa.String(), primary_key=True, nullable=False),
        sa.Column("comp_link_id", sa.String(), sa.ForeignKey("hockey_publication_comps.id"), nullable=False),
        sa.Column("tag_id",       sa.String(), sa.ForeignKey("hockey_publication_tags.id"), nullable=False),
    )
    op.create_index("ix_hockey_publication_comp_tags_comp_link_id", "hockey_publication_comp_tags", ["comp_link_id"])

    # Data migreren — zelfde IDs zodat externe referenties (poulebord pins) intact blijven
    op.execute(sa.text(
        "INSERT INTO hockey_publications "
        "(id, name, description, status, group_id, created_by, created_at, season, \"order\", published, info) "
        "SELECT id, name, description, status, group_id, created_by, created_at, season, \"order\", published, info "
        "FROM tournix_tournaments"
    ))

    op.execute(sa.text(
        "INSERT INTO hockey_publication_tags (id, name, \"order\") "
        "SELECT id, name, \"order\" FROM tournix_fase_tags"
    ))

    op.execute(sa.text(
        "INSERT INTO hockey_publication_comps "
        "(id, publication_id, competition_id, \"order\", label, fase, visible) "
        "SELECT id, tournament_id, competition_id, \"order\", label, fase, visible "
        "FROM tournix_tournament_competitions"
    ))

    op.execute(sa.text(
        "INSERT INTO hockey_publication_comp_tags (id, comp_link_id, tag_id) "
        "SELECT id, competition_link_id, fase_tag_id "
        "FROM tournix_competition_fase_tags"
    ))


def downgrade():
    op.drop_index("ix_hockey_publication_comp_tags_comp_link_id", "hockey_publication_comp_tags")
    op.drop_table("hockey_publication_comp_tags")
    op.drop_index("ix_hockey_publication_comps_publication_id", "hockey_publication_comps")
    op.drop_table("hockey_publication_comps")
    op.drop_table("hockey_publication_tags")
    op.drop_index("ix_hockey_publications_group_id", "hockey_publications")
    op.drop_table("hockey_publications")
