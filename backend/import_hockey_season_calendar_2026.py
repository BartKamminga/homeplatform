"""
Hockey season calendar import — seizoen 2026-2027 (roadmap item 1043/1045)

Gebruik (vanuit backend/):
    python import_hockey_season_calendar_2026.py

Wat dit script doet:
  1. Verwijdert bestaande hockey_season_calendar-rijen voor season 2026-2027
     EN de losse 'new_schedule'-rij voor 2027-2028 (clean slate)
  2. Zet ze opnieuw neer op basis van de officiele KNHB-speeldagenkalenders

Bron: https://www.knhb.nl/competitie/speeldagenkalender (bondscompetitie +
5 districts-PDF's voor senioren en (jongste) jeugd, geraadpleegd 02-09-2026).
Hockey7s is bewust NIET meegenomen (los blokken-systeem, niet relevant voor
season_phases/veld-zaal-indeling).

Nauwkeurigheid: de PDF's zijn Excel-exports met per-klasse ronde-nummering;
dit script legt de FASE-grenzen vast (veld najaar / zaal / veld voorjaar) per
district + leeftijdscategorie, niet elke individuele speelronde. Voor ZN was
de brondata (met name de zaalronde-nummering) minder scherp leesbaar dan de
overige districten - zie notes bij die rijen.

Idempotent: veilig meerdere keren uitvoeren (gooit eerst de season-data weg).
"""

import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, col, select
from core.database import engine, create_db_and_tables
from models.hockey_season_calendar import HockeySeasonCalendar

SEASON = "2026-2027"
NEXT_SEASON = "2027-2028"

BONDSCOMPETITIE_URL = "https://media.static-hw.nl/media/735814a2-8b5a-4e36-92c1-90ad4d320877/26-27-land-speeldagenkalenders-def.pdf"
DISTRICT_SENIOREN_URLS = {
    "NH": "https://media.static-hw.nl/media/877c49d3-c771-42e8-98ef-26efcebeb299/speeldagenkalender-nh-2026-2027-senioren.pdf",
    "NO": "https://media.static-hw.nl/media/65603138-a043-4af3-8ae7-2888bb6d50e9/speeldagenkalender-no-2026-2027-senioren.pdf",
    "MN": "https://media.static-hw.nl/media/9d6a6416-4099-4ee3-b31a-a803b6af1997/speeldagenkalender-mn-2026-2027-senioren.pdf",
    "ZH": "https://media.static-hw.nl/media/3109c901-841e-4466-9100-4be538c5ae4a/speeldagenkalender-zh-seizoen-26-27-senioren.pdf",
    "ZN": "https://media.static-hw.nl/media/a8a1aed9-5b00-4de8-b224-6889d511f86b/speeldagenkalender-zn-2026-2027-senioren.pdf",
}
DISTRICT_JEUGD_URLS = {
    "NH": "https://media.static-hw.nl/media/29d0cbd4-5464-41ca-8b96-79d079199387/speeldagenkalender-nh-2026-2027-jongste-jeugd.pdf",
    "NO": "https://media.static-hw.nl/media/6c5088d6-7bd4-420e-b055-b27cae2a78f2/speeldagenkalender-no-2026-2027-jongste-jeugd.pdf",
    "MN": "https://media.static-hw.nl/media/08e67a9a-30b2-499f-98dc-f45064a058f6/speeldagenkalender-mn-2026-2027-jongste-jeugd.pdf",
    "ZH": "https://media.static-hw.nl/media/34e4c190-bce6-45b3-ac85-7773ba329f40/speeldagenkalender-zh-seizoen-26-27-jongste-jeugd.pdf",
    "ZN": "https://media.static-hw.nl/media/7b38991a-266f-4557-9125-a13061220a5e/speeldagenkalender-zn-2026-2027-jongste-jeugd.pdf",
}

