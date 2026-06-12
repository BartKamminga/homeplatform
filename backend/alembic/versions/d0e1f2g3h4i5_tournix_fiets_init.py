"""tournix tabellen + site-registratie tournix en fiets

Revision ID: d0e1f2g3h4i5
Revises: c9d0e1f2g3h4
Create Date: 2026-06-12
"""
import uuid
import sqlalchemy as sa
from alembic import op

revision = "d0e1f2g3h4i5"
down_revision = "c9d0e1f2g3h4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Tournix tabellen ──────────────────────────────────────────────────────
    op.create_table(
        "tournix_tournaments",
        sa.Column("id",          sa.String(), primary_key=True),
        sa.Column("name",        sa.String(), nullable=False),
        sa.Column("date",        sa.DateTime(), nullable=True),
        sa.Column("location",    sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("status",      sa.String(), nullable=False, server_default="draft"),
        sa.Column("group_id",    sa.String(), sa.ForeignKey("groups.id"), nullable=True),
        sa.Column("created_by",  sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at",  sa.DateTime(), nullable=False),
    )
    op.create_table(
        "tournix_teams",
        sa.Column("id",            sa.String(), primary_key=True),
        sa.Column("tournament_id", sa.String(), sa.ForeignKey("tournix_tournaments.id"), nullable=False),
        sa.Column("name",          sa.String(), nullable=False),
        sa.Column("short_name",    sa.String(), nullable=True),
        sa.Column("color",         sa.String(), nullable=True),
        sa.Column("created_at",    sa.DateTime(), nullable=False),
    )
    op.create_table(
        "tournix_fields",
        sa.Column("id",            sa.String(), primary_key=True),
        sa.Column("tournament_id", sa.String(), sa.ForeignKey("tournix_tournaments.id"), nullable=False),
        sa.Column("name",          sa.String(), nullable=False),
        sa.Column("created_at",    sa.DateTime(), nullable=False),
    )
    op.create_table(
        "tournix_matches",
        sa.Column("id",            sa.String(), primary_key=True),
        sa.Column("tournament_id", sa.String(), sa.ForeignKey("tournix_tournaments.id"), nullable=False),
        sa.Column("team_a_id",     sa.String(), sa.ForeignKey("tournix_teams.id"), nullable=True),
        sa.Column("team_b_id",     sa.String(), sa.ForeignKey("tournix_teams.id"), nullable=True),
        sa.Column("field_id",      sa.String(), sa.ForeignKey("tournix_fields.id"), nullable=True),
        sa.Column("round",         sa.Integer(), nullable=True),
        sa.Column("scheduled_at",  sa.DateTime(), nullable=True),
        sa.Column("score_a",       sa.Integer(), nullable=True),
        sa.Column("score_b",       sa.Integer(), nullable=True),
        sa.Column("status",        sa.String(), nullable=False, server_default="scheduled"),
        sa.Column("created_at",    sa.DateTime(), nullable=False),
    )
    op.create_table(
        "tournix_predictions",
        sa.Column("id",         sa.String(), primary_key=True),
        sa.Column("match_id",   sa.String(), sa.ForeignKey("tournix_matches.id"), nullable=False),
        sa.Column("user_id",    sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("pred_a",     sa.Integer(), nullable=False),
        sa.Column("pred_b",     sa.Integer(), nullable=False),
        sa.Column("points",     sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # ── Site-registratie ──────────────────────────────────────────────────────
    bind = op.get_bind()
    bind.execute(sa.text(
        "INSERT OR IGNORE INTO sites (id, name, slug, module, is_active, icon) "
        "VALUES ('site-tournix', 'Tournix', 'tournix', 'tournix', 1, '🏆')"
    ))
    bind.execute(sa.text(
        "INSERT OR IGNORE INTO sites (id, name, slug, module, is_active, icon) "
        "VALUES ('site-fiets', 'FietsPrognose', 'fiets', 'fiets', 1, '🚴')"
    ))

    # ── Changelog ─────────────────────────────────────────────────────────────
    for entry in [
        {
            "id": str(uuid.uuid4()),
            "version": "0.1",
            "site": "tournix",
            "title": "Eerste versie van Tournix",
            "description": (
                "Toernooi-app beschikbaar op /tournix/. "
                "Teams, velden en wedstrijden beheren via het beheerpaneel. "
                "Programma, stand en voorspellingen beschikbaar voor alle deelnemers."
            ),
            "released_at": "2026-06-12T00:00:00",
        },
        {
            "id": str(uuid.uuid4()),
            "version": "0.1",
            "site": "fiets",
            "title": "Eerste versie van FietsPrognose",
            "description": (
                "FietsPrognose beschikbaar op /fiets/. "
                "Toont wanneer je het beste kunt fietsen op basis van weersomstandigheden."
            ),
            "released_at": "2026-06-12T00:00:00",
        },
    ]:
        existing = bind.execute(
            sa.text("SELECT id FROM changelog WHERE site = :site AND version = :ver"),
            {"site": entry["site"], "ver": entry["version"]},
        ).fetchone()
        if not existing:
            bind.execute(
                sa.text(
                    "INSERT INTO changelog (id, version, site, title, description, released_at, created_at) "
                    "VALUES (:id, :version, :site, :title, :description, :released_at, :created_at)"
                ),
                {**entry, "created_at": "2026-06-12T00:00:00"},
            )


def downgrade() -> None:
    op.drop_table("tournix_predictions")
    op.drop_table("tournix_matches")
    op.drop_table("tournix_fields")
    op.drop_table("tournix_teams")
    op.drop_table("tournix_tournaments")
    bind = op.get_bind()
    bind.execute(sa.text("DELETE FROM sites WHERE slug IN ('tournix', 'fiets')"))
    bind.execute(sa.text("DELETE FROM changelog WHERE site IN ('tournix', 'fiets')"))
