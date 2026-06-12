"""roadmap_items table

Revision ID: f2g3h4i5j6k7
Revises: e1f2g3h4i5j6
Create Date: 2026-06-12
"""
from alembic import op
import sqlalchemy as sa

revision = "f2g3h4i5j6k7"
down_revision = "e1f2g3h4i5j6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "roadmap_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("site", sa.String(), nullable=False, server_default="platform"),
        sa.Column("priority", sa.String(), nullable=False, server_default="midden"),
        sa.Column("status", sa.String(), nullable=False, server_default="idee"),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    # Migrate existing roadmap items
    from datetime import datetime
    now = datetime.utcnow().isoformat()
    op.execute(f"""INSERT INTO roadmap_items (title, site, priority, status, notes, created_at, updated_at)
        VALUES
        ("Back-button in mobile gestapelde modus", "mixmusic", "midden", "idee", NULL, "{now}", "{now}"),
        ("Per-user settings met centrale merge", "mixmusic", "hoog", "idee", NULL, "{now}", "{now}"),
        ("Waveform tonen", "mixmusic", "laag", "idee", NULL, "{now}", "{now}"),
        ("Alle settings werkend maken", "dontforget", "midden", "idee", NULL, "{now}", "{now}"),
        ("Koppeling platform snel task toevoegen", "dontforget", "hoog", "idee", NULL, "{now}", "{now}"),
        ("CSS consolidatie DontForget naar platform tokens", "platform", "hoog", "in_progress", "Aliassen ingezet, aliases lossen var() fallbacks op in gedeelde componenten", "{now}", "{now}"),
        ("Responsive design alle apps", "platform", "hoog", "in_progress", NULL, "{now}", "{now}"),
        ("Tournix stages: inregel/test/productie", "tournix", "hoog", "idee", NULL, "{now}", "{now}"),
        ("Tournix tijdreizen: snapshots per ronde", "tournix", "midden", "idee", NULL, "{now}", "{now}"),
        ("Externe toegang via DDNS", "platform", "laag", "idee", NULL, "{now}", "{now}")
    """)


def downgrade():
    op.drop_table("roadmap_items")
