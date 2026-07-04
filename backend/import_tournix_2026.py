"""
Tournix import — KNHB NK Hockey seizoen 2026-2027

Gebruik (vanuit backend/):
    python import_tournix_2026.py

Wat dit script doet:
  1. Verwijdert alle bestaande 2026-2027 toernooi-data (clean slate)
  2. Maakt toernooien aan: Topklasse + Subtopklasse voor O18/O16,
     alleen Topklasse voor O14/JO14
  3. Fase 1 (Poulefase): echte teams uit de KNHB definitieve indeling
  4. Fase 2 (Hermindeling): placeholders voor de Topklasse toernooien
     - O18 Topklasse  → Landelijke Competitie (2 poules x 8)
     - O16 Topklasse  → Landelijke Competitie (4 poules x 6)
     - MO14           → Super O14 (5 poules x 6)
     - JO14           → Hermindeling (4 poules x 6)

Idempotent: veilig meerdere keren uitvoeren (gooit eerst alles weg).

Bron fase-1 indeling: KNHB definitieve poule-indelingen 2026-2027
  (zie ook frontend/sites/tournix/input_2026/poulebord.html)
"""

import os
import sys
import uuid
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, select
from core.database import engine, create_db_and_tables
from models.tournix import Tournament, TournixPhase, TournixPool, TournixTeam

SEASON = "2026-2027"

# ──────────────────────────────────────────────────────────────────────────────
# FASE 1 — Definitieve poule-indelingen (bron: KNHB 2026-2027)
# Toernooien zonder suffix = alleen Topklasse (O14/JO14)
# ──────────────────────────────────────────────────────────────────────────────

