"""backfill_nkhockey_mixmusic_icons

Revision ID: 49140235b270
Revises: 0289f61e20a4
Create Date: 2026-08-28 08:00:00.000000

"""

from alembic import op

revision = "49140235b270"
down_revision = "0289f61e20a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # item 995: verplaatst uit 262247a3a1b0_mixmusic_site_init.py - daar
    # draaiden deze UPDATEs vóór 040802d331e2 (add_icon_to_sites) de kolom
    # uberhaupt toevoegde, wat een verse database liet falen op
    # "no such column: icon". Hier, ná die kolom bestaat, wel veilig.
    # Idempotent (UPDATE ... WHERE slug = X) - geen effect op acc/prod waar
    # de kolom al (buiten alembic om) een waarde had.
    op.execute("UPDATE sites SET icon = '🏑' WHERE slug = 'nkhockey'")
    op.execute("UPDATE sites SET icon = '♫' WHERE slug = 'mixmusic'")


def downgrade() -> None:
    op.execute("UPDATE sites SET icon = NULL WHERE slug IN ('nkhockey', 'mixmusic')")
