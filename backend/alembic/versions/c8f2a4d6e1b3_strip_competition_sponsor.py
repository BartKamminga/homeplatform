"""sponsornaam van competitienamen afhalen + teamcategorie rechtzetten

Revision ID: c8f2a4d6e1b3
Revises: b5e7a9c2d4f6
Create Date: 2026-10-09

Item 1252: hockey.nl zet sinds 09-2026 een sponsornaam voor sommige
competitienamen ("HelloFresh Meisjes O18 3e klasse"). Die naam stond ook in
de external_id. De vanger haalt de sponsor er nu af voordat hij een rij zoekt,
dus de bestaande rijen moeten in dezelfde release mee: anders vindt de
volgende scan ze niet meer, maakt een nieuwe rij en verhuizen de poules weg
van hun publicatie. Hernoemen gebeurt in place (id blijft gelijk, dus poules,
publicatie-koppelingen en flags blijven hangen). Bestaat de naam zonder
sponsor al, dan worden poules, publicatie-koppelingen, flags en hl_comp_id
naar die rij verplaatst en vervalt de sponsor-rij.

Item 1253: _derive_category keek naar het begin van de volledige teamnaam
(clubnaam), waardoor bv. "HIC MO18-1" als Senioren werd opgeslagen. Alleen
duidelijke gevallen rechtzetten: jeugdcode in de naam maar niet Junioren.

Idempotent.
"""
import re

from alembic import op
import sqlalchemy as sa

revision = "c8f2a4d6e1b3"
down_revision = "b5e7a9c2d4f6"
branch_labels = None
depends_on = None

# Gelijk aan DEFAULT_COMPETITION_SPONSOR_PREFIXES in services/hockey_vanger_settings.py
SPONSOR_PREFIXES = ["HelloFresh", "Staatsloterij"]
JUNIOR_RE = re.compile(r"(?:^|\s)[zZ]?[JjMm][OoZz]\d")
SENIOR_RE = re.compile(r"(?:^|\s)[zZ]?(?:[HhDd]\d|Heren\b|Dames\b)")


def _strip(name):
    for prefix in SPONSOR_PREFIXES:
        if name and name.lower().startswith(prefix.lower() + " "):
            return name[len(prefix):].strip()
    return name


def _merge(bind, tables, dup_id, keep_id):
    for table in ("hockey_poules", "data_shape_flags"):
        if table in tables:
            bind.execute(sa.text("UPDATE " + table + " SET competition_id = :keep WHERE competition_id = :dup"),
                         {"keep": keep_id, "dup": dup_id})
    links = bind.execute(sa.text(
        "SELECT id, publication_id FROM hockey_publication_comps WHERE competition_id = :dup"
    ), {"dup": dup_id}).fetchall() if "hockey_publication_comps" in tables else []
    for link_id, pub_id in links:
        already = bind.execute(sa.text(
            "SELECT id FROM hockey_publication_comps WHERE competition_id = :keep AND publication_id = :pub"
        ), {"keep": keep_id, "pub": pub_id}).first()
        if already:
            bind.execute(sa.text("DELETE FROM hockey_publication_comp_tags WHERE comp_link_id = :id"), {"id": link_id})
            bind.execute(sa.text("DELETE FROM hockey_publication_comps WHERE id = :id"), {"id": link_id})
        else:
            bind.execute(sa.text("UPDATE hockey_publication_comps SET competition_id = :keep WHERE id = :id"),
                         {"keep": keep_id, "id": link_id})
    dup = bind.execute(sa.text("SELECT hl_comp_id, hl_comp_key FROM hockey_competitions WHERE id = :id"),
                       {"id": dup_id}).first()
    keep = bind.execute(sa.text("SELECT hl_comp_id FROM hockey_competitions WHERE id = :id"),
                        {"id": keep_id}).first()
    bind.execute(sa.text("DELETE FROM hockey_competitions WHERE id = :id"), {"id": dup_id})
    if dup and dup[0] is not None and keep and keep[0] is None:
        bind.execute(sa.text("UPDATE hockey_competitions SET hl_comp_id = :hl, hl_comp_key = :key WHERE id = :id"),
                     {"hl": dup[0], "key": dup[1], "id": keep_id})


def _strip_competitions(bind, tables):
    rows = bind.execute(sa.text(
        "SELECT id, name, class_name, district, season FROM hockey_competitions"
    )).fetchall()
    for comp_id, name, class_name, district, season in rows:
        new_name = _strip(name)
        if new_name == name:
            continue
        new_ext = new_name + "|" + (class_name or "") + "|" + (district or "") + "|" + season
        existing = bind.execute(sa.text("SELECT id FROM hockey_competitions WHERE external_id = :ext"),
                                {"ext": new_ext}).first()
        if existing and existing[0] != comp_id:
            _merge(bind, tables, comp_id, existing[0])
        else:
            bind.execute(sa.text("UPDATE hockey_competitions SET name = :name, external_id = :ext WHERE id = :id"),
                         {"name": new_name, "ext": new_ext, "id": comp_id})


def _fix_team_categories(bind):
    rows = bind.execute(sa.text("SELECT id, name, category_group_name FROM hockey_teams")).fetchall()
    for team_id, name, category in rows:
        if JUNIOR_RE.search(name or "") and category in ("Senioren", "", None):
            new_category = "Junioren"
        elif SENIOR_RE.search(name or "") and category in ("", None):
            new_category = "Senioren"
        else:
            continue
        bind.execute(sa.text("UPDATE hockey_teams SET category_group_name = :c WHERE id = :id"),
                     {"c": new_category, "id": team_id})


def upgrade():
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    if "hockey_competitions" in tables:
        _strip_competitions(bind, tables)
    if "hockey_teams" in tables:
        _fix_team_categories(bind)


def downgrade():
    pass
