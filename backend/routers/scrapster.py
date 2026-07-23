"""Scrapster router — scrape hockey match pages and return a combined match list."""

import json
import logging
import secrets
import time
from datetime import datetime
from typing import Optional

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlmodel import Session

from core.database import engine

logger = logging.getLogger("homeplatform")

router = APIRouter(prefix="/api/scrapster", tags=["scrapster"])

COMPETITION_URLS = [
    # World Cup Rotterdam
    "https://masters.altiusrt.com/competitions/485/matches",  # M50
    "https://masters.altiusrt.com/competitions/484/matches",  # W50
    "https://masters.altiusrt.com/competitions/483/matches",  # M45
    "https://masters.altiusrt.com/competitions/482/matches",  # W45
    # Rotterdam IMC
    "https://masters.altiusrt.com/competitions/493/matches",  # IMC M50
    "https://masters.altiusrt.com/competitions/492/matches",  # IMC M45
    "https://masters.altiusrt.com/competitions/490/matches",  # IMC M35/M40
    "https://masters.altiusrt.com/competitions/489/matches",  # IMC W50
    "https://masters.altiusrt.com/competitions/488/matches",  # IMC W45
    "https://masters.altiusrt.com/competitions/486/matches",  # IMC W35/40
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
    """Parse matches from altiusrt.com.

    The page has two sections:
    - div#match-listing with visual panels (used only for is_live via CSS class)
    - a <table class="table-condensed"> with full data including venue and datetime
    """
    soup = BeautifulSoup(html, "html.parser")
    competition_name = _extract_competition_name(soup, url)

    # Build is_live lookup from panels (panel-live CSS class is reliable for live state)
    is_live_map: dict[str, bool] = {}
    listing = soup.find("div", id="match-listing")
    if listing:
        for panel in listing.find_all("div", class_="panel"):
            panel_classes = " ".join(panel.get("class", []))
            body = panel.find("div", class_="panel-body")
            if not body:
                continue
            link = body.find("a")
            if not link:
                continue
            href = link.get("href", "")
            mid = href.rstrip("/").split("/")[-1] if href else ""
            if mid:
                is_live_map[mid] = "panel-live" in panel_classes

    # Parse the match table for full data (venue, datetime, match#, details, score, status)
    # The matches table lives inside a .table-responsive wrapper inside the blue portlet.
    # There are other table-condensed tables on the page (e.g. help FAQ), so scope the search.
    matches = []
    table_wrap = soup.find("div", class_="table-responsive")
    table = table_wrap.find("table") if table_wrap else None
    if not table:
        logger.warning("scrapster: no match table found on %s", url)
        return []

    tbody = table.find("tbody")
    if not tbody:
        return []

    for row in tbody.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) < 6:
            continue

        match_num = cells[0].get_text(strip=True)

        # Prefer machine-readable UTC datetime from data attribute
        dt_span = cells[1].find("span", attrs={"data-datetimelocal__notimechange": True})
        datetime_str = dt_span["data-datetimelocal__notimechange"] if dt_span else cells[1].get_text(strip=True)

        link = cells[2].find("a")
        if not link:
            continue
        match_href = link.get("href", "")
        match_id = match_href.rstrip("/").split("/")[-1] if match_href else ""
        details = link.get_text(strip=True)

        scoreline = cells[3].get_text(strip=True)
        status = cells[4].get_text(strip=True)
        venue = cells[5].get_text(strip=True)

        matches.append({
            "match_num": match_num,
            "datetime_str": datetime_str,
            "details": details,
            "scoreline": scoreline,
            "status": status,
            "venue": venue,
            "is_live": is_live_map.get(match_id, False),
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


# ── URL shortener ──────────────────────────────────────────────────────────

class ShortenRequest(BaseModel):
    venues: list[str] = []
    sources: list[str] = []
    pastFilter: str = "laatste3"


@router.post("/shorten")
def shorten_url(body: ShortenRequest):
    """Store filter state and return a short token."""
    filters_json = json.dumps({"venues": body.venues, "sources": body.sources, "pastFilter": body.pastFilter})
    token = secrets.token_urlsafe(5)  # ~7 chars

    with Session(engine) as session:
        # Collision retry (extremely unlikely)
        for _ in range(5):
            existing = session.exec(
                text("SELECT id FROM scrapster_short_urls WHERE token = :t"),
                params={"t": token},
            ).first()
            if not existing:
                break
            token = secrets.token_urlsafe(5)

        session.exec(
            text("INSERT INTO scrapster_short_urls (token, filters, created_at) VALUES (:t, :f, :c)"),
            params={"t": token, "f": filters_json, "c": datetime.utcnow()},
        )
        session.commit()

    return {"token": token}


@router.get("/s/{token}")
def resolve_short_url(token: str):
    """Resolve a short token back to filter state."""
    with Session(engine) as session:
        row = session.exec(
            text("SELECT filters FROM scrapster_short_urls WHERE token = :t"),
            params={"t": token},
        ).first()

    if not row:
        raise HTTPException(status_code=404, detail="Token niet gevonden")

    return json.loads(row[0])
