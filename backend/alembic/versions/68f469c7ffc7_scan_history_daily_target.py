"""scan_history_daily: target_type/target_id (Bart, 07-09-2026: "als de
scan-queue is opgeruimd dan mist deze info?") - de per-competitie scan-
uitkomst in ScanStatsTab.jsx liep tot nu toe via een join naar VangerCmd,
dat net zo goed opgeruimd kan worden. Deze kolommen maken de uitkomst
permanent, onafhankelijk van de queue.

Revision ID: 68f469c7ffc7
Revises: d3e4f5a6b7c8
Create Date: 2026-09-07
"""
import sqlalchemy as sa
from alembic import op

revision = "68f469c7ffc7"
down_revision = "d3e4f5a6b7c8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_cols = {r[1] for r in bind.execute(sa.text("PRAGMA table_info(scan_history_daily)")).fetchall()}
    if "target_type" in existing_cols:
        return
    with op.batch_alter_table("scan_history_daily", recreate="always") as batch_op:
        batch_op.add_column(sa.Column("target_type", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("target_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_scan_history_daily_target_type", ["target_type"])
        batch_op.create_index("ix_scan_history_daily_target_id", ["target_id"])
        batch_op.drop_constraint("ux_scan_history_daily_date_reason_outcome", type_="unique")
        batch_op.create_unique_constraint(
            "ux_scan_history_daily_date_reason_outcome_target",
            ["date", "reason", "outcome", "target_type", "target_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    # Meerdere rijen kunnen inmiddels dezelfde (date,reason,outcome) delen
    # (verschillende target_id's) - eerst samenvoegen (som van count) vóórdat
    # de oude, striktere 3-kolom-unique-constraint teruggezet wordt, anders
    # faalt de tabel-recreate op een UNIQUE-constraint-violation.
    bind.execute(sa.text(
        "CREATE TABLE scan_history_daily_collapsed AS "
        "SELECT date, reason, outcome, SUM(count) AS count "
        "FROM scan_history_daily GROUP BY date, reason, outcome"
    ))
    bind.execute(sa.text("DELETE FROM scan_history_daily"))
    bind.execute(sa.text(
        "INSERT INTO scan_history_daily (date, reason, outcome, count) "
        "SELECT date, reason, outcome, count FROM scan_history_daily_collapsed"
    ))
    bind.execute(sa.text("DROP TABLE scan_history_daily_collapsed"))
    with op.batch_alter_table("scan_history_daily", recreate="always") as batch_op:
        batch_op.drop_constraint("ux_scan_history_daily_date_reason_outcome_target", type_="unique")
        batch_op.create_unique_constraint(
            "ux_scan_history_daily_date_reason_outcome", ["date", "reason", "outcome"],
        )
        batch_op.drop_index("ix_scan_history_daily_target_id")
        batch_op.drop_index("ix_scan_history_daily_target_type")
        batch_op.drop_column("target_id")
        batch_op.drop_column("target_type")