# ──────────────────────────────────────────────────────────────────────────────
# BONDSCOMPETITIE (landelijk) — Hoofdklasse/Promotieklasse/Overgangsklasse/
# 1e klasse senioren + Onder 18/16/14 landelijk/subtop
# ──────────────────────────────────────────────────────────────────────────────
ROWS = [
    dict(season=SEASON, district="bondscompetitie", age_category="senioren",
         klasse_scope="Hoofdklasse, Promotieklasse, Overgangsklasse, 1e klasse",
         phase="veld_najaar", start_date=date(2026, 9, 5), end_date=date(2026, 11, 29),
         rounds=12, source_url=BONDSCOMPETITIE_URL, notes=None),
    dict(season=SEASON, district="bondscompetitie", age_category="senioren",
         klasse_scope="Hoofdklasse, Promotieklasse, Overgangsklasse, 1e klasse",
         phase="zaal", start_date=date(2026, 12, 6), end_date=date(2027, 1, 31),
         rounds=5, source_url=BONDSCOMPETITIE_URL, notes="NK Zaal 30-31 jan"),
    dict(season=SEASON, district="bondscompetitie", age_category="senioren",
         klasse_scope="Hoofdklasse, Promotieklasse, Overgangsklasse, 1e klasse",
         phase="veld_voorjaar", start_date=date(2027, 3, 6), end_date=date(2027, 6, 27),
         rounds=10, source_url=BONDSCOMPETITIE_URL, notes="PD/PO en EHL Final12 maart-juni, NK's laatste weekend juni"),

    dict(season=SEASON, district="bondscompetitie", age_category="jeugd",
         klasse_scope="Onder 18/16/14 landelijk + subtop",
         phase="veld_najaar", start_date=date(2026, 8, 29), end_date=date(2026, 11, 29),
         rounds=12, source_url=BONDSCOMPETITIE_URL, notes="O18 landelijk start 1 week eerder (29 aug)"),
    dict(season=SEASON, district="bondscompetitie", age_category="jeugd",
         klasse_scope="Onder 18/16/14 landelijk + subtop",
         phase="zaal", start_date=date(2026, 12, 6), end_date=date(2027, 1, 31),
         rounds=5, source_url=BONDSCOMPETITIE_URL, notes="NK O18/O16/O14 in januari"),
    dict(season=SEASON, district="bondscompetitie", age_category="jeugd",
         klasse_scope="Onder 18/16/14 landelijk + subtop",
         phase="veld_voorjaar", start_date=date(2027, 3, 6), end_date=date(2027, 6, 20),
         rounds=10, source_url=BONDSCOMPETITIE_URL, notes="NK Finale/Super O18/O16 laatste weekend"),
]

# ──────────────────────────────────────────────────────────────────────────────
# DISTRICT SENIOREN — patroon vrijwel identiek in alle 5 districten
# (veld najaar 6 sept-29 nov, zaal 5 dec-14 feb met 9 zaalronden, voorjaar
# vanaf begin maart t/m eind juni), met kleine per-district afwijkingen
# ──────────────────────────────────────────────────────────────────────────────
DISTRICT_SENIOREN = {
    "NH": dict(
        najaar=(date(2026, 9, 6), date(2026, 11, 29), 12, None),
        zaal=(date(2026, 12, 5), date(2027, 2, 14), 9,
              "Hoofdklasse t/m NK Zaal (30-31 jan, 7 ronden); Std/Res Topklasse, O25 Topklasse, 30+/45+ t/m Zaal 9 (14 feb)"),
        voorjaar=(date(2027, 3, 6), date(2027, 6, 27), 10, "PO 1.1/1.2 juni, NK's 20-27 juni"),
    ),
    "NO": dict(
        najaar=(date(2026, 9, 6), date(2026, 11, 29), 11, None),
        zaal=(date(2026, 12, 5), date(2027, 2, 14), 9,
              "Hoofdklasse t/m NK (30-31 jan); overige klasses t/m Zaal 9 (14 feb)"),
        voorjaar=(date(2027, 3, 7), date(2027, 6, 27), 10, "NK O25/30+/45+ 27 juni"),
    ),
    "MN": dict(
        najaar=(date(2026, 9, 6), date(2026, 11, 29), 11, "Districtcompetitie-telling; bondscompetitie-klasses lopen door tot ronde 12"),
        zaal=(date(2026, 12, 5), date(2027, 2, 14), 9, "'Einde zaalcompetitie' expliciet vermeld op 14 feb (Zaal 9)"),
        voorjaar=(date(2027, 3, 7), date(2027, 6, 13), 10, None),
    ),
    "ZH": dict(
        najaar=(date(2026, 9, 6), date(2026, 11, 29), 10, None),
        zaal=(date(2026, 12, 5), date(2027, 2, 14), 9, "NK's verspreid tussen 23 jan en 14 feb per klasse"),
        voorjaar=(date(2027, 3, 7), date(2027, 6, 27), 10, "NK 25+/30+/45+ 27 juni"),
    ),
    "ZN": dict(
        najaar=(date(2026, 9, 6), date(2026, 11, 22), 10, None),
        zaal=(date(2026, 12, 5), date(2027, 2, 14), 9,
              "Minder scherpe brondata dan overige districten (zaalronde-nummers niet expliciet leesbaar in PDF) - datums afgeleid uit het landelijke patroon"),
        voorjaar=(date(2027, 3, 7), date(2027, 6, 13), 10, None),
    ),
}