FASE1 = {

    # ── MEISJES O18 ──────────────────────────────────────────────────────────
    "MO18 Topklasse": {
        "A": ["Craeyenhout MO18-1", "Fletiomare MO18-1", "Hurley MO18-1", "Nijmegen MO18-1"],
        "B": ["Gooische MO18-1", "HDM MO18-1", "Naarden MO18-1", "Phoenix MO18-1"],
        "C": ["Bloemendaal MO18-1", "Groningen MO18-1", "Kampong MO18-1", "Pinoke MO18-1"],
        "D": ["Den Bosch MO18-1", "Leonidas MO18-1", "Spandersbosch MO18-1", "Tilburg MO18-1"],
        "E": ["Alliance MO18-1", "HGC MO18-1", "Oranje-Rood MO18-1", "Schiedam MO18-1"],
        "F": ["Klein Zwitserland MO18-1", "Laren MO18-1", "Rood-Wit MO18-1", "Victoria MO18-1"],
        "G": ["Noordwijk MO18-1", "Push MO18-1", "Schaerweijde MO18-1", "SCHC MO18-1"],
        "H": ["Amsterdam MO18-1", "Apeldoorn MO18-1", "Rotterdam MO18-1", "Zwolle MO18-1"],
    },
    "MO18 Subtopklasse": {
        "A": ["Hurley MO18-2", "Rosmalen MO18-1", "Rotterdam MO18-2", "VVV HC MO18-1"],
        "B": ["GHBS MO18-1", "Hilversum MO18-1", "Loenen MO18-1", "Union MO18-1"],
        "C": ["HUDITO MO18-1", "IJburg MO18-1", "Qui Vive MO18-1", "Voordaan MO18-1"],
        "D": ["Almere MO18-1", "HDM MO18-2", "Shinty MO18-1", "Zoetermeer MO18-1"],
        "E": ["Cartouche MO18-1", "Myra MO18-1", "Rijnvliet MO18-1", "Ring Pass MO18-1"],
        "F": ["Amersfoort MO18-1", "EHV MO18-1", "HVA (Assen) MO18-1", "Maarssen MO18-1"],
        "G": ["AthenA MO18-1", "Gouda MO18-1", "IJsseloever MO18-1", "Westland MO18-1"],
        "H": ["Bemmel MO18-1", "Helmond MO18-1", "Weert MO18-1", "Were Di MO18-1"],
        "I": ["Alphen MO18-1", "Barendrecht MO18-1", "Bennebroek MO18-1", "Kampong MO18-2"],
        "J": ["Eemvallei MO18-1", "HBS MO18-1", "HDS MO18-1", "Xenios MO18-1"],
        "K": ["Delta Venlo MO18-1", "Oranje-Rood MO18-2", "Oss MO18-1", "SCHC MO18-2"],
        "L": ["AMVJ MO18-1", "Breda MO18-1", "DES MO18-1", "Upward MO18-1"],
        "M": ["Bully MO18-1", "Leusden MO18-1", "Nijmegen MO18-2", "Uden MO18-1"],
        "N": ["Den Bosch MO18-2", "Fletiomare MO18-2", "Goirle MO18-1", "Wageningen MO18-1"],
        "O": ["Berkel-Rodenrijs MO18-1", "Haarlem MO18-1", "Houten MO18-1", "Leiden MO18-1"],
        "P": ["Maastricht MO18-1", "MEP MO18-1", "MOP MO18-1", "Zwart-Wit MO18-1"],
    },

    # ── MEISJES O16 ──────────────────────────────────────────────────────────
    "MO16 Topklasse": {
        "A": ["EHV MO16-1", "Gooische MO16-1", "Groningen MO16-1", "Phoenix MO16-1", "Victoria MO16-1", "Zwolle MO16-1"],
        "B": ["Amersfoort MO16-1", "GHBS MO16-1", "Rood-Wit MO16-1", "Rotterdam MO16-1", "SCHC MO16-1", "Voordaan MO16-1"],
        "C": ["Amsterdam MO16-1", "Craeyenhout MO16-1", "Hurley MO16-1", "MOP MO16-1", "VVV HC MO16-1", "Xenios MO16-1"],
        "D": ["Bloemendaal MO16-1", "Cartouche MO16-1", "HDM MO16-1", "Myra MO16-1", "Push MO16-1", "Schaerweijde MO16-1"],
        "E": ["Breda MO16-1", "HBS MO16-1", "Huizen MO16-1", "Klein Zwitserland MO16-1", "Nijmegen MO16-1", "Noordwijk MO16-1"],
        "F": ["Apeldoorn MO16-1", "Barendrecht MO16-1", "Bennebroek MO16-1", "Fletiomare MO16-1", "Naarden MO16-1", "Tilburg MO16-1"],
        "G": ["AthenA MO16-1", "Delta Venlo MO16-1", "Helmond MO16-1", "Kampong MO16-1", "Pinoke MO16-1", "Spandersbosch MO16-1"],
        "H": ["Den Bosch MO16-1", "HDS MO16-1", "Leiden MO16-1", "Leonidas MO16-1", "Oranje-Rood MO16-1", "Zoetermeer MO16-1"],
    },
    "MO16 Subtopklasse": {
        "A": ["Fletiomare MO16-2", "Houten MO16-1", "Leeuwarden MO16-1", "Mezen MO16-1", "Phoenix MO16-2", "SCHC MO16-2"],
        "B": ["Alkmaar MO16-1", "Alliance MO16-1", "Alphen MO16-1", "Haarlem MO16-1", "Pinoke MO16-2", "Rood-Wit MO16-2"],
        "C": ["Bloemendaal MO16-2", "Gooische MO16-2", "HDM MO16-2", "Hilversum MO16-1", "IJburg MO16-1", "Weesp MO16-1"],
        "D": ["Arnhem MO16-1", "Bemmel MO16-1", "DES MO16-1", "Deventer MO16-1", "Laren MO16-1", "Wageningen MO16-1"],
        "E": ["MEP MO16-1", "Qui Vive MO16-1", "Rotterdam MO16-2", "Victoria MO16-2", "Were Di MO16-1", "Woerden MO16-1"],
        "F": ["Almere MO16-1", "Den Bosch MO16-2", "Nijmegen MO16-2", "Rijnvliet MO16-1", "Union MO16-1", "Upward MO16-1"],
        "G": ["Berkel-Rodenrijs MO16-1", "Klein Zwitserland MO16-2", "Pelikaan MO16-1", "Schiedam MO16-1", "Westland MO16-1", "Zoetermeer MO16-2"],
        "H": ["Berkel-Enschot MO16-1", "IJsseloever MO16-1", "Kampong MO16-2", "Maastricht MO16-1", "Oranje-Rood MO16-2", "Rosmalen MO16-1"],
    },

    # ── MEISJES O14 ───────────────────────────────────────────────────────────
    "MO14": {
        "A": ["Bully MO14-1", "GHBS MO14-1", "Groningen MO14-1", "Leeuwarden MO14-1", "Twente MO14-1", "Zwolle MO14-1"],
        "B": ["Alkmaar MO14-1", "Alliance MO14-1", "Bloemendaal MO14-1", "HBS MO14-1", "Hurley MO14-1", "Rood-Wit MO14-1"],
        "C": ["Amsterdam MO14-1", "AthenA MO14-1", "Diemen MO14-1", "Pinoke MO14-1", "VVV HC MO14-1", "Weesp MO14-1"],
        "D": ["Almere MO14-1", "Gooische MO14-1", "Huizen MO14-1", "Laren MO14-1", "Naarden MO14-1", "Spandersbosch MO14-1"],
        "E": ["Craeyenhout MO14-1", "HDM MO14-1", "HDS MO14-1", "Klein Zwitserland MO14-1", "Leiden MO14-1", "Noordwijk MO14-1"],
        "F": ["Alphen MO14-1", "Berkel-Rodenrijs MO14-1", "Cartouche MO14-1", "Derby MO14-1", "Rotterdam MO14-1", "Victoria MO14-1"],
        "G": ["Fletiomare MO14-1", "Hilversum MO14-1", "Houten MO14-1", "Kampong MO14-1", "SCHC MO14-1", "Voordaan MO14-1"],
        "H": ["Apeldoorn MO14-1", "Nijmegen MO14-1", "Phoenix MO14-1", "Schaerweijde MO14-1", "Upward MO14-1", "Wageningen MO14-1"],
        "I": ["Breda MO14-1", "Pelikaan MO14-1", "Push MO14-1", "Rosmalen MO14-1", "Tilburg MO14-1", "Zwart-Wit MO14-1"],
        "J": ["Delta Venlo MO14-1", "Den Bosch MO14-1", "Maastricht MO14-1", "MOP MO14-1", "Oranje-Rood MO14-1", "Were Di MO14-1"],
    },

    # ── JONGENS O18 ──────────────────────────────────────────────────────────
    "JO18 Topklasse": {
        "A": ["Fletiomare JO18-1", "Groningen JO18-1", "Kampong JO18-1", "Nijmegen JO18-1"],
        "B": ["Gooische JO18-1", "Klein Zwitserland JO18-1", "Leiden JO18-1", "Roomburg JO18-1"],
        "C": ["Cartouche JO18-1", "HDM JO18-1", "Hilversum JO18-1", "Laren JO18-1"],
        "D": ["Amsterdam JO18-1", "Bloemendaal JO18-1", "MEP JO18-1", "Naarden JO18-1"],
        "E": ["Deventer JO18-1", "Rood-Wit JO18-1", "Rotterdam JO18-1", "Victoria JO18-1"],
        "F": ["Den Bosch JO18-1", "Maarssen JO18-1", "Schaerweijde JO18-1", "Zwolle JO18-1"],
        "G": ["Oranje-Rood JO18-1", "SCHC JO18-1", "Voordaan JO18-1", "Xenios JO18-1"],
        "H": ["Hurley JO18-1", "Pinoke JO18-1", "Push JO18-1", "Tilburg JO18-1"],
    },
    "JO18 Subtopklasse": {
        "A": ["Amsterdam JO18-2", "Ede JO18-1", "GHBS JO18-1", "Naarden JO18-2"],
        "B": ["Alkmaar JO18-1", "Cartouche JO18-2", "HBS JO18-1", "HDS JO18-1"],
        "C": ["Baarn JO18-1", "FIT JO18-1", "Ring Pass JO18-1", "Rotterdam JO18-2"],
        "D": ["Alliance JO18-1", "Hurley JO18-2", "Klein Zwitserland JO18-2", "Weesp JO18-1"],
        "E": ["Alphen JO18-1", "Bennebroek JO18-1", "Berkel-Rodenrijs JO18-1", "Voordaan JO18-2"],
        "F": ["Barneveld JO18-1", "Den Bosch JO18-2", "Dommel JO18-1", "Gooische JO18-2"],
        "G": ["Amersfoort JO18-1", "Phoenix JO18-1", "Schaerweijde JO18-3", "Victoria JO18-2"],
        "H": ["Kampong JO18-2", "Leusden JO18-1", "Oosterbeek JO18-1", "Upward JO18-1"],
        "I": ["Forescate JO18-1", "Leiden JO18-2", "Leonidas JO18-1", "Shinty JO18-1"],
        "J": ["AMVJ JO18-1", "AthenA JO18-1", "Roomburg JO18-2", "Zoetermeer JO18-1"],
        "K": ["Barendrecht JO18-1", "HDM JO18-2", "Myra JO18-1", "Rijswijk JO18-1"],
        "L": ["Houten JO18-1", "HvB JO18-1", "Ommoord JO18-1", "Schiedam JO18-1"],
        "M": ["Breda JO18-1", "HUDITO JO18-1", "Kromhouters JO18-1", "Rosmalen JO18-1"],
        "N": ["Concordia JO18-1", "Delta Venlo JO18-1", "Warande JO18-1", "Zwart-Wit JO18-1"],
        "O": ["Maastricht JO18-1", "Nijmegen JO18-2", "Union JO18-1", "Zwaluwen JO18-1"],
        "P": ["Apeldoorn JO18-1", "Eemvallei JO18-1", "MOP JO18-1", "Oranje-Rood JO18-2"],
    },

    # ── JONGENS O16 ──────────────────────────────────────────────────────────
    "JO16 Topklasse": {
        "A": ["Bloemendaal JO16-1", "Deventer JO16-1", "Fletiomare JO16-1", "Forescate JO16-1", "Klein Zwitserland JO16-1", "Voordaan JO16-1"],
        "B": ["Cartouche JO16-1", "HBS JO16-1", "Leiden JO16-1", "Pinoke JO16-1", "Shinty JO16-1", "Upward JO16-1"],
        "C": ["Amsterdam JO16-1", "Gooische JO16-1", "Groningen JO16-1", "Maarssen JO16-1", "Naarden JO16-1", "Zwolle JO16-1"],
        "D": ["Alliance JO16-1", "AthenA JO16-1", "Laren JO16-1", "SCHC JO16-1", "Spandersbosch JO16-1", "Tilburg JO16-1"],
        "E": ["Hilversum JO16-1", "MOP JO16-1", "Nijmegen JO16-1", "Phoenix JO16-1", "Roomburg JO16-1", "Schaerweijde JO16-1"],
        "F": ["Bennebroek JO16-1", "Berkel-Rodenrijs JO16-1", "Kampong JO16-1", "MEP JO16-1", "Rotterdam JO16-1", "Schiedam JO16-1"],
        "G": ["Breda JO16-1", "HDM JO16-1", "Hurley JO16-1", "Rood-Wit JO16-1", "Victoria JO16-1", "Warande JO16-1"],
        "H": ["Delta Venlo JO16-1", "Den Bosch JO16-1", "Houten JO16-1", "Oranje-Rood JO16-1", "Push JO16-1", "Zwaluwen JO16-1"],
    },
    "JO16 Subtopklasse": {
        "A": ["AMVJ JO16-1", "Bloemendaal JO16-2", "Cartouche JO16-2", "Naarden JO16-2", "Pinoke JO16-2", "Rood-Wit JO16-2"],
        "B": ["Apeldoorn JO16-1", "GHBS JO16-1", "Schaerweijde JO16-2", "Weesp JO16-1", "Wijchen JO16-1", "Zutphen JO16-1"],
        "C": ["Gooische JO16-2", "HUDITO JO16-1", "Klein Zwitserland JO16-2", "Loenen JO16-1", "Myra JO16-1", "Westerpark JO16-1"],
        "D": ["Alphen JO16-1", "Bemmel JO16-1", "Huizen JO16-1", "HvB JO16-1", "IJburg JO16-1", "SCHC JO16-2"],
        "E": ["HDM JO16-2", "Leiden JO16-2", "Leonidas JO16-1", "Rijnvliet JO16-1", "Rijswijk JO16-1", "Victoria JO16-2"],
        "F": ["Alecto JO16-1", "Amersfoort JO16-1", "Den Bosch JO16-2", "Haarlem JO16-1", "Kieviten JO16-1", "Nijmegen JO16-2"],
        "G": ["Eemvallei JO16-1", "Kampong JO16-2", "Maastricht JO16-1", "Oranje-Rood JO16-2", "Push JO16-2", "Rosmalen JO16-1"],
        "H": ["Amsterdam JO16-2", "Breda JO16-2", "IJssel JO16-1", "Ring Pass JO16-1", "Rotterdam JO16-2", "Zoetermeer JO16-1"],
    },

    # ── JONGENS O14 ───────────────────────────────────────────────────────────
    "JO14": {
        "A": ["Apeldoorn JO14-1", "Groningen JO14-1", "Nijmegen JO14-1", "Oosterbeek JO14-1", "Upward JO14-1", "Zwolle JO14-1"],
        "B": ["Amsterdam JO14-1", "AthenA JO14-1", "Bloemendaal JO14-1", "Hurley JO14-1", "Myra JO14-1", "Pinoke JO14-1"],
        "C": ["Alliance JO14-1", "Forescate JO14-1", "HBS JO14-1", "Leiden JO14-1", "Rood-Wit JO14-1", "Roomburg JO14-1"],
        "D": ["Gooische JO14-1", "Laren JO14-1", "Naarden JO14-1", "SCHC JO14-1", "Voordaan JO14-1", "Weesp JO14-1"],
        "E": ["Cartouche JO14-1", "HDM JO14-1", "HGC JO14-1", "Klein Zwitserland JO14-1", "Ring Pass JO14-1", "Rotterdam JO14-1"],
        "F": ["Berkel-Rodenrijs JO14-1", "Breda JO14-1", "Leonidas JO14-1", "Push JO14-1", "Tilburg JO14-1", "Victoria JO14-1"],
        "G": ["Fletiomare JO14-1", "Houten JO14-1", "Kampong JO14-1", "Phoenix JO14-1", "Schaerweijde JO14-1", "Spandersbosch JO14-1"],
        "H": ["Delta Venlo JO14-1", "Den Bosch JO14-1", "Helmond JO14-1", "MOP JO14-1", "Oranje-Rood JO14-1", "Rosmalen JO14-1"],
    },
}

