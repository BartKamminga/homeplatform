"""roadmap english status, priority and risk column

Revision ID: q3r4s5t6u7v8
Revises: p2q3r4s5t6u7
Create Date: 2026-06-13

"""
from alembic import op

revision = "q3r4s5t6u7v8"
down_revision = "p2q3r4s5t6u7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE roadmap_items SET status = 'idea'     WHERE status = 'idee'")
    op.execute("UPDATE roadmap_items SET status = 'analyzed' WHERE status = 'geanalyseerd'")
    op.execute("UPDATE roadmap_items SET status = 'pick_up'  WHERE status = 'pak_op'")
    op.execute("UPDATE roadmap_items SET status = 'ready'    WHERE status = 'gereed'")
    op.execute("UPDATE roadmap_items SET status = 'done'     WHERE status = 'klaar'")

    op.execute("UPDATE roadmap_items SET priority = 'high'   WHERE priority = 'hoog'")
    op.execute("UPDATE roadmap_items SET priority = 'medium' WHERE priority IN ('midden', 'middel')")
    op.execute("UPDATE roadmap_items SET priority = 'low'    WHERE priority = 'laag'")

    op.execute("UPDATE roadmap_items SET impact = 'low'    WHERE impact = 'laag'")
    op.execute("UPDATE roadmap_items SET impact = 'medium' WHERE impact IN ('midden', 'middel')")
    op.execute("UPDATE roadmap_items SET impact = 'high'   WHERE impact = 'hoog'")

    op.execute("ALTER TABLE roadmap_items RENAME COLUMN risico TO risk")

    op.execute("UPDATE roadmap_items SET risk = 'low'    WHERE risk = 'laag'")
    op.execute("UPDATE roadmap_items SET risk = 'medium' WHERE risk IN ('midden', 'middel')")
    op.execute("UPDATE roadmap_items SET risk = 'high'   WHERE risk = 'hoog'")


def downgrade() -> None:
    op.execute("UPDATE roadmap_items SET status = 'idee'         WHERE status = 'idea'")
    op.execute("UPDATE roadmap_items SET status = 'geanalyseerd' WHERE status = 'analyzed'")
    op.execute("UPDATE roadmap_items SET status = 'pak_op'       WHERE status = 'pick_up'")
    op.execute("UPDATE roadmap_items SET status = 'gereed'       WHERE status = 'ready'")
    op.execute("UPDATE roadmap_items SET status = 'klaar'        WHERE status = 'done'")

    op.execute("UPDATE roadmap_items SET priority = 'hoog'   WHERE priority = 'high'")
    op.execute("UPDATE roadmap_items SET priority = 'midden' WHERE priority = 'medium'")
    op.execute("UPDATE roadmap_items SET priority = 'laag'   WHERE priority = 'low'")

    op.execute("UPDATE roadmap_items SET impact = 'laag'   WHERE impact = 'low'")
    op.execute("UPDATE roadmap_items SET impact = 'midden' WHERE impact = 'medium'")
    op.execute("UPDATE roadmap_items SET impact = 'hoog'   WHERE impact = 'high'")

    op.execute("UPDATE roadmap_items SET risk = 'laag'   WHERE risk = 'low'")
    op.execute("UPDATE roadmap_items SET risk = 'midden' WHERE risk = 'medium'")
    op.execute("UPDATE roadmap_items SET risk = 'hoog'   WHERE risk = 'high'")

    op.execute("ALTER TABLE roadmap_items RENAME COLUMN risk TO risico")
