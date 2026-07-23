"""Scrapster router — scrape hockey match pages and return a combined match list."""

import logging
import time
import re

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter

logger = logging.getLogger("homeplatform")

router = APIRouter(prefix="/api/scrapster", tags=["scrapster"])

COMPETITION_URLS = [
    "https://masters.altiusrt.com/competitions/485/matches",
    "https://masters.altiusrt.com/competitions/484/matches",
    "https://masters.altiusrt.com/competitions/483/matches",
    "https://masters.altiusrt.com/competitions/482/matches",
]

CACHE_TTL = 55  # seconds

_cache: dict = {"data": None, "ts": 0}


def _extract_competition_name(soup: BeautifulSoup, url: str) -> str:
    """Extract the competition/tournament name from the page."""
    # Try <h1> first
    h1 = soup.find("h1")
    if h1 and h1.get_text(strip=True):
        return h1.get_text(strip=True)

    # Try <h2>
    h2 = soup.find("h2")
    if h2 and h2.get_text(strip=True):
        return h2.get_text(strip=True)

    # Try <title>
    title = soup.find("title")
    if title and title.get_text(strip=True):
        text = title.get_text(strip=True)
        # Strip common suffixes like " | Site Name"
        text = re.split(r"\s*[|–—]\s*", text)[0].strip()
        if text:
            return text

    # Fallback: derive from URL
    comp_id = url.rstrip("/").split("/")[-2]
    return f"Competition {comp_id}"


def _parse_matches(html: str, url: str) -> list[dict]:
    """Parse match rows from the HTML page."""
    soup = BeautifulSoup(html, "html.parser")
    competition_name = _extract_competition_name(soup, url)

    # Find the match table — look for a table whose id/class contains "match"
    table = None
    for t in soup.find_all("table"):
        t_id = t.get("id", "")
        t_class = " ".join(t.get("class", []))
        if "match" in t_id.lower() or "match" in t_class.lower():
            table = t
            break

    # Fallback: first table on the page
    if table is None:
        table = soup.find("table")

    if table is None:
        logger.warning("scrapster: no table found on %s", url)
        return []

    matches = []
    rows = table.find("tbody")
    if rows:
        rows = rows.find_all("tr")
    else:
        rows = table.find_all("tr")[1:]  # skip header row

    for row in rows:
        cells = row.find_all(["td", "th"])
        if len(cells) < 6:
            continue

        def cell_text(idx: int) -> str:
            if idx < len(cells):
                return cells[idx].get_text(separator=" ", strip=True)
            return ""

        match_num = cell_text(0)
        datetime_str = cell_text(1)
        details = cell_text(2)
        scoreline = cell_text(3)
        status = cell_text(4)
        venue = cell_text(5)

        # Skip header-like rows
        if match_num.lower() in ("match", "#", "nr", "num", "number"):
            continue

        matches.append(
            {
                "match_num": match_num,
                "datetime_str": datetime_str,
                "details": details,
                "scoreline": scoreline,
                "status": status,
                "venue": venue,
                "source": competition_name,
                "competition_url": url,
            }
        )

    return matches


async def _fetch_all_matches() -> list[dict]:
    """Fetch and parse all competition URLs, skip failures gracefully."""
    all_matches: list[dict] = []

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        for url in COMPETITION_URLS:
            try:
                response = await client.get(url)
                response.raise_for_status()
                matches = _parse_matches(response.text, url)
                all_matches.extend(matches)
                logger.info("scrapster: fetched %d matches from %s", len(matches), url)
            except Exception as exc:
                logger.warning("scrapster: failed to fetch %s — %s", url, exc)

    return all_matches


@router.get("/matches")
async def get_matches():
    """Return combined match list from all competition URLs. Cached for 55 seconds."""
    now = time.time()
    if _cache["data"] is not None and (now - _cache["ts"]) < CACHE_TTL:
        return {"matches": _cache["data"], "cached": True, "cache_age": int(now - _cache["ts"])}

    matches = await _fetch_all_matches()
    _cache["data"] = matches
    _cache["ts"] = now

    return {"matches": matches, "cached": False, "cache_age": 0}
