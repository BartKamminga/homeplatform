"""Herindelingsprognose (item 1182) - teksten in de output (via/warnings) zijn
Engels omdat ze direct in de UI verschijnen.

Projecteert op basis van de huidige stand
hoe de KNHB de teams na de herfst/voorcompetitie herindeelt.

Pure logica - geen DB. De router levert per poule de stand aan, deze module
past de herindelingsregels toe (KNHB Herindelingsregeling Jeugd 2025-2026,
voor 2026-2027 nog geen nieuwe versie gepubliceerd) en verdeelt de geplaatste
teams horizontaal (serpentine) over de doelpoules.

Werkwijze per doelcompetitie:
1. Directe plaatsingen (bv. Topklasse nr 1-3 -> Super O14).
2. Aanvullen tot capaciteit met de beste kandidaten over alle poules heen
   (bv. JO14: drie beste nrs 4 -> Super O14), ranking conform BR art. 2.6:
   punten, doelsaldo, doelpunten voor - per gespeelde wedstrijd omdat niet
   alle poules even ver zijn.
3. Plaatsingslijst: eerst op herkomst-tier (klasse + positie), daarbinnen op
   de BR 2.6-ranking. Serpentine over de poules, max 1 team per club per poule.
"""

import re
from dataclasses import dataclass, field
from typing import Optional

RULE_SOURCE = "KNHB Herindelingsregeling competities Jeugd 2025-2026"

# Volgorde van de klassen bepaalt de tier in de plaatsingslijst.
CLASS_LEVEL = {"Topklasse": 0, "Subtopklasse": 1}

# Per categorie: doelen in verwerkingsvolgorde (eerst Super, dan IDC) zodat
# een team dat via aanvullen in een hoger doel komt niet nog eens meetelt.
# direct: (klasse, posities, district|None). fill: (klasse, positie) kandidaten.
RULES = {
    "MO14": {
        "source_classes": ["Topklasse", "Subtopklasse"],
        "targets": [
            {"key": "super", "name": "Super O14", "pools": 5, "size": 6,
             "direct": [("Topklasse", (1, 2, 3), None)], "fill": []},
            {"key": "idc", "name": "IDC O14", "pools": 6, "size": 6,
             "direct": [("Topklasse", (4, 5), None), ("Subtopklasse", (1,), None)],
             # Beste nr 2 van ZH plaatst zich direct, daarna vullen landelijk de beste nrs 2.
             "district_best": [("Subtopklasse", 2, "Zuid-Holland")],
             "fill": [("Subtopklasse", 2)]},
        ],
        "relegated": {"name": "Subtopklasse", "from": ("Topklasse", (6,))},
    },
    "JO14": {
        "source_classes": ["Topklasse", "Subtopklasse"],
        "targets": [
            {"key": "super", "name": "Super O14", "pools": 5, "size": 6,
             "direct": [("Topklasse", (1, 2, 3), None)], "fill": [("Topklasse", 4)]},
            {"key": "idc", "name": "IDC O14", "pools": 6, "size": 6,
             "direct": [("Topklasse", (4, 5), None), ("Subtopklasse", (1, 2), None)],
             "fill": [("Subtopklasse", 3)]},
        ],
        "relegated": {"name": "Subtopklasse", "from": ("Topklasse", (6,))},
    },
}

_CATEGORY_RE = re.compile(r"\b(Meisjes|Jongens)\s*O(\d+)", re.IGNORECASE)
_CLUB_SUFFIX_RE = re.compile(r"\s+[MJ]O\d+-\d+\s*$", re.IGNORECASE)


def category_from_competition(name: str) -> Optional[str]:
    """'Meisjes O14 Herfst' -> 'MO14'."""
    m = _CATEGORY_RE.search(name or "")
    if not m:
        return None
    return f"{'M' if m.group(1).lower() == 'meisjes' else 'J'}O{m.group(2)}"


def club_of(team_name: str) -> str:
    return _CLUB_SUFFIX_RE.sub("", team_name or "").strip()


@dataclass
class TeamStanding:
    team_id: int
    team_name: str
    position: int
    played: int
    points: int
    goals_for: int
    goals_against: int
    club_logo_url: Optional[str] = None


@dataclass
class SourcePoule:
    label: str            # bv. "Zuid-Holland · Poule A"
    class_name: str       # Topklasse / Subtopklasse
    district: Optional[str]
    matches_played: int
    matches_total: int
    standings: list = field(default_factory=list)  # [TeamStanding], gesorteerd op positie


def br26_key(t: TeamStanding):
    """BR art. 2.6 over poules heen, genormaliseerd per gespeelde wedstrijd."""
    p = max(t.played, 1)
    return (-t.points / p, -(t.goals_for - t.goals_against) / p, -t.goals_for / p, t.team_name)


