"""Tournix — pools koppelen aan fases, Phase 1 auto-aanmaken voor bestaande toernooien

Revision ID: t6u7v8w9x0y1
Revises: s5t6u7v8w9x0
Create Date: 2026-06-14
"""

import uuid
from datetime import datetime

from alembic import op
import sqlalchemy as sa

revision = "t6u7v8w9x0y1"
down_revision = "s5t6u7v8w9x0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tournix_pools", sa.Column("phase_id", sa.String(), nullable=True))
    op.create_index("ix_tournix_pools_phase_id", "tournix_pools", ["phase_id"])

    conn = op.get_bind()

    # Auto-create Phase 1 for every tournament that has pools but no phases yet
    tournaments = conn.execute(sa.text("SELECT id FROM tournix_tournaments")).fetchall()
    for (tid,) in tournaments:
        has_pools = conn.execute(
            sa.text("SELECT COUNT(*) FROM tournix_pools WHERE tournament_id = :tid"),
            {"tid": tid}
        ).scalar()
        if not has_pools:
            continue

        has_phases = conn.execute(
            sa.text("SELECT COUNT(*) FROM tournix_phases WHERE tournament_id = :tid"),
            {"tid": tid}
        ).scalar()
        if has_phases:
            continue

        phase_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        conn.execute(sa.text(
            "INSERT INTO tournix_phases (id, tournament_id, name, \"order\", phase_type, created_at)"
            " VALUES (:id, :tid, :name, 0, :ptype, :created_at)"
        ), {"id": phase_id, "tid": tid, "name": "Poule fase", "ptype": "pool", "created_at": now})

        conn.execute(sa.text(
            "UPDATE tournix_pools SET phase_id = :pid WHERE tournament_id = :tid"
        ), {"pid": phase_id, "tid": tid})

        conn.execute(sa.text(
            "UPDATE tournix_matches SET phase_id = :pid"
            " WHERE tournament_id = :tid AND phase_id IS NULL"
        ), {"pid": phase_id, "tid": tid})


def downgrade():
    op.drop_index("ix_tournix_pools_phase_id", "tournix_pools")
    op.drop_column("tournix_pools", "phase_id")
