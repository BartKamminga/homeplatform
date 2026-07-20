"""Seed bekende hockey-clubs (initiële lijst van hockey.nl)

Revision ID: 7q8r9s0t1u2v
Revises: 6p7q8r9s0t1u
Create Date: 2026-07-20
"""

from alembic import op
from datetime import datetime

revision = "7q8r9s0t1u2v"
down_revision = "6p7q8r9s0t1u"
branch_labels = None
depends_on = None

# Bekende clubs per 2026-07 (federation_reference_id, name, friendly_name, city)
CLUBS = [
    ("HH11AR3", "AH & BC",                              "Amsterdam",       "Amstelveen"),
    ("MG20CJ7", "AHC IJburg",                           "IJburg",          "Amsterdam"),
    ("HH11AJ7", "Alkmaarsche M.H.C.",                   "Alkmaar",         "Alkmaar"),
    ("HH11AM8", "Almeerse HC",                          "Almere",          "Almere"),
    ("HH11FG1", "A.M.H.C. F.I.T.",                     "FIT",             "Amsterdam"),
    ("HH11NT6", "A.M.H.C. Rood-Wit",                   "Rood-Wit",        "Aerdenhout"),
    ("MF15SY7", "AMHC Westerpark",                      "Westerpark",      "Amsterdam"),
    ("HH11AV1", "Apeldoornsche (M.H.C.)",               "Apeldoorn",       "Apeldoorn"),
    ("HH11AY2", "Arnhemsche H.C.",                      "Arnhem",          "Velp"),
    ("HH11QP7", "Arnhemse Mixed Hockey Club Upward",    "Upward",          "Arnhem"),
    ("HH11BC1", "Baarnse Mixed Hockey Vereniging",      "Baarn",           "Baarn"),
    ("HH11BP2", "Berkel en Rodenrijs",                  "Berkel-Rodenrijs","Berkel en Rodenrijs"),
    ("HH11BN8", "Berkel-Enschot",                       "Berkel-Enschot",  None),
    ("HH11CC4", "BH&BC Breda",                          "Breda",           "Breda"),
    ("HH11NC7", "B.H.V. Push",                          "Push",            "Breda"),
    ("HH11SL5", "B.N.M.H.C. Zwart-Wit",                "Zwart-Wit",       "Breda"),
    ("HH11CQ2", "Craeyenhout",                          "Craeyenhout",     "Den Haag"),
    ("HH11JY9", "De Kieviten",                          "Kieviten",        "Wassenaar"),
    ("HH11JP6", "D.H.C. Hudito",                        "HUDITO",          "Delft"),
    ("HH11DB0", "DHV",                                  "Deventer",        "Deventer"),
    ("HH11PG1", "DMHC Shinty",                          "Shinty",          "Driebergen-Rijsenburg"),
    ("HH11DX4", "EHV Enschede",                         "EHV",             "Enschede"),
    ("HH11FT2", "GHBS",                                 "GHBS",            "Groningen"),
    ("HH11FY7", "Gooische Hockey Club",                 "Gooische",        "Bussum"),
    ("HH11GB9", "Goudse MHC",                           "Gouda",           "Gouda"),
    ("HH11GW6", "Haagsche Delftsche Mixed",             "HDM",             "Den Haag"),
    ("HH11AN5", "HC Alphen",                            "Alphen",          "Alphen aan den Rijn"),
    ("LV95KY6", "HC Athena",                            "AthenA",          "Amsterdam"),
    ("HH11BW1", "HC Bloemendaal",                       "Bloemendaal",     "Bloemendaal"),
    ("MK27FS2", "HC Delta Venlo",                       "Delta Venlo",     "Venlo"),
    ("HH11CF5", "H.C. Eemvallei",                       "Eemvallei",       "Amersfoort"),
    ("HH11GK2", "H.C. Haarlem",                         "Haarlem",         "Haarlem"),
    ("HH11HJ8", "HC Helmond",                           "Helmond",         "Helmond"),
    ("HH11RZ0", "HC IJsseloever",                       "IJsseloever",     "IJsselstein"),
    ("MK22GS0", "HC Oranje Rood",                       "Oranje-Rood",     "Eindhoven"),
    ("MK23LM8", "HC Rijnvliet",                         "Rijnvliet",       "Utrecht"),
    ("MK23RH1", "HC Schiedam",                          "Schiedam",        "Schiedam"),
    ("MJ56BV2", "HC Tilburg",                           "Tilburg",         "Tilburg"),
    ("MK12LJ1", "HC Zwolle",                            "Zwolle",          "Zwolle"),
    ("HH11GX3", "HDS",                                  "HDS",             "Den Haag"),
    ("HH11HN6", "HGC",                                  "HGC",             "Wassenaar"),
    ("HH11HR4", "HMHC",                                 "Hilversum",       "Loosdrecht"),
    ("HH11AP9", "Hockeyclub Amersfoort",                "Amersfoort",      "Amersfoort"),
    ("HH11AS0", "Hockeyclub AMVJ",                      "AMVJ",            "Amstelveen"),
    ("HH11BF2", "Hockeyclub Barendrecht",               "Barendrecht",     "Barendrecht"),
    ("HH11GG4", "Hockeyclub Groningen",                 "Groningen",       "Haren gn"),
    ("HH11JL8", "Hockey Club Houten",                   "Houten",          "Houten"),
    ("HH11LW1", "Hockey Club Naarden",                  "Naarden",         "Naarden"),
    ("HH11NX4", "Hockey Club Rotterdam",                "Rotterdam",       "Rotterdam"),
    ("HH11HM9", "Hockeyclub 's-Hertogenbosch",          "Den Bosch",       "Den Bosch"),
    ("HH11QK2", "Hockey Club Uden",                     "Uden",            "Uden"),
    ("HH11RD6", "Hockeyclub VVV",                       "VVV",             "Amstelveen"),
    ("HH11JQ3", "Huizer HC",                            "Huizen",          "Naarden"),
    ("HH11JS7", "H.V.A.",                               "HVA (Assen)",     "Assen"),
    ("HH11LV4", "HV Myra",                              "Myra",            "Amstelveen"),
    ("HH11QW6", "HV Victoria",                          "Victoria",        "Rotterdam"),
    ("HH11RL2", "HV Weert",                             "Weert",           "Weert"),
    ("HH11RS1", "HV Westland",                          "Westland",        "Naaldwijk"),
    ("HH11KB1", "Klein Zwitserland, H.C. ",             "Klein Zwitserland","Den Haag"),
    ("HH11KG6", "Larensche Mixed Hockey Club",          "Laren",           "Laren nh"),
    ("HH11KK4", "Leidsche en Oegstgeester Hockeyclub (LOHC)", "Leiden",   "Oegstgeest"),
    ("HH11NV0", "Leidse Hockey Club Roomburg",          "Roomburg",        "Leiden"),
    ("HH11KT7", "Loenense MHC",                         "Loenen",          "Loenen aan de Vecht"),
    ("HH11AG6", "L.S.C. ALECTO",                        "Alecto",          "Leiderdorp"),
    ("HH11KX5", "Maastrichtse Hockey Club MHC",         "Maastricht",      "Maastricht"),
    ("HH11AK4", "MHC Alliance",                         "Alliance",        "Heemstede"),
    ("HH11BG9", "M.H.C. Barneveld",                     "Barneveld",       "Barneveld"),
    ("HH11BK7", "MHC Bemmel 800",                       "Bemmel",          "RESSEN"),
    ("HH11BL4", "MHC Bennebroek",                       "Bennebroek",      "Bennebroek"),
    ("HH11DF8", "MHC de Dommel",                        "Dommel",          "Sint-Michielsgestel"),
    ("HH11LJ0", "MHC De Mezen",                         "Mezen",           "Harderwijk"),
    ("HH11CX1", "MHC DES",                              "DES",             "Kaatsheuvel"),
    ("HH11RK5", "MHC De Warande",                       "Warande",         "Oosterhout"),
    ("HH11DS9", "MHC EDE",                              "Ede",             "Ede"),
    ("HH11FH8", "MHC Fletiomare",                       "Fletiomare",      "Utrecht"),
    ("HH11FL6", "MHC Forescate",                        "Forescate",       "Voorschoten"),
    ("HH11FX0", "M.H.C. Goirle",                        "Goirle",          "Goirle"),
    ("HH11GQ4", "MHCHBS",                               "HBS",             "Bloemendaal"),
    ("HH11KP9", "MHC Leusden",                          "Leusden",         "Stoutenburg"),
    ("HH11LG9", "M.H.C. M.E.P. (Mea Est Pila)",        "MEP",             "Boxtel"),
    ("HH11MN1", "M.H.C. Oosterbeek",                    "Oosterbeek",      "Oosterbeek"),
    ("HH11RM9", "M.H.C. Weesp",                         "Weesp",           "Weesp"),
    ("HH11RW9", "MHC Wijchen",                          "Wijchen",         "Wijchen"),
    ("HH11RV2", "MHC Woerden",                          "Woerden",         "Woerden"),
    ("HH11SK8", "MHCZutphen",                           "Zutphen",         "Zutphen"),
    ("HH11KW8", "MHV Maarssen",                         "Maarssen",        "Maarssen"),
    ("HH11KJ7", "Mixed Hockey Club Leeuwarden",         "Leeuwarden",      "Leeuwarden"),
    ("HH11SG0", "Mixed Hockeyclub Zoetermeer",          "Zoetermeer",      "Zoetermeer"),
    ("HH11QZ7", "MMHC Voordaan",                        "Voordaan",        "Groenekan"),
    ("HH11RX6", "NHC De IJssel",                        "IJssel",          "Nieuwerkerk aan den Ijssel"),
    ("HH11MG2", "NMHC Nijmegen",                        "Nijmegen",        "Nijmegen"),
    ("HH11LZ2", "Noordwijkse (H.C)",                    "Noordwijk",       "Noordwijk"),
    ("HH11CD1", "O.H.C. Bully",                         "Bully",           "Oldenzaal"),
    ("HH11MM4", "OMHC",                                 "Ommoord",         "Rotterdam"),
    ("HH11MQ2", "Oss (M.H.C.)",                         "Oss",             "Oss"),
    ("HH11MW4", "Pinoké",                          "Pinoké",     "Amstelveen"),
    ("HH11CP5", "R.H.C. Concordia",                     "Concordia",       "Roermond"),
    ("HH11KN5", "R.H.V. Leonidas",                      "Leonidas",        "Rotterdam"),
    ("HH11NY1", "Rijswijksche Hockey Club",             "Rijswijk",        "Rijswijk"),
    ("HH11NR2", "Ring Pass Delft",                      "Ring Pass",       "Delft"),
    ("HH11QN3", "R.K.H.V. Union",                       "Union",           "Malden"),
    ("HH11MT3", "RMHC de Pelikaan",                     "Pelikaan",        "Roosendaal"),
    ("HH11NW7", "Rosmalen",                              "Rosmalen",        "Rosmalen"),
    ("HH11PC3", "Schaerweijde",                          "Schaerweijde",    "Zeist"),
    ("HH11PD0", "Stichtsche Cricket & Hockey Club",     "SCHC",            "Bilthoven"),
    ("HH11JV8", "SV Kampong Hockey",                    "Kampong",         "Utrecht"),
    ("HH11MV7", "SV Phoenix",                           "Phoenix",         "Zeist"),
    ("HH11KF9", "THCC De Kromhouters",                  "Kromhouters",     "Tiel"),
    ("HH11JR0", "THC Hurley",                           "Hurley",          "Amstelveen"),
    ("HH11PQ1", "'t Spandersbosch",                     "Spandersbosch",   "Hilversum"),
    ("HH11NJ6", "U.H.C.QUI VIVE",                       "Qui Vive",        "De Kwakel"),
    ("HH11CJ3", "V.M.H.C. CARTOUCHE",                   "Cartouche",       "Voorburg"),
    ("HH11LR6", "V.M.H.& C.C. M.O.P.",                  "MOP",             "Vught"),
    ("HH11RN6", "Were Di Tilburg",                      "Were Di",         "Tilburg"),
    ("HH11RJ8", "WMHC",                                 "Wageningen",      "Wageningen"),
    ("HH11RY3", "Xenios",                               "Xenios",          "Amsterdam"),
    ("MG20WT7", "Zwaluwen Utrecht",                     "Zwaluwen",        "Utrecht"),
]


def upgrade():
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    for ext_id, name, friendly, city in CLUBS:
        safe_name     = name.replace("'", "''")
        safe_friendly = friendly.replace("'", "''")
        safe_city     = ("'" + city.replace("'", "''") + "'") if city else "NULL"
        op.execute(
            f"INSERT OR IGNORE INTO hockey_clubs "
            f"(external_id, name, friendly_name, city, club_type, discovered_at, updated_at) "
            f"VALUES ('{ext_id}', '{safe_name}', '{safe_friendly}', {safe_city}, "
            f"'regular', '{now}', '{now}')"
        )


def downgrade():
    op.execute("DELETE FROM hockey_clubs")
