"""yearof_reports: interviewee_role (speelster/coach/ouder) + match_ref
nullable (item 1147) - voor het "In de kijker"-overzicht: algemene
interviews (coach/ouder) hoeven niet aan 1 specifieke wedstrijd te hangen.

Revision ID: 9c2bb80877f6
Revises: 2524d638cfb4
Create Date: 2026-09-13
"""
from alembic import op
import sqlalchemy as sa

revision = "9c2bb80877f6"
down_revision = "2524d638cfb4"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    cols = {c["name"] for c in sa.inspect(bind).get_columns("yearof_reports")}

    with op.batch_alter_table("yearof_reports") as batch_op:
        if "interviewee_role" not in cols:
            batch_op.add_column(sa.Column("interviewee_role", sa.Text(), nullable=True))
        batch_op.alter_column("match_ref", existing_type=sa.Text(), nullable=True)


def downgrade():
    with op.batch_alter_table("yearof_reports") as batch_op:
        batch_op.alter_column("match_ref", existing_type=sa.Text(), nullable=False)
        batch_op.drop_column("interviewee_role")
