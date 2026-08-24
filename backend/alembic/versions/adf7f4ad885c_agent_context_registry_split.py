"""agent-control: post_process_action splitsen in data_source_key + post_process_key (item 939)

Revision ID: adf7f4ad885c
Revises: 16dd0b99986d
Create Date: 2026-08-24
"""
import sqlalchemy as sa
from alembic import op

revision = "adf7f4ad885c"
down_revision = "16dd0b99986d"
branch_labels = None
depends_on = None

# Migreert de 3 bestaande contexten naar hun nieuwe (data_source_key, post_process_key)
# per de agent-registry in backend/services/agents/.
OLD_ACTION_TO_NEW = {
    "hockey_cmds":         ("vanger_queue_state", "hockey_cmds"),
    "poulebord_note":      ("poule_standings",     "poulebord_note"),
    "roadmap_preanalysis": ("idea_items",          "roadmap_preanalysis"),
}


def upgrade() -> None:
    bind = op.get_bind()
    cols = {c["name"] for c in sa.inspect(bind).get_columns("agent_contexts")}

    if "data_source_key" not in cols:
        op.add_column("agent_contexts", sa.Column("data_source_key", sa.Text(), nullable=False, server_default=""))
    if "post_process_key" not in cols:
        op.add_column("agent_contexts", sa.Column("post_process_key", sa.Text(), nullable=False, server_default="none"))

    if "post_process_action" in cols:
        rows = bind.execute(sa.text("SELECT key, post_process_action FROM agent_contexts")).fetchall()
        for key, old_action in rows:
            data_source_key, post_process_key = OLD_ACTION_TO_NEW.get(old_action, ("", "none"))
            bind.execute(
                sa.text("UPDATE agent_contexts SET data_source_key = :ds, post_process_key = :pp WHERE key = :key"),
                {"ds": data_source_key, "pp": post_process_key, "key": key},
            )
        with op.batch_alter_table("agent_contexts") as batch:
            batch.drop_column("post_process_action")


def downgrade() -> None:
    op.add_column("agent_contexts", sa.Column("post_process_action", sa.Text(), nullable=False, server_default="none"))
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT key, post_process_key FROM agent_contexts")).fetchall()
    for key, post_process_key in rows:
        bind.execute(
            sa.text("UPDATE agent_contexts SET post_process_action = :action WHERE key = :key"),
            {"action": post_process_key, "key": key},
        )
    with op.batch_alter_table("agent_contexts") as batch:
        batch.drop_column("post_process_key")
        batch.drop_column("data_source_key")
