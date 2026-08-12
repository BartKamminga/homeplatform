"""Drop tournix-hockey coupling tables and columns."""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "c0d1e2f3g4h5"
down_revision: Union[str, Sequence[str]] = ("a2b3c4d5e6f7", "b9c0d1e2f3g4")
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("tournix_phases") as batch:
        batch.drop_column("hockey_poule_id")

    with op.batch_alter_table("tournix_teams") as batch:
        batch.drop_column("hockey_team_id")

    op.drop_table("tournix_competition_fase_tags")
    op.drop_table("tournix_fase_tags")
    op.drop_table("tournix_tournament_competitions")


def downgrade() -> None:
    op.create_table(
        "tournix_tournament_competitions",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("tournament_id", sa.Text(), nullable=True),
        sa.Column("competition_id", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "tournix_fase_tags",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "tournix_competition_fase_tags",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("tournament_competition_id", sa.Text(), nullable=True),
        sa.Column("fase_tag_id", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    with op.batch_alter_table("tournix_phases") as batch:
        batch.add_column(sa.Column("hockey_poule_id", sa.Integer(), nullable=True))

    with op.batch_alter_table("tournix_teams") as batch:
        batch.add_column(sa.Column("hockey_team_id", sa.Integer(), nullable=True))
