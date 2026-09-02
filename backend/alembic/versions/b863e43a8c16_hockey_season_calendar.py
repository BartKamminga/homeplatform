"""hockey season calendar

Revision ID: b863e43a8c16
Revises: 53f5ec173030
Create Date: 2026-09-02 07:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'b863e43a8c16'
down_revision = '53f5ec173030'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
    if "hockey_season_calendar" in {r[0] for r in existing}:
        # create_db_and_tables() (SQLModel create_all) draait bij backend-herstart
        # al voor deze alembic-stap en heeft de tabel dan al aangemaakt.
        return

    op.create_table(
        "hockey_season_calendar",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("season", sa.String(), nullable=False),
        sa.Column("district", sa.String(), nullable=True),
        sa.Column("age_category", sa.String(), nullable=True),
        sa.Column("klasse_scope", sa.String(), nullable=True),
        sa.Column("phase", sa.String(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("rounds", sa.Integer(), nullable=True),
        sa.Column("source_url", sa.String(), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_hockey_season_calendar_season", "hockey_season_calendar", ["season"])
    op.create_index("ix_hockey_season_calendar_phase", "hockey_season_calendar", ["phase"])


def downgrade() -> None:
    op.drop_table("hockey_season_calendar")
