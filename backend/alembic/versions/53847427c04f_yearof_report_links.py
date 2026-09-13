"""yearof report links (generic, replaces insta_url/youtube_url/youtube_urls)

Revision ID: 53847427c04f
Revises: 51ac5b6e53e2
Create Date: 2026-09-13 00:00:00.000000

"""
import uuid

from alembic import op
import sqlalchemy as sa

revision = "53847427c04f"
down_revision = "51ac5b6e53e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "yearof_report_links" not in inspector.get_table_names():
        op.create_table(
            "yearof_report_links",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("report_id", sa.String(), nullable=False),
            sa.Column("link_type", sa.String(), nullable=False),
            sa.Column("url", sa.String(), nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("sort_order", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["report_id"], ["yearof_reports.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_yearof_report_links_report_id"), "yearof_report_links", ["report_id"])

    # Data migreren uit de oude losse velden, als die nog bestaan.
    report_cols = {c["name"] for c in inspector.get_columns("yearof_reports")}
    if "insta_url" in report_cols:
        rows = bind.execute(sa.text(
            "SELECT id, insta_url, youtube_url, youtube_urls FROM yearof_reports "
            "WHERE insta_url IS NOT NULL OR youtube_url IS NOT NULL OR youtube_urls IS NOT NULL"
        )).fetchall()
        for row in rows:
            order = 0
            if row.insta_url:
                bind.execute(sa.text(
                    "INSERT INTO yearof_report_links (id, report_id, link_type, url, note, sort_order) "
                    "VALUES (:id, :rid, 'instagram', :url, NULL, :ordr)"
                ), {"id": uuid.uuid4().hex, "rid": row.id, "url": row.insta_url, "ordr": order})
                order += 1
            if row.youtube_url:
                bind.execute(sa.text(
                    "INSERT INTO yearof_report_links (id, report_id, link_type, url, note, sort_order) "
                    "VALUES (:id, :rid, 'video', :url, NULL, :ordr)"
                ), {"id": uuid.uuid4().hex, "rid": row.id, "url": row.youtube_url, "ordr": order})
                order += 1
            if row.youtube_urls:
                import json
                try:
                    urls = json.loads(row.youtube_urls)
                except (ValueError, TypeError):
                    urls = []
                for u in urls:
                    if not u:
                        continue
                    bind.execute(sa.text(
                        "INSERT INTO yearof_report_links (id, report_id, link_type, url, note, sort_order) "
                        "VALUES (:id, :rid, 'video', :url, NULL, :ordr)"
                    ), {"id": uuid.uuid4().hex, "rid": row.id, "url": u, "ordr": order})
                    order += 1


def downgrade() -> None:
    op.drop_index(op.f("ix_yearof_report_links_report_id"), table_name="yearof_report_links")
    op.drop_table("yearof_report_links")
