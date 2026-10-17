"""VBT Real Ride: straatfoto's van Mapillary langs een route.

- find_photos: per sectie (100 m) het dichtstbijzijnde beeld dat ongeveer de rijrichting op kijkt. We bewaren
  alleen de beeld-id's: de foto-URL's van Mapillary verlopen, die halen we vers op bij het rijden.
- photo_urls: verse URL's (en fotograaf voor de naamsvermelding) voor een lijst id's.
Het token (MAPILLARY_TOKEN) blijft op de server. Beelden: Mapillary, CC BY-SA 4.0.
"""
import asyncio
import math
from typing import Optional

import httpx

from core.settings import settings

GRAPH = "https://graph.mapillary.com"
BOX = 0.00045                  # ~50 m rond het punt
CONCURRENCY = 6


def configured() -> bool:
    return bool(settings.MAPILLARY_TOKEN)


def _bearing(a, b) -> float:
    la1, la2, dlon = math.radians(a[0]), math.radians(b[0]), math.radians(b[1] - a[1])
    x = math.sin(dlon) * math.cos(la2)
    y = math.cos(la1) * math.sin(la2) - math.sin(la1) * math.cos(la2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def _dist_m(a, b) -> float:
    dlat = (b[0] - a[0]) * 111_320
    dlon = (b[1] - a[1]) * 111_320 * math.cos(math.radians(a[0]))
    return math.hypot(dlat, dlon)


def pick(candidates: list, point, heading: float) -> Optional[dict]:
    """Beste beeld: dichtbij en kijkend in de rijrichting (afwijking telt als extra meters)."""
    best, best_score = None, None
    for c in candidates:
        geo = (c.get("computed_geometry") or c.get("geometry") or {}).get("coordinates")
        angle = c.get("computed_compass_angle", c.get("compass_angle"))
        if not geo or angle is None or c.get("is_pano"):
            continue
        off = abs((angle - heading + 180) % 360 - 180)
        if off > 60:
            continue
        score = _dist_m(point, (geo[1], geo[0])) + off * 0.5
        if best_score is None or score < best_score:
            best, best_score = c, score
    return best


async def find_photos(points: list) -> list:
    """[[sectie-index, beeld-id, kompas], ...] voor de secties waar een passend beeld is."""
    sem = asyncio.Semaphore(CONCURRENCY)
    out = []

    async def one(client, i):
        p = points[i]
        heading = _bearing(p, points[i + 1]) if i + 1 < len(points) else _bearing(points[max(0, i - 1)], p)
        params = {"access_token": settings.MAPILLARY_TOKEN, "limit": 20,
                  "fields": "id,computed_geometry,geometry,computed_compass_angle,compass_angle,is_pano",
                  "bbox": f"{p[1] - BOX},{p[0] - BOX},{p[1] + BOX},{p[0] + BOX}"}
        async with sem:
            try:
                r = await client.get(GRAPH + "/images", params=params)
                data = r.json().get("data", []) if r.status_code == 200 else []
            except httpx.HTTPError:
                data = []
        best = pick(data, p, heading)
        if best:
            out.append([i, best["id"], round(best.get("computed_compass_angle", best.get("compass_angle", 0)))])

    async with httpx.AsyncClient(timeout=20) as client:
        await asyncio.gather(*(one(client, i) for i in range(len(points))))
    return sorted(out)


async def photo_urls(ids: list) -> dict:
    """{id: {url, by}} met verse foto-URL's; per 50 id's één aanroep."""
    out = {}
    async with httpx.AsyncClient(timeout=20) as client:
        for k in range(0, len(ids), 50):
            chunk = ids[k:k + 50]
            params = {"access_token": settings.MAPILLARY_TOKEN, "ids": ",".join(chunk), "fields": "id,thumb_1024_url,creator"}
            try:
                r = await client.get(GRAPH, params=params)
                data = r.json() if r.status_code == 200 else {}
            except httpx.HTTPError:
                data = {}
            for i, v in (data or {}).items():
                if isinstance(v, dict) and v.get("thumb_1024_url"):
                    out[i] = {"url": v["thumb_1024_url"], "by": (v.get("creator") or {}).get("username")}
    return out
