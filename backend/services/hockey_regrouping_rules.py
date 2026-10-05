"""Herindelingsregels per categorie (items 1182/1183).

Bron: KNHB Herindelingsregeling competities Jeugd 2025-2026 - voor 2026-2027
is (nog) geen nieuwe versie gepubliceerd; de aantallen poules/teams in de
gescande 2026-2027-data komen overeen met deze opzet.

Per categorie een lijst doelen in verwerkingsvolgorde (hoogste eerst), zodat
een team dat via aanvullen in een hoger doel komt niet nog eens meetelt.
- direct: [(klasse, posities, district|None)]
- district_best: [(klasse, positie, district)] - beste nr X van één district
- fill: [(klasse, positie)] - aanvullen tot capaciteit met de beste nrs X
- pools/size: None = geen landelijke poule-indeling te voorspellen (regionaal
  ingedeeld en/of aangevuld uit districtscompetities); dan alleen een lijst.
- note: korte toelichting in de UI (Engels, zie taalafspraak UI).
- max_travel_minutes: reistijdgrens per poule (item 1184) - alleen O14, waar de
  KNHB naar reisafstand kijkt (vermoedelijk ~2 uur). Puur signalering: de
  serpentine-indeling zelf houdt er (nog) geen rekening mee.
"""

RULE_SOURCE = "KNHB Herindelingsregeling competities Jeugd 2025-2026"

# Volgorde van de klassen bepaalt de tier in de plaatsingslijst.
CLASS_LEVEL = {
    "Topklasse": 0, "Landelijke Topklasse": 0,
    "Subtopklasse": 1, "Landelijke Subtopklasse": 1,
}

_SUBTOP_REGIONAL = "Pools are formed regionally (across district borders) and completed with 1e klasse champions."
_OUT_1E_KLASSE = "Back to the district competition."


def _o14(gender: str) -> dict:
    top, sub = "Topklasse", "Subtopklasse"
    if gender == "M":
        super_fill, idc = [], {
            "direct": [(top, (4, 5), None), (sub, (1,), None)],
            "district_best": [(sub, 2, "Zuid-Holland")],
            "fill": [(sub, 2)],
        }
    else:
        super_fill, idc = [(top, 4)], {
            "direct": [(top, (4, 5), None), (sub, (1, 2), None)],
            "fill": [(sub, 3)],
        }
    return {
        "season_step": "Autumn -> spring (after winter break)",
        "source_classes": [top, sub],
        "targets": [
            {"key": "super", "name": "Super O14", "pools": 5, "size": 6, "max_travel_minutes": 120,
             "direct": [(top, (1, 2, 3), None)], "fill": super_fill,
             "note": "#1 and #2 of each pool qualify for the NK O14."},
            {"key": "idc", "name": "IDC O14", "pools": 6, "size": 6, "max_travel_minutes": 120, **idc},
            {"key": "subtop", "name": "Subtopklasse", "pools": None,
             "direct": [(top, (6,), None)], "fill": [], "note": _SUBTOP_REGIONAL},
        ],
    }


def _o16() -> dict:
    top, sub = "Landelijke Topklasse", "Subtopklasse"
    return {
        "season_step": "Autumn -> spring (after winter break)",
        "source_classes": [top, sub],
        "targets": [
            {"key": "national", "name": "Landelijke competitie O16", "pools": 4, "size": 6,
             "direct": [(top, (1, 2, 3), None)], "fill": [],
             "note": "#1 and #2 of each pool play the NK quarter-finals."},
            {"key": "super", "name": "Super O16", "pools": 4, "size": 6,
             "direct": [(top, (4, 5), None), (sub, (1,), None)], "fill": [],
             "note": "#1 and #2 of each pool play the Super O16 final day."},
            {"key": "subtop", "name": "Subtopklasse", "pools": None,
             "direct": [(top, (6,), None), (sub, (2, 3, 4, 5), None)], "fill": [],
             "note": _SUBTOP_REGIONAL},
            {"key": "out", "name": "1e klasse", "pools": None,
             "direct": [(sub, (6,), None)], "fill": [], "note": _OUT_1E_KLASSE},
        ],
    }


def _o18() -> dict:
    top, sub = "Landelijke Topklasse", "Landelijke Subtopklasse"
    return {
        "season_step": "Pre-competition -> regular competition (after autumn break)",
        "source_classes": [top, sub],
        "targets": [
            {"key": "national", "name": "Landelijke competitie O18", "pools": 2, "size": 8,
             "direct": [(top, (1, 2), None)], "fill": [],
             "note": "#1 and #2 of each pool play the NK semi-finals."},
            {"key": "super", "name": "Super O18", "pools": 4, "size": 8,
             "direct": [(top, (3, 4), None), (sub, (1,), None)], "fill": [],
             "note": "#1 and #2 of each pool play the Super O18 final day."},
            {"key": "subtop", "name": "Subtopklasse", "pools": None,
             "direct": [(sub, (2, 3), None)], "fill": [], "note": _SUBTOP_REGIONAL},
            {"key": "out", "name": "1e klasse", "pools": None,
             "direct": [(sub, (4,), None)], "fill": [], "note": _OUT_1E_KLASSE},
        ],
    }


RULES = {
    "MO14": _o14("M"),
    "JO14": _o14("J"),
    "MO16": _o16(),
    "JO16": _o16(),
    "MO18": _o18(),
    "JO18": _o18(),
}
