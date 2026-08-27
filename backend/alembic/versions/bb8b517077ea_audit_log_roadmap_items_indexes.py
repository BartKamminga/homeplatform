"""Items 855/856: index toevoegen op audit_log(site, created_at) en
roadmap_items(site, status, priority) - beide tabellen worden op precies die
kolommen gefilterd/gesorteerd zonder index, full table scan bij groei.

Revision ID: bb8b517077ea
Revises: 4ee191f78ad2
Create Date: 2026-08-27
"""
from alembic import op

revision = "bb8b517077ea"
down_revision = "4ee191f78ad2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index("ix_audit_log_site_created_at", "audit_log", ["site", "created_at"])
    op.create_index("ix_roadmap_items_site_status_priority", "roadmap_items", ["site", "status", "priority"])


def downgrade():
    op.drop_index("ix_roadmap_items_site_status_priority", table_name="roadmap_items")
    op.drop_index("ix_audit_log_site_created_at", table_name="audit_log")
