"""hockey_team_poules table (item 990) - draagt de "extra" (niet-primaire)
poule-koppelingen voor een team dat in hetzelfde seizoen ook in een andere
competitie speelt (bv. bekertoernooi naast de reguliere competitie).
HockeyTeam.recent_poule_id blijft de primaire koppeling; deze tabel is puur
additief. Composite unique index op (team_id, poule_id) voorkomt dubbele
koppelingen - meteen goed, i.p.v. achteraf zoals bij hl_comp_id.

Revision ID: 410616cf23a4
Revises: a687203f4148
Create Date: 2026-08-27
"""
from alembic import op
import sqlalchemy as sa

revision = "410616cf23a4"
down_revision = "a687203f4148"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    existing = bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
    if "hockey_team_poules" in {r[0] for r in existing}:
        return

    op.create_table(
        "hockey_team_poules",
        sa.Column("id",                      sa.Integer(),  nullable=False),
        sa.Column("team_id",                  sa.Integer(),  nullable=False),
        sa.Column("poule_id",                 sa.Integer(),  nullable=False),
        sa.Column("season",                   sa.Text(),     nullable=False),
        sa.Column("no_new_poule_confirmed",   sa.Boolean(),  nullable=False, server_default=sa.false()),
        sa.Column("season_pending",           sa.Boolean(),  nullable=False, server_default=sa.false()),
        sa.Column("discovered_at",            sa.DateTime(), nullable=False),
        sa.Column("updated_at",               sa.DateTime(), nullable=False),
        sa.Column("last_scanned_at",          sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_hockey_team_poules_team_id", "hockey_team_poules", ["team_id"])
    op.create_index("ix_hockey_team_poules_poule_id", "hockey_team_poules", ["poule_id"])
    op.create_index(
        "ux_hockey_team_poules_team_poule", "hockey_team_poules", ["team_id", "poule_id"], unique=True,
    )


def downgrade():
    op.drop_table("hockey_team_poules")