# ──────────────────────────────────────────────────────────────────────────────
# FASE 2 — Hermindeling configuratie (alleen Topklasse toernooien)
#
# Formaat per toernooi:
#   fase_naam      : naam van de hermindeling-fase
#   num_pools      : aantal poules in fase 2
#   pool_letters   : namen van de poules
#   positions      : welke herfst-posities doorstromen (1-gebaseerd)
#   pool_type      : "vol" (volledige competitie)
#
# Verdeling: cyclisch met shift per positie-wave.
# Elke fase-2-poule krijgt teams uit meerdere herfst-poules op elk niveau.
# ──────────────────────────────────────────────────────────────────────────────

FASE2 = {
    # O18 Topklasse 1e+2e → Landelijke Competitie (2 x 8)
    "MO18 Topklasse": {
        "fase_naam": "Landelijke Competitie",
        "num_pools": 2,
        "pool_letters": ["A", "B"],
        "positions": [1, 2],
    },
    "JO18 Topklasse": {
        "fase_naam": "Landelijke Competitie",
        "num_pools": 2,
        "pool_letters": ["A", "B"],
        "positions": [1, 2],
    },
    # O16 Topklasse 1e+2e+3e → Landelijke Competitie (4 x 6)
    "MO16 Topklasse": {
        "fase_naam": "Landelijke Competitie",
        "num_pools": 4,
        "pool_letters": ["A", "B", "C", "D"],
        "positions": [1, 2, 3],
    },
    "JO16 Topklasse": {
        "fase_naam": "Landelijke Competitie",
        "num_pools": 4,
        "pool_letters": ["A", "B", "C", "D"],
        "positions": [1, 2, 3],
    },
    # MO14 top 3 → Super O14 (5 x 6)
    "MO14": {
        "fase_naam": "Super O14",
        "num_pools": 5,
        "pool_letters": ["A", "B", "C", "D", "E"],
        "positions": [1, 2, 3],
    },
    # JO14 top 3 → Hermindeling (4 x 6)
    "JO14": {
        "fase_naam": "Hermindeling",
        "num_pools": 4,
        "pool_letters": ["A", "B", "C", "D"],
        "positions": [1, 2, 3],
    },
}

