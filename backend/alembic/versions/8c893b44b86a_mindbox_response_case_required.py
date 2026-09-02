"""mindbox_responses.case_id verplicht maken (losse responses zijn niet relevant, item 1051)

Revision ID: 8c893b44b86a
Revises: aca46cddd041
Create Date: 2026-09-02
"""
import sqlalchemy as sa
from alembic import op

revision = "8c893b44b86a"
down_revision = "aca46cddd041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    # Bestaande case-loze responses (Fase 1, nog geen echt gebruik) opruimen
    # voordat de kolom NOT NULL wordt - eerst de bronvermelding-koppelingen,
    # dan de responses zelf, voor FK-veiligheid.
    bind.execute(sa.text(
        "DELETE FROM mindbox_response_sources WHERE response_id IN "
        "(SELECT id FROM mindbox_responses WHERE case_id IS NULL)"
    ))
    bind.execute(sa.text("DELETE FROM mindbox_responses WHERE case_id IS NULL"))

    with op.batch_alter_table("mindbox_responses") as batch_op:
        batch_op.alter_column("case_id", existing_type=sa.String(), nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("mindbox_responses") as batch_op:
        batch_op.alter_column("case_id", existing_type=sa.String(), nullable=True)