# ──────────────────────────────────────────────────────────────────────────────
# DISTRICT (JONGSTE) JEUGD — Periode 1+2 samengevoegd tot veld_najaar,
# Periode 3 = veld_voorjaar. Patroon ook hier vrijwel identiek per district.
# ──────────────────────────────────────────────────────────────────────────────
DISTRICT_JEUGD = {
    "NH": dict(
        najaar=(date(2026, 9, 5), date(2026, 11, 29), 11, "Periode 1+2 samengevoegd"),
        zaal=(date(2026, 12, 5), date(2027, 2, 14), 9, "NK O18/O16/O14 23-31 jan"),
        voorjaar=(date(2027, 3, 6), date(2027, 6, 20), 11, "NK Finale/Super O18/O16, JJ Slotdag 19-20 juni"),
    ),
    "NO": dict(
        najaar=(date(2026, 9, 5), date(2026, 11, 28), 10, "Periode 1+2 samengevoegd"),
        zaal=(date(2026, 12, 5), date(2027, 2, 14), 9, "NK/MK O18/O16/O14 in januari-februari"),
        voorjaar=(date(2027, 3, 6), date(2027, 6, 19), 10, "JJ Slotdag ~19-20 juni"),
    ),
    "MN": dict(
        najaar=(date(2026, 9, 5), date(2026, 11, 28), 11, "Periode 1+2 samengevoegd"),
        zaal=(date(2026, 12, 5), date(2027, 2, 14), 9, "NK 23-31 jan"),
        voorjaar=(date(2027, 3, 6), date(2027, 6, 19), 11, "JJ Slotdag ~19-20 juni"),
    ),
    "ZH": dict(
        najaar=(date(2026, 9, 5), date(2026, 11, 28), 10, "Periode 1+2 samengevoegd"),
        zaal=(date(2026, 12, 5), date(2027, 2, 14), 9, "NK 23 jan - 14 feb"),
        voorjaar=(date(2027, 3, 6), date(2027, 6, 20), 10, "NK Finale/Super O18 20 juni, JJ Slotdag"),
    ),
    "ZN": dict(
        najaar=(date(2026, 9, 5), date(2026, 11, 28), 10, "Periode 1+2 samengevoegd"),
        zaal=(date(2026, 12, 5), date(2027, 1, 31), 7,
              "Minder scherpe brondata - zaalronde-nummers niet expliciet leesbaar in PDF, datums afgeleid"),
        voorjaar=(date(2027, 3, 6), date(2027, 6, 19), 10, "JJ Slotdag ~19-20 juni"),
    ),
}

for dist, phases in DISTRICT_SENIOREN.items():
    for phase_key, (start, end, rounds, notes) in phases.items():
        phase = {"najaar": "veld_najaar", "zaal": "zaal", "voorjaar": "veld_voorjaar"}[phase_key]
        ROWS.append(dict(
            season=SEASON, district=dist, age_category="senioren", klasse_scope=None,
            phase=phase, start_date=start, end_date=end, rounds=rounds,
            source_url=DISTRICT_SENIOREN_URLS[dist], notes=notes,
        ))

for dist, phases in DISTRICT_JEUGD.items():
    for phase_key, (start, end, rounds, notes) in phases.items():
        phase = {"najaar": "veld_najaar", "zaal": "zaal", "voorjaar": "veld_voorjaar"}[phase_key]
        ROWS.append(dict(
            season=SEASON, district=dist, age_category="jeugd", klasse_scope=None,
            phase=phase, start_date=start, end_date=end, rounds=rounds,
            source_url=DISTRICT_JEUGD_URLS[dist], notes=notes,
        ))