# ──────────────────────────────────────────────────────────────────────────────
# SUPER-HERINDELING — aparte toernooien die teams trekken uit meerdere bronnen
#
# Per toernooi:
#   fase_naam  : naam van de enige fase in dit toernooi
#   num_pools  : aantal poules
#   pool_letters: namen van de poules
#   bronnen    : lijst van (bron_toernooi_naam, [posities])
#                Elke bron verwijst naar de fase-1 van dat toernooi.
#
# O18 Super:  Topklasse 3e+4e (8×2=16) + Subtopklasse 1e (16×1=16) = 32 = 4×8
# O16 Super:  Topklasse 4e+5e (8×2=16) + Subtopklasse 1e (8×1=8)  = 24 = 4×6
#
# Verdeling: alle bron-teams per ronde cyclisch verdeeld over de super-poules.
# ──────────────────────────────────────────────────────────────────────────────

SUPER = {
    "MO18 Super O18": {
        "fase_naam": "Super O18",
        "num_pools": 4,
        "pool_letters": ["A", "B", "C", "D"],
        "bronnen": [
            ("MO18 Topklasse",    [3, 4]),   # 8 herfst-poules × 2 pos = 16 teams
            ("MO18 Subtopklasse", [1]),       # 16 herfst-poules × 1 pos = 16 teams
        ],
    },
    "JO18 Super O18": {
        "fase_naam": "Super O18",
        "num_pools": 4,
        "pool_letters": ["A", "B", "C", "D"],
        "bronnen": [
            ("JO18 Topklasse",    [3, 4]),   # 8 × 2 = 16
            ("JO18 Subtopklasse", [1]),       # 16 × 1 = 16
        ],
    },
    "MO16 Super O16": {
        "fase_naam": "Super O16",
        "num_pools": 4,
        "pool_letters": ["A", "B", "C", "D"],
        "bronnen": [
            ("MO16 Topklasse",    [4, 5]),   # 8 × 2 = 16 teams
            ("MO16 Subtopklasse", [1]),       # 8 × 1 = 8 teams  → totaal 24 = 4×6
        ],
    },
    "JO16 Super O16": {
        "fase_naam": "Super O16",
        "num_pools": 4,
        "pool_letters": ["A", "B", "C", "D"],
        "bronnen": [
            ("JO16 Topklasse",    [4, 5]),   # 8 × 2 = 16
            ("JO16 Subtopklasse", [1]),       # 8 × 1 = 8  → totaal 24 = 4×6
        ],
    },
}


