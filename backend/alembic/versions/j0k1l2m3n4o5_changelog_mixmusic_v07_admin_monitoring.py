"""changelog_mixmusic_v07_admin_monitoring

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-06-10

"""
from alembic import op
import uuid
from datetime import datetime

revision = 'j0k1l2m3n4o5'
down_revision = 'i9j0k1l2m3n4'
branch_labels = None
depends_on = None

RELEASED = '2026-06-10T00:00:00'


def upgrade() -> None:
    now = datetime.utcnow().isoformat()

    # MixMusic v0.7
    op.execute(
        f"INSERT INTO changelog (id, version, site, title, description, released_at, created_at) "
        f"VALUES ('{uuid.uuid4()}', '0.7', 'mixmusic', "
        f"'Tijdlijn als voortgangsbalk', "
        f"'Voortgangsbalk verplaatst van de transportbalk naar de hartjes-tijdlijn. "
        f"Tijdlijn is klikbaar om naar dat moment te springen. "
        f"Huidige positie en totaalduur getoond boven de tijdlijn. "
        f"Helptekst verdwijnt automatisch na 2 seconden. "
        f"Aantal hartjes per nummer zichtbaar in de tracklijst.', "
        f"'{RELEASED}', '{now}')"
    )

    # Admin v0.2 — beheer & links pagina + home knop
    op.execute(
        f"INSERT INTO changelog (id, version, site, title, description, released_at, created_at) "
        f"VALUES ('{uuid.uuid4()}', '0.2', 'admin', "
        f"'Beheer & links + home knop', "
        f"'Nieuw: Beheer & links pagina met snelle toegang tot GlitchTip, NAS Synology DSM, "
        f"API documentatie en andere beheerpagina''s. "
        f"Links worden automatisch herleid uit de server-configuratie (SENTRY_DSN, NAS_URL). "
        f"Home knop linksboven in de navigatie om terug naar de startpagina te gaan.', "
        f"'{RELEASED}', '{now}')"
    )

    # Core v0.7 — heart_count in metas endpoint + NAS_URL instelling
    op.execute(
        f"INSERT INTO changelog (id, version, site, title, description, released_at, created_at) "
        f"VALUES ('{uuid.uuid4()}', '0.7', 'core', "
        f"'Heart counts in metas, NAS_URL instelling', "
        f"'GET /api/mixmusic/metas geeft nu ook heart_count per track terug. "
        f"Nieuwe NAS_URL instelling in .env voor de Synology beheer-link. "
        f"Systeem-overzicht bevat nu een links-sectie met GlitchTip en NAS URLs.', "
        f"'{RELEASED}', '{now}')"
    )


def downgrade() -> None:
    op.execute("DELETE FROM changelog WHERE site = 'mixmusic' AND version = '0.7'")
    op.execute("DELETE FROM changelog WHERE site = 'admin' AND version = '0.2'")
    op.execute("DELETE FROM changelog WHERE site = 'core' AND version = '0.7'")
