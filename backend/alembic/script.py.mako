"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade() -> None:
    op.execute("""
        INSERT OR IGNORE INTO sites (id, name, slug, module, is_active)
        VALUES ('site-nkhockey', 'NK Hockey', 'nkhockey', 'nkhockey', 1)
    """)


def downgrade() -> None:
    op.execute("DELETE FROM sites WHERE slug = 'nkhockey'")
