"""changelog_layouts_release

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-06-10

"""
from alembic import op
import uuid
from datetime import datetime

revision = 'h8i9j0k1l2m3'
down_revision = 'g7h8i9j0k1l2'
branch_labels = None
depends_on = None

RELEASED = '2026-06-10T00:00:00'


def upgrade() -> None:
    now = datetime.utcnow().isoformat()

    # Core v0.5
    op.execute(
        f"INSERT INTO changelog (id, version, site, title, description, released_at, created_at) "
        f"VALUES ('{uuid.uuid4()}', '0.5', 'core', "
        f"'Refactoring en paginering', "
        f"'Service-laag voor mixmusic en dontforget. "
        f"Centrale foutafhandeling via AppError. "
        f"Configuratie via Pydantic BaseSettings. "
        f"Paginering op audit log en tracks endpoint. "
        f"Audit log uitgebreid met taak- en hartjes-acties.', "
        f"'{RELEASED}', '{now}')"
    )

    # MixMusic v0.6
    op.execute(
        f"INSERT INTO changelog (id, version, site, title, description, released_at, created_at) "
        f"VALUES ('{uuid.uuid4()}', '0.6', 'mixmusic', "
        f"'Layouts en laadanimaties', "
        f"'3 desktop layouts (Standaard, Breed, Horizontaal) en 3 mobiele layouts "
        f"(Gestapeld, Tabs, Sheet) instelbaar via de instellingen. "
        f"Laadanimaties bij het ophalen van tracks en metadata. "
        f"Mobiele tab-navigatie en schuifpaneel voor betere telefoonervaring.', "
        f"'{RELEASED}', '{now}')"
    )


def downgrade() -> None:
    op.execute("DELETE FROM changelog WHERE site = 'core' AND version = '0.5'")
    op.execute("DELETE FROM changelog WHERE site = 'mixmusic' AND version = '0.6'")
