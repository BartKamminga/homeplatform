"""changelog_admin_system

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-06-10

"""
from alembic import op
import uuid
from datetime import datetime

revision = 'i9j0k1l2m3n4'
down_revision = 'h8i9j0k1l2m3'
branch_labels = None
depends_on = None

RELEASED = '2026-06-10T00:00:00'


def upgrade() -> None:
    now = datetime.utcnow().isoformat()

    # Admin v0.1 — eerste admin-specifieke changelog
    op.execute(
        f"INSERT INTO changelog (id, version, site, title, description, released_at, created_at) "
        f"VALUES ('{uuid.uuid4()}', '0.1', 'admin', "
        f"'Systeem en API statistieken', "
        f"'Nieuw: Systeem pagina met volledig platformoverzicht — omgeving, versie, DB-revisie, "
        f"Sentry-status, gebruikers, groepen, sites, tabelgroottes en recente activiteit. "
        f"Nieuw: API statistieken pagina met call-teller per endpoint, methode-kleurcodering "
        f"en optionele auto-refresh elke 5 seconden.', "
        f"'{RELEASED}', '{now}')"
    )

    # Core v0.6 — systeem overzicht en API stats endpoints
    op.execute(
        f"INSERT INTO changelog (id, version, site, title, description, released_at, created_at) "
        f"VALUES ('{uuid.uuid4()}', '0.6', 'core', "
        f"'Admin systeem- en statistieken endpoints', "
        f"'Nieuw: GET /api/admin/system/overview — geeft omgeving, gebruikers/groepen, sites, "
        f"tabelrijen en recente audit-log terug. "
        f"Nieuw: GET /api/admin/api-stats — call-teller per endpoint bijgehouden in werkgeheugen "
        f"via HTTP-middleware, reset bij herstart. "
        f"Backend versie bijgewerkt naar 0.6.', "
        f"'{RELEASED}', '{now}')"
    )


def downgrade() -> None:
    op.execute("DELETE FROM changelog WHERE site = 'admin' AND version = '0.1'")
    op.execute("DELETE FROM changelog WHERE site = 'core' AND version = '0.6'")