def _entry(poule: SourcePoule, t: TeamStanding, via: str) -> dict:
    return {
        "team_id": t.team_id, "team_name": t.team_name, "club": club_of(t.team_name),
        "club_logo_url": t.club_logo_url,
        "origin_class": poule.class_name, "origin_poule": poule.label,
        "origin_district": poule.district, "origin_position": t.position,
        "played": t.played, "points": t.points, "goal_diff": t.goals_for - t.goals_against,
        "goals_for": t.goals_for, "via": via,
        "provisional": poule.matches_played == 0,
        "_key": br26_key(t),
    }


def _at_position(poules, class_name, position, district=None):
    for p in poules:
        if p.class_name != class_name or (district and p.district != district):
            continue
        for t in p.standings:
            if t.position == position:
                yield p, t


def serpentine(entries: list, pool_count: int) -> list:
    """Verdeelt een plaatsingslijst slangsgewijs over pool_count poules.
    Bij een clubconflict (al een team van die club in de doelpoule) gaat het
    team naar de dichtstbijzijnde poule zonder conflict met de minste teams."""
    pools = [[] for _ in range(pool_count)]
    for i, e in enumerate(entries):
        rnd, idx = divmod(i, pool_count)
        target = idx if rnd % 2 == 0 else pool_count - 1 - idx
        if any(x["club"] == e["club"] for x in pools[target]):
            options = [k for k in range(pool_count) if not any(x["club"] == e["club"] for x in pools[k])]
            if options:
                target = min(options, key=lambda k: (len(pools[k]), abs(k - target)))
        e["pool_index"] = target
        pools[target].append(e)
    return pools


def forecast(category: str, poules: list) -> Optional[dict]:
    rules = RULES.get(category)
    if not rules:
        return None
    poules = [p for p in poules if p.class_name in rules["source_classes"]]
    if not poules:
        return None

    taken = set()
    warnings = []
    targets_out = []
    for tgt in rules["targets"]:
        capacity = tgt["pools"] * tgt["size"]
        entries = []

        def add(p, t, via):
            if t.team_id in taken:
                return
            taken.add(t.team_id)
            entries.append(_entry(p, t, via))

        for class_name, positions, district in tgt["direct"]:
            for pos in positions:
                for p, t in _at_position(poules, class_name, pos, district):
                    add(p, t, f"#{pos} {class_name}")
        for class_name, pos, district in tgt.get("district_best", []):
            cands = sorted(_at_position(poules, class_name, pos, district), key=lambda pt: br26_key(pt[1]))
            for p, t in cands:
                if t.team_id not in taken:
                    add(p, t, f"best #{pos} {class_name} {district}")
                    break
        for class_name, pos in tgt["fill"]:
            cands = sorted(_at_position(poules, class_name, pos), key=lambda pt: br26_key(pt[1]))
            for p, t in cands:
                if len(entries) >= capacity:
                    break
                add(p, t, f"best #{pos} {class_name}")

        if len(entries) != capacity:
            warnings.append(f"{tgt['name']}: {len(entries)} teams projected, capacity {capacity}")

        entries.sort(key=lambda e: (CLASS_LEVEL.get(e["origin_class"], 9), e["origin_position"], e["_key"]))
        for seed, e in enumerate(entries, 1):
            e["seed"] = seed
        pools = serpentine(entries, tgt["pools"])
        for e in entries:
            e.pop("_key", None)
        targets_out.append({
            "key": tgt["key"], "name": tgt["name"], "capacity": capacity,
            "seeding": entries,
            "pools": [{"name": f"Poule {chr(65 + i)}", "teams": pool} for i, pool in enumerate(pools)],
        })

    rel_class, rel_positions = rules["relegated"]["from"]
    relegated = [
        _entry(p, t, f"#{pos} {rel_class}")
        for pos in rel_positions for p, t in _at_position(poules, rel_class, pos)
    ]
    relegated.sort(key=lambda e: e.pop("_key"))

    for p in poules:
        if p.matches_played == 0:
            warnings.append(f"{p.class_name} {p.label}: no results yet, positions provisional")

    played = sum(p.matches_played for p in poules if p.class_name == rules["source_classes"][0])
    total = sum(p.matches_total for p in poules if p.class_name == rules["source_classes"][0])
    return {
        "category": category,
        "rule_source": RULE_SOURCE,
        "progress": {"played": played, "total": total},
        "targets": targets_out,
        "relegated": {"name": rules["relegated"]["name"], "teams": relegated},
        "warnings": warnings,
    }
