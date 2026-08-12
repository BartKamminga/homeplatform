"""Hockey cleanup: data-fix + tournix opschonen

Twee doelen:
1. Kopieer alsnog tournix-data naar hockey_* tabellen als fade12ab34cd dat gemist heeft
   (happens bij acc-deploy met stamp head probleem)
2. Verwijder de gemigreerde hockey-publicatie data uit de tournix_* tabellen

Revision ID: a2b3c4d5e6f7
Revises: fade12ab34cd
Create Date: 2026-08-12
"""
import sqlalchemy as sa
from alembic import op

revision = "a2b3c4d5e6f7"
down_revision = "fade12ab34cd"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # ── Stap 1: herstel data die door stamp-head gemist werd ──────────────────
    conn.execute(sa.text(
        "INSERT OR IGNORE INTO hockey_publications "
        "(id, name, description, status, group_id, created_by, created_at, season, \"order\", published, info) "
        "SELECT id, name, description, status, group_id, created_by, created_at, season, \"order\", published, info "
        "FROM tournix_tournaments "
        "WHERE id NOT IN (SELECT id FROM hockey_publications)"
    ))

    conn.execute(sa.text(
        "INSERT OR IGNORE INTO hockey_publication_tags (id, name, \"order\") "
        "SELECT id, name, \"order\" FROM tournix_fase_tags "
        "WHERE id NOT IN (SELECT id FROM hockey_publication_tags)"
    ))

    conn.execute(sa.text(
        "INSERT OR IGNORE INTO hockey_publication_comps "
        "(id, publication_id, competition_id, \"order\", label, fase, visible) "
        "SELECT id, tournament_id, competition_id, \"order\", label, fase, visible "
        "FROM tournix_tournament_competitions "
        "WHERE id NOT IN (SELECT id FROM hockey_publication_comps)"
    ))

    conn.execute(sa.text(
        "INSERT OR IGNORE INTO hockey_publication_comp_tags (id, comp_link_id, tag_id) "
        "SELECT id, competition_link_id, fase_tag_id "
        "FROM tournix_competition_fase_tags "
        "WHERE id NOT IN (SELECT id FROM hockey_publication_comp_tags)"
    ))

    # ── Stap 2: opschonen tournix_* van gemigreerde hockey-publicaties ────────
    conn.execute(sa.text(
        "DELETE FROM tournix_competition_fase_tags "
        "WHERE competition_link_id IN ("
        "  SELECT tc.id FROM tournix_tournament_competitions tc "
        "  INNER JOIN hockey_publications hp ON tc.tournament_id = hp.id"
        ")"
    ))

    conn.execute(sa.text(
        "DELETE FROM tournix_tournament_competitions "
        "WHERE tournament_id IN (SELECT id FROM hockey_publications)"
    ))

    conn.execute(sa.text(
        "DELETE FROM tournix_fase_tags "
        "WHERE id IN (SELECT id FROM hockey_publication_tags)"
    ))

    conn.execute(sa.text(
        "DELETE FROM tournix_tournaments "
        "WHERE id IN (SELECT id FROM hockey_publications)"
    ))


def downgrade():
    pass
