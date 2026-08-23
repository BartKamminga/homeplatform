"""agent-control: contexten + uitgebreide logging + poulebord ai_note

Revision ID: 16dd0b99986d
Revises: 638afef0f864
Create Date: 2026-08-23
"""
import sqlalchemy as sa
from alembic import op

revision = "16dd0b99986d"
down_revision = "638afef0f864"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = bind.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
    existing_tables = {r[0] for r in existing}
    existing_cols = {t: {c["name"] for c in sa.inspect(bind).get_columns(t)} for t in existing_tables}

    if "agent_contexts" not in existing_tables:
        # create_db_and_tables() (SQLModel create_all) draait bij backend-herstart
        # al vóór deze alembic-stap en kan de tabel dan al aangemaakt hebben.
        op.create_table(
            "agent_contexts",
            sa.Column("key",                 sa.Text(),     nullable=False),
            sa.Column("agent_key",           sa.Text(),     nullable=False),
            sa.Column("name",                sa.Text(),     nullable=False),
            sa.Column("pre_run_info",        sa.Text(),     nullable=False, server_default=""),
            sa.Column("post_process_action", sa.Text(),     nullable=False, server_default="none"),
            sa.Column("created_at",          sa.DateTime(), nullable=False),
            sa.Column("updated_at",          sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("key"),
        )

    # ALTER TABLE op bestaande tabellen - geen create_all-race hier, create_all
    # maakt geen kolommen aan op tabellen die al bestaan.
    if "ai_note" not in existing_cols.get("hockey_publication_comps", set()):
        op.add_column("hockey_publication_comps", sa.Column("ai_note", sa.Text(), nullable=True))

    if "agent_run_logs" in existing_cols:
        cols = existing_cols["agent_run_logs"]
        if "context_key" not in cols:
            op.add_column("agent_run_logs", sa.Column("context_key", sa.Text(), nullable=True))
        if "task_id" not in cols:
            op.add_column("agent_run_logs", sa.Column("task_id", sa.Integer(), nullable=True))
        if "input_payload" not in cols:
            op.add_column("agent_run_logs", sa.Column("input_payload", sa.Text(), nullable=False, server_default="{}"))
        if "post_process_result" not in cols:
            op.add_column("agent_run_logs", sa.Column("post_process_result", sa.Text(), nullable=False, server_default="{}"))

    if "agent_tasks" in existing_cols:
        cols = existing_cols["agent_tasks"]
        if "context_key" not in cols:
            op.add_column("agent_tasks", sa.Column("context_key", sa.Text(), nullable=True))
        if "params_json" not in cols:
            op.add_column("agent_tasks", sa.Column("params_json", sa.Text(), nullable=False, server_default="{}"))

    contexts = [
        (
            "hockey_scores", "hockey_scan", "Hockey: scores/standen ophalen",
            "Beschikbare cmd_type-waarden voor het cmds-veld: get_poule (params: team_id, poule_id), "
            "scan_club (params: external_id), get_clubs, get_competition_detail (params: comp_id), "
            "get_competitions. Antwoord met reasoning, notes (bijgewerkte kennis), notification (of null), "
            "en cmds - deze worden na dedup in de vanger_cmd_queue gezet.",
            "hockey_cmds",
        ),
        (
            "poulebord_win_analysis", "hockey_scan", "Poulebord: win-analyse per competitie",
            "Analyseer de meegegeven stand (agent_state.standings_by_poule) van de competitie en bepaal kort "
            "en bondig wat een team moet doen om (nog) te winnen. Antwoord met reasoning, notes, notification "
            "(of null), en note_text: een korte, leuke opmerking (max ~200 tekens) die op poulebord getoond "
            "wordt. link_id komt automatisch mee vanuit de taak-params, hoeft niet zelf herhaald te worden.",
            "poulebord_note",
        ),
        (
            "roadmap_preanalysis", "hockey_scan", "Roadmap: nieuwe items voor-analyseren",
            "Bekijk de meegegeven openstaande roadmap-items (agent_state.roadmap_idea_items) en analyseer er "
            "een: bepaal impact (op de gebruiker), risk en scope. Antwoord met reasoning, notes (korte "
            "onderbouwing), notification (of null), roadmap_item_id, impact, risk, scope. Dit landt als "
            "VOORSTEL - de status van het item blijft idea totdat een mens het bevestigt.",
            "roadmap_preanalysis",
        ),
    ]
    for key, agent_key, name, pre_run_info, action in contexts:
        exists = bind.execute(sa.text("SELECT 1 FROM agent_contexts WHERE key = :key"), {"key": key}).fetchone()
        if exists:
            continue
        bind.execute(
            sa.text(
                "INSERT INTO agent_contexts (key, agent_key, name, pre_run_info, post_process_action, created_at, updated_at) "
                "VALUES (:key, :agent_key, :name, :pre_run_info, :action, datetime('now'), datetime('now'))"
            ),
            {"key": key, "agent_key": agent_key, "name": name, "pre_run_info": pre_run_info, "action": action},
        )


def downgrade() -> None:
    op.drop_table("agent_contexts")
    with op.batch_alter_table("agent_tasks") as batch:
        batch.drop_column("params_json")
        batch.drop_column("context_key")
    with op.batch_alter_table("agent_run_logs") as batch:
        batch.drop_column("post_process_result")
        batch.drop_column("input_payload")
        batch.drop_column("task_id")
        batch.drop_column("context_key")
    with op.batch_alter_table("hockey_publication_comps") as batch:
        batch.drop_column("ai_note")
