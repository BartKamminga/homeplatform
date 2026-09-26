"""hockey_competitions.hl_comp_key (item 1178)

Het nieuwe hockey.nl match-center (24-09-2026) adresseert landelijke
competities met een string-id (#/competitions/national/nwwavznjsuechr) i.p.v.
het oude numerieke id. hl_comp_id blijft de sleutel binnen het platform (cmd-
params, item 1013-logica); hl_comp_key is alleen voor de navigatie van
Ghost/Scout. Wordt verder gevuld door get_competitions (koppeling via
poule_id) en get_competition_detail (data.id).

Seed: de keys van de landelijke competities die op 26-09-2026 een
hl_comp_id hadden, zodat de detail-scans direct na de deploy werken.
Alleen invullen waar nog leeg (create_all kan de kolom al hebben gemaakt).

Revision ID: b4d6f8a0c2e4
Revises: a3c5e7f9b1d3
Create Date: 2026-09-26
"""
from alembic import op
import sqlalchemy as sa

revision = "b4d6f8a0c2e4"
down_revision = "a3c5e7f9b1d3"
branch_labels = None
depends_on = None

_SEED = {
    19: "jfwuninpzwuzr",   # Landelijk Jongens O18
    20: "qfzinbtscywavw",  # Landelijk Meisjes O18
    21: "bvlojfclbfjsc",   # Landelijk Jongens O16
    22: "nwwavznjsuechr",  # Landelijk Meisjes O16
    5:  "vgqmuczxtwbqn",   # Overgangsklasse Heren
    6:  "gmkszrpatoply",   # Overgangsklasse Dames
}


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns("hockey_competitions")]
    if "hl_comp_key" not in columns:
        bind.execute(sa.text("ALTER TABLE hockey_competitions ADD COLUMN hl_comp_key VARCHAR"))
    bind.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_hockey_competitions_hl_comp_key ON hockey_competitions(hl_comp_key)"
    ))
    for hl_id, key in _SEED.items():
        bind.execute(
            sa.text("UPDATE hockey_competitions SET hl_comp_key = :key WHERE hl_comp_id = :hl_id AND hl_comp_key IS NULL"),
            {"key": key, "hl_id": hl_id},
        )


def downgrade():
    bind = op.get_bind()
    bind.execute(sa.text("DROP INDEX IF EXISTS ix_hockey_competitions_hl_comp_key"))
    op.drop_column("hockey_competitions", "hl_comp_key")
