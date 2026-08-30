"""add scan history daily and vanger cmd reason

Revision ID: 53f5ec173030
Revises: 223a9f2c2fac
Create Date: 2026-08-30 15:28:45.427069

"""
from alembic import op
import sqlalchemy as sa


revision = '53f5ec173030'
down_revision = '223a9f2c2fac'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = {r[0] for r in bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()}

    if "scan_history_daily" not in existing_tables:
        # create_db_and_tables() (SQLModel create_all) draait bij backend-herstart
        # al vóór deze alembic-stap en heeft de tabel dan al aangemaakt.
        op.create_table(
            "scan_history_daily",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("date", sa.String(), nullable=False),
            sa.Column("reason", sa.String(), nullable=False),
            sa.Column("outcome", sa.String(), nullable=False),
            sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("date", "reason", "outcome", name="ux_scan_history_daily_date_reason_outcome"),
        )
        op.create_index("ix_scan_history_daily_date", "scan_history_daily", ["date"])
        op.create_index("ix_scan_history_daily_reason", "scan_history_daily", ["reason"])
        op.create_index("ix_scan_history_daily_outcome", "scan_history_daily", ["outcome"])

    # vanger_cmd_queue bestaat al langer - create_all voegt geen kolommen toe
    # aan bestaande tabellen, dus deze ALTER is wel altijd nodig (geen race).
    existing_cols = {r[1] for r in bind.execute(sa.text("PRAGMA table_info(vanger_cmd_queue)")).fetchall()}
    if "reason" not in existing_cols:
        op.add_column("vanger_cmd_queue", sa.Column("reason", sa.String(), nullable=True))
        op.create_index("ix_vanger_cmd_queue_reason", "vanger_cmd_queue", ["reason"])


def downgrade() -> None:
    op.drop_index("ix_vanger_cmd_queue_reason", table_name="vanger_cmd_queue")
    op.drop_column("vanger_cmd_queue", "reason")
    op.drop_index("ix_scan_history_daily_outcome", table_name="scan_history_daily")
    op.drop_index("ix_scan_history_daily_reason", table_name="scan_history_daily")
    op.drop_index("ix_scan_history_daily_date", table_name="scan_history_daily")
    op.drop_table("scan_history_daily")
