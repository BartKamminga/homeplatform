"""hockey season calendar round number

Revision ID: c974d15e8a21
Revises: b863e43a8c16
Create Date: 2026-09-02 07:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'c974d15e8a21'
down_revision = 'b863e43a8c16'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    cols = {c["name"] for c in sa.inspect(bind).get_columns("hockey_season_calendar")}
    if "round_number" in cols:
        # create_db_and_tables() (SQLModel create_all) draait bij backend-herstart
        # al voor deze alembic-stap en heeft de kolom dan al aangemaakt.
        return
    op.add_column("hockey_season_calendar", sa.Column("round_number", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("hockey_season_calendar") as batch_op:
        batch_op.drop_column("round_number")
