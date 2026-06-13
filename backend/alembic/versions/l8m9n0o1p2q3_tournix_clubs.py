"""tournix clubs + location_club_id + club_id on team/field + unique names

Revision ID: l8m9n0o1p2q3
Revises: k7l8m9n0o1p2
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa

revision = "l8m9n0o1p2q3"
down_revision = "k7l8m9n0o1p2"
branch_labels = None
depends_on = None

CLUBS = [
    ("HH11AR3", "Amsterdam",        "AMS", "Amsterdam", None),
    ("HH11AV1", "Apeldoorn",        "APD", "Apeldoorn", None),
    ("HH11BL4", "Bennebroek",       "BEN", "Bennebroek", None),
    ("HH11BW1", "Bloemendaal",      "BLD", "Bloemendaal", None),
    ("HH11CC4", "Breda",            "BRD", "Breda", None),
    ("HH11CJ3", "Cartouche",        "CAR", "Den Haag", None),
    ("HH11CQ2", "Craeyenhout",      "CRA", "Wassenaar", None),
    ("HH11FH8", "Fletiomare",       "FLE", "Utrecht", None),
    ("HH11FT2", "GHBS",             "GHB", "Haarlem", None),
    ("HH11FY7", "Gooische",         "GOO", "Hilversum", None),
    ("HH11GG4", "Groningen",        "GRO", "Groningen", None),
    ("HH11GQ4", "HBS",              "HBS", "Den Haag", None),
    ("HH11GW6", "HDM",              "HDM", "Den Haag", None),
    ("HH11HM9", "Den Bosch",        "DBS", "Den Bosch", None),
    ("HH11JQ3", "Huizen",           "HUI", "Huizen", None),
    ("HH11JR0", "Hurley",           "HUR", "Amsterdam", None),
    ("HH11JV8", "Kampong",          "KAM", "Utrecht", None),
    ("HH11KB1", "Klein Zwitserland","KZW", "Den Haag", None),
    ("HH11KJ7", "Leeuwarden",       "LEE", "Leeuwarden", None),
    ("HH11KK4", "Leiden",           "LEI", "Leiden", None),
    ("HH11KW8", "Maarssen",         "MAR", "Maarssen", None),
    ("HH11LG9", "MEP",              "MEP", "Amsterdam", None),
    ("HH11LR6", "MOP",              "MOP", "Monnickendam", None),
    ("HH11LW1", "Naarden",          "NAA", "Naarden", None),
    ("HH11MG2", "Nijmegen",         "NMG", "Nijmegen", None),
    ("HH11MV7", "Phoenix",          "PHO", "Schiedam", None),
    ("HH11MW4", "Pinoke",           "PIN", "Amsterdam", None),
    ("HH11NC7", "Push",             "PSH", "Nijmegen", None),
    ("HH11NT6", "Rood-Wit",         "R-W", "Amsterdam", None),
    ("HH11NV0", "Roomburg",         "ROO", "Leiden", None),
    ("HH11NX4", "Rotterdam",        "ROT", "Rotterdam", None),
    ("HH11PC3", "Schaerweijde",     "SCH", "Zeist", None),
    ("HH11PD0", "SCHC",             "SHC", "Bilthoven", None),
    ("HH11PQ1", "Spandersbosch",    "SPA", "Hilversum", None),
    ("HH11QP7", "Upward",           "UPW", "Amsterdam", None),
    ("HH11QW6", "Victoria",         "VIC", "Rotterdam", None),
    ("LV95KY6", "AthenA",           "ATH", "Amsterdam", None),
    ("MJ56BV2", "Tilburg",          "TIL", "Tilburg", None),
    ("MK12LJ1", "Zwolle",           "ZWO", "Zwolle", None),
    ("MK22GS0", "Oranje-Rood",      "O-R", "Eindhoven", None),
    ("MK27FS2", "Delta Venlo",      "DEL", "Venlo", None),
]


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    # Create tournix_clubs table
    if "tournix_clubs" not in tables:
        op.create_table(
            "tournix_clubs",
            sa.Column("id",                      sa.String(), primary_key=True),
            sa.Column("name",                    sa.String(), nullable=False, unique=True),
            sa.Column("abbreviation",            sa.String(), nullable=True),
            sa.Column("city",                    sa.String(), nullable=True),
            sa.Column("color",                   sa.String(), nullable=True),
            sa.Column("federation_reference_id", sa.String(), nullable=True),
        )

    # Add location_club_id to tournix_tournaments
    tournament_cols = [c["name"] for c in inspector.get_columns("tournix_tournaments")]
    if "location_club_id" not in tournament_cols:
        op.add_column("tournix_tournaments",
            sa.Column("location_club_id", sa.String(), nullable=True))

    # Add club_id to tournix_teams
    team_cols = [c["name"] for c in inspector.get_columns("tournix_teams")]
    if "club_id" not in team_cols:
        op.add_column("tournix_teams",
            sa.Column("club_id", sa.String(), nullable=True))

    # Add club_id to tournix_fields
    field_cols = [c["name"] for c in inspector.get_columns("tournix_fields")]
    if "club_id" not in field_cols:
        op.add_column("tournix_fields",
            sa.Column("club_id", sa.String(), nullable=True))

    # Seed clubs (skip if already present)
    import uuid
    clubs_tbl = sa.table("tournix_clubs",
        sa.column("id"),
        sa.column("name"),
        sa.column("abbreviation"),
        sa.column("city"),
        sa.column("color"),
        sa.column("federation_reference_id"),
    )
    existing = {row[0] for row in bind.execute(sa.text("SELECT name FROM tournix_clubs"))}
    rows = []
    for fed_id, name, abbr, city, color in CLUBS:
        if name not in existing:
            rows.append({
                "id": str(uuid.uuid4()),
                "name": name,
                "abbreviation": abbr,
                "city": city,
                "color": color,
                "federation_reference_id": fed_id,
            })
    if rows:
        op.bulk_insert(clubs_tbl, rows)


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    field_cols = [c["name"] for c in inspector.get_columns("tournix_fields")]
    if "club_id" in field_cols:
        op.drop_column("tournix_fields", "club_id")

    team_cols = [c["name"] for c in inspector.get_columns("tournix_teams")]
    if "club_id" in team_cols:
        op.drop_column("tournix_teams", "club_id")

    tournament_cols = [c["name"] for c in inspector.get_columns("tournix_tournaments")]
    if "location_club_id" in tournament_cols:
        op.drop_column("tournix_tournaments", "location_club_id")

    tables = inspector.get_table_names()
    if "tournix_clubs" in tables:
        op.drop_table("tournix_clubs")