# ──────────────────────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def _uid():
    return str(uuid.uuid4())


def _now():
    return datetime.utcnow()


def _clean_2026(session: Session):
    """Verwijder alle bestaande 2026-2027 toernooi-data."""
    tournaments = session.exec(
        select(Tournament).where(Tournament.season == SEASON)
    ).all()

    if not tournaments:
        print("  Geen bestaande data gevonden.")
        return

    for t in tournaments:
        phases = session.exec(
            select(TournixPhase).where(TournixPhase.tournament_id == t.id)
        ).all()
        for phase in phases:
            pools = session.exec(
                select(TournixPool).where(TournixPool.phase_id == phase.id)
            ).all()
            for pool in pools:
                teams = session.exec(
                    select(TournixTeam).where(TournixTeam.pool_id == pool.id)
                ).all()
                for team in teams:
                    session.delete(team)
                session.delete(pool)
            # losse KO-placeholders zonder pool
            loose = session.exec(
                select(TournixTeam).where(
                    TournixTeam.tournament_id == t.id,
                    TournixTeam.pool_id == None,  # noqa: E711
                )
            ).all()
            for team in loose:
                session.delete(team)
            session.delete(phase)
        session.delete(t)

    session.commit()
    print(f"  {len(tournaments)} toernooi(en) verwijderd.")