# ──────────────────────────────────────────────────────────────────────────────
# Landelijke ronde-kalender (op Bart's verzoek, "landelijk gemiddelde"-keuze):
# 1 gedeelde datumreeks per fase, NIET per district/leeftijdscategorie (die
# lopen tot ~1-2 weken uit elkaar per regio-vakantie - dat exact per district
# vastleggen is een veel grotere, foutgevoeligere klus). Wekelijks ritme
# vanuit de bondscompetitie-PDF, met de vakantieweek(en) overgeslagen.
# district/age_category blijven leeg = landelijk gemiddelde, geen specifieke
# klasse. Rounds (totaal-veld) blijft leeg op ronde-rijen; round_number is
# hier de betekenisvolle kolom, start_date == end_date (1 speelweekend).
# ──────────────────────────────────────────────────────────────────────────────
ROUND_DATES = {
    "veld_najaar": [
        date(2026, 9, 5), date(2026, 9, 12), date(2026, 9, 19), date(2026, 9, 26),
        date(2026, 10, 3),
        # herfstvakantie (10-18 okt) overgeslagen
        date(2026, 10, 24), date(2026, 10, 31), date(2026, 11, 7), date(2026, 11, 14),
        date(2026, 11, 21), date(2026, 11, 28),
    ],
    "zaal": [
        date(2026, 12, 6), date(2026, 12, 13), date(2026, 12, 20),
        # kerstvakantie overgeslagen
        date(2027, 1, 10), date(2027, 1, 17), date(2027, 1, 24), date(2027, 1, 31),
        date(2027, 2, 7), date(2027, 2, 14),
    ],
    "veld_voorjaar": [
        date(2027, 3, 6), date(2027, 3, 13), date(2027, 3, 20),
        # paasweekend (27 mrt) overgeslagen
        date(2027, 4, 3), date(2027, 4, 10), date(2027, 4, 17),
        # meivakantie (24 apr) overgeslagen
        date(2027, 5, 8), date(2027, 5, 15), date(2027, 5, 22), date(2027, 5, 29),
    ],
}
for phase, dates in ROUND_DATES.items():
    for i, d in enumerate(dates, start=1):
        ROWS.append(dict(
            season=SEASON, district=None, age_category=None,
            klasse_scope="Landelijk gemiddelde (bondscompetitie-ritme)",
            phase=phase, start_date=d, end_date=d, rounds=None, round_number=i,
            source_url=BONDSCOMPETITIE_URL, notes=None,
        ))

# ──────────────────────────────────────────────────────────────────────────────
# Indeling-verwachting (Bart, 02-09-2026): geen harde KNHB-data, maar een
# inschatting o.b.v. het algemene KNHB-ritme (aanmeldingen -> indeling, dan
# pas speeldagen). Wordt automatisch bevestigd/vervangen door een echte
# pushmelding zodra de eerste zaal/voorjaar-poule daadwerkelijk gescand wordt
# (zie notify_new_phase_indeling in hockey_poule_capture_core.py).
# ──────────────────────────────────────────────────────────────────────────────
ROWS.append(dict(
    season=SEASON, district=None, age_category=None,
    klasse_scope="Zaal-poule-indeling",
    phase="indeling_verwacht", start_date=date(2026, 11, 16), end_date=date(2026, 11, 29),
    rounds=None, source_url="https://www.knhb.nl/competitie/speeldagenkalender",
    notes=(
        "Inschatting, geen harde KNHB-data: 2-4 weken voor zaalstart (5-6 dec), "
        "vaak vlak na de laatste veld-najaar-ronde (28-29 nov)."
    ),
))
ROWS.append(dict(
    season=SEASON, district=None, age_category=None,
    klasse_scope="Voorjaarscompetitie-indeling",
    phase="indeling_verwacht", start_date=date(2027, 2, 15), end_date=date(2027, 2, 28),
    rounds=None, source_url="https://www.knhb.nl/competitie/speeldagenkalender",
    notes=(
        "Inschatting, geen harde KNHB-data: herindeling o.b.v. de najaar-eindstand kan pas "
        "na de laatste zaalronde (14 feb), krap venster tot voorjaarsstart (6-7 mrt)."
    ),
))

# ──────────────────────────────────────────────────────────────────────────────
# Vooruitkijken (item 1045): wanneer verwachten we de 2027-2028-kalender?
# Geen district/age_category/klasse_scope - deze rij is seizoen-breed.
# ──────────────────────────────────────────────────────────────────────────────
ROWS.append(dict(
    season=NEXT_SEASON, district=None, age_category=None, klasse_scope=None,
    phase="new_schedule", start_date=date(2027, 7, 1), end_date=date(2027, 7, 31),
    rounds=None, source_url="https://www.knhb.nl/competitie/speeldagenkalender",
    notes=(
        "Verwacht publicatievenster o.b.v. seizoen 2026-2027: PDF's intern gedateerd "
        "'CONCEPT 30 juni 2026' / 'dd 17 april 2026', door Bart gevonden/beschikbaar "
        "17-07-2026. Check deze pagina rond juli 2027 voor de 2027-2028-kalenders."
    ),
))


def run():
    create_db_and_tables()
    with Session(engine) as session:
        removed = session.exec(
            select(HockeySeasonCalendar).where(
                col(HockeySeasonCalendar.season).in_([SEASON, NEXT_SEASON])
            )
        ).all()
        for row in removed:
            session.delete(row)
        session.commit()
        print(f"  {len(removed)} bestaande rijen verwijderd (season {SEASON}/{NEXT_SEASON})")

        for data in ROWS:
            session.add(HockeySeasonCalendar(**data))
        session.commit()
        print(f"  {len(ROWS)} rijen toegevoegd")


if __name__ == "__main__":
    run()
