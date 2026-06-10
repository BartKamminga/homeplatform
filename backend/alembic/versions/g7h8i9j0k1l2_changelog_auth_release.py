"""changelog_auth_release

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Create Date: 2026-06-10

"""
from alembic import op
import uuid
from datetime import datetime

revision = 'g7h8i9j0k1l2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None

RELEASED = '2026-06-10T00:00:00'


def upgrade() -> None:
    now = datetime.utcnow().isoformat()

    # Core / backend v0.4
    op.execute(
        f"INSERT INTO changelog (id, version, site, title, description, released_at, created_at) "
        f"VALUES ('{uuid.uuid4()}', '0.4', 'core', "
        f"'Universele login en site-toegang', "
        f"'Elke site vereist inloggen. Admin kan per site instellen welke groepen toegang hebben. "
        f"Sessie verlopen stuurt terug naar de originele pagina. "
        f"Backend logt alle API verzoeken met methode, pad, status en duur.', "
        f"'{RELEASED}', '{now}')"
    )

    # DontForget v1.0
    op.execute(
        f"INSERT INTO changelog (id, version, site, title, description, released_at, created_at) "
        f"VALUES ('{uuid.uuid4()}', '1.0', 'dontforget', "
        f"'Inline login en groepstoegang', "
        f"'Login scherm direct in de app zonder redirect naar admin. "
        f"Toegang instelbaar per groep via de admin omgeving. "
        f"Geen toegang scherm als account niet is toegewezen aan DontForget.', "
        f"'{RELEASED}', '{now}')"
    )

    # MixMusic v0.5
    op.execute(
        f"INSERT INTO changelog (id, version, site, title, description, released_at, created_at) "
        f"VALUES ('{uuid.uuid4()}', '0.5', 'mixmusic', "
        f"'Eerste release met metadata en login', "
        f"'Inloggen vereist. Vriendelijke naam, genre, beoordeling en moment per nummer. "
        f"Favoriete momenten markeren met een hartje en terugzien in tijdlijn. "
        f"Instellingen scherm met genre beheer, profiel en thema. "
        f"Hart knop naast de tracknaam voor snel markeren.', "
        f"'{RELEASED}', '{now}')"
    )


def downgrade() -> None:
    op.execute("DELETE FROM changelog WHERE site = 'core' AND version = '0.4'")
    op.execute("DELETE FROM changelog WHERE site = 'dontforget' AND version = '1.0'")
    op.execute("DELETE FROM changelog WHERE site = 'mixmusic' AND version = '0.5'")