def _maak_fase1(session: Session, t: Tournament, pools_data: dict):
    """Maakt Poulefase (fase 1) aan met echte teams."""
    fase = TournixPhase(
        id=_uid(), tournament_id=t.id,
        name="Poulefase", phase_type="pool", pool_type="half",
        order=0, created_at=_now(),
    )
    session.add(fase)
    session.flush()

    for order, (letter, teams) in enumerate(pools_data.items()):
        pool = TournixPool(
            id=_uid(), tournament_id=t.id,
            phase_id=fase.id, name=letter, order=order,
        )
        session.add(pool)
        session.flush()
        for team_name in teams:
            session.add(TournixTeam(
                id=_uid(), tournament_id=t.id,
                name=team_name, pool_id=pool.id,
                created_at=_now(),
            ))

    session.commit()
    return fase


def _maak_fase2(session: Session, t: Tournament, fase1: TournixPhase, cfg: dict):
    """
    Maakt hermindeling (fase 2) aan met placeholder-teams.

    Verdeelregel (cyclisch met shift per positie-wave):
      team op positie P uit herfst-poule H gaat naar fase-2-poule
      met index (H_index + P_index) % num_pools.

    Dit zorgt dat elke fase-2-poule teams krijgt uit meerdere herfst-poules
    op elk niveau (geen poule vol met alleen nummer-1s of nummer-2s).
    """
    fase2 = TournixPhase(
        id=_uid(), tournament_id=t.id,
        name=cfg["fase_naam"], phase_type="pool", pool_type="vol",
        order=1, created_at=_now(),
    )
    session.add(fase2)
    session.flush()

    fase2_pools = []
    for i, letter in enumerate(cfg["pool_letters"]):
        p = TournixPool(
            id=_uid(), tournament_id=t.id,
            phase_id=fase2.id, name=letter, order=i,
        )
        session.add(p)
        fase2_pools.append(p)
    session.flush()

    herfst_pools = session.exec(
        select(TournixPool)
        .where(TournixPool.phase_id == fase1.id)
        .order_by(TournixPool.order)
    ).all()

    num = cfg["num_pools"]
    for pos_idx, pos in enumerate(cfg["positions"]):
        for hf_idx, hf_pool in enumerate(herfst_pools):
            doel = fase2_pools[(hf_idx + pos_idx) % num]
            session.add(TournixTeam(
                id=_uid(), tournament_id=t.id,
                name=f"{pos}e poule {hf_pool.name}",
                pool_id=doel.id,
                is_placeholder=True,
                placeholder_source_phase_id=fase1.id,
                placeholder_pool_name=hf_pool.name,
                placeholder_position=pos,
                created_at=_now(),
            ))

    session.commit()
    n_teams = len(cfg["positions"]) * len(herfst_pools)
    print(f"    Fase 2 ({cfg['fase_naam']}): {num} poules, {n_teams} placeholders")
    return fase2


