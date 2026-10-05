"""Clublocaties en reistijd (item 1184).

Geocoding via de PDOK locatieserver (gratis, Nederlandse overheid): eerst op
volledige postcode, anders op woonplaats. Reistijd is een ruwe schatting
(hemelsbreed x omrijfactor / gemiddelde snelheid + vaste op/afrit-tijd; geijkt
op o.a. Groningen-Maastricht ~3u30, Den Bosch-Groningen ~2u20) - bedoeld om te zien of een
voorspelde poule binnen de ~2 uur reistijd blijft die de KNHB bij O14 aanhoudt,
niet als routeplanner.
"""

import math
import re
from typing import Optional, Tuple

import httpx

PDOK_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free"
ROAD_FACTOR = 1.25     # weg-afstand t.o.v. hemelsbreed
AVG_SPEED_KMH = 100.0  # lange ritten zijn vrijwel helemaal snelweg
FIXED_MINUTES = 10     # op/afrit, stad in en uit

_POINT_RE = re.compile(r"POINT\(([-\d.]+) ([-\d.]+)\)")


def _pdok_point(client: httpx.Client, query: str, doc_type: str) -> Optional[Tuple[float, float]]:
    resp = client.get(PDOK_URL, params={"q": query, "fq": f"type:{doc_type}", "rows": 1, "fl": "centroide_ll"})
    resp.raise_for_status()
    docs = resp.json().get("response", {}).get("docs", [])
    m = _POINT_RE.match(docs[0].get("centroide_ll", "")) if docs else None
    return (float(m.group(2)), float(m.group(1))) if m else None  # (lat, lon)


def geocode(client: httpx.Client, zipcode: Optional[str], city: Optional[str]) -> Optional[Tuple[float, float]]:
    """(lat, lon) voor een club, of None als PDOK niets vindt."""
    zipcode = re.sub(r"\s+", "", zipcode or "").upper()
    if re.fullmatch(r"\d{4}[A-Z]{2}", zipcode):
        point = _pdok_point(client, zipcode, "postcode")
        if point:
            return point
    if city:
        return _pdok_point(client, city, "woonplaats")
    return None


def distance_km(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    """Hemelsbrede afstand (haversine) tussen twee (lat, lon)-punten."""
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def travel_minutes(km: float) -> int:
    return round(km * ROAD_FACTOR / AVG_SPEED_KMH * 60) + FIXED_MINUTES


def format_minutes(minutes: int) -> str:
    return f"{minutes // 60}h{minutes % 60:02d}"


def trips_over(teams: list, limit_minutes: int) -> list:
    """Alle clubparen binnen een poule met geschatte reistijd boven de grens,
    langste eerst: [(club_a, club_b, minutes)]."""
    located = [t for t in teams if t.get("lat") is not None and t.get("lon") is not None]
    trips = []
    for i, a in enumerate(located):
        for b in located[i + 1:]:
            minutes = travel_minutes(distance_km((a["lat"], a["lon"]), (b["lat"], b["lon"])))
            if minutes > limit_minutes:
                trips.append((a["club"], b["club"], minutes))
    return sorted(trips, key=lambda t: -t[2])


def max_travel(teams: list) -> Optional[dict]:
    """Grootste onderlinge reis binnen een poule. teams: dicts met club/lat/lon.
    None als minder dan twee teams een locatie hebben."""
    located = [t for t in teams if t.get("lat") is not None and t.get("lon") is not None]
    best = None
    for i, a in enumerate(located):
        for b in located[i + 1:]:
            km = distance_km((a["lat"], a["lon"]), (b["lat"], b["lon"]))
            if best is None or km > best[0]:
                best = (km, a["club"], b["club"])
    if best is None:
        return None
    km, a, b = best
    return {
        "km": round(km), "minutes": travel_minutes(km), "between": [a, b],
        "unknown": len(teams) - len(located),
    }
