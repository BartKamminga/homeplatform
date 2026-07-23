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
    """Extract competition name from page heading or URL."""
    for tag in ("h1", "h2", "h3"):
        el = soup.find(tag)
        if el:
            text = el.get_text(strip=True)
            if text and len(text) < 80:
                return text

    # Fallback: competition ID from URL
    comp_id = url.rstrip("/").split("/")[-2]
    return f"Competition {comp_id}"


def _parse_matches(html: str, url: str) -> list[dict]:
    """Parse matches from altiusrt.com div#match-listing > div.panel structure."""
    soup = BeautifulSoup(html, "html.parser")
    competition_name = _extract_competition_name(soup, url)

    listing = soup.find("div", id="match-listing")
    if not listing:
        logger.warning("scrapster: no #match-listing found on %s", url)
        return []

    matches = []
    for panel in listing.find_all("div", class_="panel"):
        panel_classes = " ".join(panel.get("class", []))
        is_live = "panel-live" in panel_classes
        is_future = "panel-future" in panel_classes

        body = panel.find("div", class_="panel-body")
        if not body:
            continue

        # Teams + match URL from <a><b>TEAM1 - TEAM2</b></a>
        link = body.find("a")
        if not link:
            continue
        match_url = link.get("href", "")
        match_id = match_url.rstrip("/").split("/")[-1] if match_url else ""
        teams = link.get_text(strip=True)

        # Score: first <b> not inside the <a>
        score = ""
        for b in body.find_all("b"):
            if not b.find_parent("a"):
                score = b.get_text(strip=True)
                break

        # Status: remaining text lines after removing teams and score
        status_lines = []
        for line in body.get_text(separator="\n", strip=True).split("\n"):
            line = line.strip()
            if not line or line == teams or line == score:
                continue
            if len(line) > 60:
                continue
            status_lines.append(line)
        status = status_lines[0] if status_lines else ("Live" if is_live else ("Upcoming" if is_future else "FT"))

        matches.append({
            "match_num": match_id,
            "datetime_str": "",
            "details": teams,
            "scoreline": score,
            "status": status,
            "venue": "",
            "is_live": is_live,
            "source": competition_name,
            "competition_url": url,
        })

    logger.info("scrapster: parsed %d matches from %s", len(matches), url)
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