def _maak_super(session: Session, naam: str, cfg: dict, fase1_map: dict):
    """
    Maakt een Super-tournament aan (Super O18 / Super O16) dat teams trekt
    uit de fase-1 van meerdere brontoernooien.

    Het toernooi heeft geen eigen fase 1 — de hoofdfase IS de super-competitie.
    Placeholders verwijzen rechtstreeks naar de fase-1-phases van de bronnen.

    Verdeling: alle (bron, pool, positie)-slots worden verzameld en dan
    cyclisch over de super-poules verdeeld, zodat elke super-poule teams
    krijgt uit meerdere bronnen en posities.

    Teamnamen: "{pos}e {Topklasse|Subtopklasse} poule {letter}"
    """
    t = Tournament(
        id=_uid(), name=naam, season=SEASON,
        num_pools=cfg["num_pools"], pool_type="vol",
        status="active", stage="productie",
        created_at=_now(),
    )
    session.add(t)
    session.flush()

    fase = TournixPhase(
        id=_uid(), tournament_id=t.id,
        name=cfg["fase_naam"], phase_type="pool", pool_type="vol",
        order=0, created_at=_now(),
    )
    session.add(fase)
    session.flush()

    num = cfg["num_pools"]
    super_pools = []
    for i, letter in enumerate(cfg["pool_letters"]):
        p = TournixPool(
            id=_uid(), tournament_id=t.id,
            phase_id=fase.id, name=letter, order=i,
        )
        session.add(p)
        super_pools.append(p)
    session.flush()

    # Verzamel alle slots: (bron_fase1, hf_pool, pos, level_label)
    slots = []
    for bron_naam, positions in cfg["bronnen"]:
        if bron_naam not in fase1_map:
            print(f"    SKIP bron '{bron_naam}': niet gevonden")
            continue
        _, bron_fase1 = fase1_map[bron_naam]
        bron_pools = session.exec(
            select(TournixPool)
            .where(TournixPool.phase_id == bron_fase1.id)
            .order_by(TournixPool.order)
        ).all()
        level = bron_naam.split()[-1]  # "Topklasse" of "Subtopklasse"
        for pos in positions:
            for hf_pool in bron_pools:
                slots.append((bron_fase1, hf_pool, pos, level))

    # Cyclisch verdelen over super-poules
    for i, (bron_fase1, hf_pool, pos, level) in enumerate(slots):
        doel = super_pools[i % num]
        session.add(TournixTeam(
            id=_uid(), tournament_id=t.id,
            name=f"{pos}e {level} poule {hf_pool.name}",
            pool_id=doel.id,
            is_placeholder=True,
            placeholder_source_phase_id=bron_fase1.id,
            placeholder_pool_name=hf_pool.name,
            placeholder_position=pos,
            created_at=_now(),
        ))

    session.commit()
    print(f"  {naam}: {num} poules, {len(slots)} placeholders ({cfg['fase_naam']})")
    return t


# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────

def run():
    create_db_and_tables()

    with Session(engine) as session:

        print(f"\n>> Clean: verwijder bestaande {SEASON} data...")
        _clean_2026(session)

        print(f"\n>> Fase 1: toernooien + teams aanmaken...")
        fase1_map = {}  # toernooi_naam → (Tournament, TournixPhase)

        for naam, pools_data in FASE1.items():
            num_pools = len(pools_data)
            t = Tournament(
                id=_uid(), name=naam, season=SEASON,
                num_pools=num_pools, pool_type="half",
                status="active", stage="productie",
                created_at=_now(),
            )
            session.add(t)
            session.flush()

            fase1 = _maak_fase1(session, t, pools_data)
            fase1_map[naam] = (t, fase1)

            num_teams = sum(len(v) for v in pools_data.values())
            print(f"  {naam}: {num_pools} poules, {num_teams} teams")

        print(f"\n>> Fase 2: hermindeling (placeholders) aanmaken...")
        for naam, cfg in FASE2.items():
            if naam not in fase1_map:
                print(f"  SKIP {naam}: niet gevonden in fase 1")
                continue
            t, fase1 = fase1_map[naam]
            print(f"  {naam}:")
            _maak_fase2(session, t, fase1, cfg)

        print(f"\n>> Super-toernooien aanmaken (cross-tournament placeholders)...")
        for naam, cfg in SUPER.items():
            _maak_super(session, naam, cfg, fase1_map)

        # Totalen
        total_fase1_t = len(FASE1)
        total_teams = sum(
            sum(len(v) for v in pools.values())
            for pools in FASE1.values()
        )
        print(f"\n  Klaar:")
        print(f"    {total_fase1_t} fase-1 toernooien, {total_teams} echte teams")
        print(f"    {len(FASE2)} toernooien met fase-2 hermindeling (Topklasse LC-pad)")
        print(f"    {len(SUPER)} super-toernooien (Super O18 / Super O16)")


if __name__ == "__main__":
    run()
