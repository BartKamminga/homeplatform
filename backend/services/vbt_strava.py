"""Strava-koppeling voor VBT: OAuth (autoriseren, tokens verversen) en FIT-uploads.

Het client secret blijft op de server; de browser krijgt alleen de authorize-URL en de uploadstatus.
"""
import time
from contextlib import asynccontextmanager
from datetime import timedelta
from typing import Optional

import httpx
from fastapi import HTTPException
from sqlmodel import Session

from core.analytics import log_site_event
from core.auth import create_access_token, decode_token
from core.settings import settings
from models.vbt import VbtStravaLink

AUTHORIZE_URL = "https://www.strava.com/oauth/authorize"
TOKEN_URL = "https://www.strava.com/oauth/token"
DEAUTHORIZE_URL = "https://www.strava.com/oauth/deauthorize"
UPLOADS_URL = "https://www.strava.com/api/v3/uploads"
SCOPE = "read,activity:write"
STATE_PURPOSE = "vbt-strava"


@asynccontextmanager
async def _strava_call(url: str):
    """httpx-client die elke Strava-call als source_call logt (admin > Site-monitoring)."""
    t0, box = time.time(), {"status": 0}
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            yield client, box
    finally:
        try:
            log_site_event("vbt", "source_call", source_url=url,
                           duration_ms=int((time.time() - t0) * 1000), status_code=box["status"])
        except Exception:
            pass


def configured() -> bool:
    return bool(settings.STRAVA_CLIENT_ID and settings.STRAVA_CLIENT_SECRET)


def redirect_uri() -> str:
    base = (settings.OIDC_REDIRECT_BASE or settings.EXTERNAL_URL or "http://localhost:8000").rstrip("/")
    return f"{base}/api/vbt/strava/callback"


def authorize_url(user_id: str) -> str:
    # state = kortlevend ondertekend token, zodat de callback (zonder JWT-header) weet voor wie het is
    state = create_access_token({"sub": user_id, "purpose": STATE_PURPOSE}, timedelta(minutes=10))
    params = httpx.QueryParams({
        "client_id": settings.STRAVA_CLIENT_ID,
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "approval_prompt": "auto",
        "scope": SCOPE,
        "state": state,
    })
    return f"{AUTHORIZE_URL}?{params}"


def user_from_state(state: str) -> str:
    try:
        payload = decode_token(state)
    except HTTPException:
        raise HTTPException(status_code=400, detail="Ongeldige of verlopen Strava-state")
    if payload.get("purpose") != STATE_PURPOSE or not payload.get("sub"):
        raise HTTPException(status_code=400, detail="Ongeldige Strava-state")
    return payload["sub"]


async def _token_request(data: dict) -> dict:
    data = {"client_id": settings.STRAVA_CLIENT_ID, "client_secret": settings.STRAVA_CLIENT_SECRET, **data}
    async with _strava_call(TOKEN_URL) as (client, box):
        r = await client.post(TOKEN_URL, data=data)
        box["status"] = r.status_code
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Strava token-fout ({r.status_code})")
    return r.json()


async def exchange_code(code: str, user_id: str, scope: Optional[str], session: Session) -> VbtStravaLink:
    data = await _token_request({"code": code, "grant_type": "authorization_code"})
    athlete = data.get("athlete") or {}
    link = session.get(VbtStravaLink, user_id) or VbtStravaLink(user_id=user_id, athlete_id="", access_token="", refresh_token="", expires_at=0)
    link.athlete_id = str(athlete.get("id", ""))
    link.athlete_name = " ".join(x for x in [athlete.get("firstname"), athlete.get("lastname")] if x) or None
    link.access_token = data["access_token"]
    link.refresh_token = data["refresh_token"]
    link.expires_at = int(data["expires_at"])
    link.scope = scope
    session.add(link)
    session.commit()
    session.refresh(link)
    return link


async def fresh_token(link: VbtStravaLink, session: Session) -> str:
    if link.expires_at - 120 > time.time():
        return link.access_token
    data = await _token_request({"grant_type": "refresh_token", "refresh_token": link.refresh_token})
    link.access_token = data["access_token"]
    link.refresh_token = data.get("refresh_token", link.refresh_token)
    link.expires_at = int(data["expires_at"])
    session.add(link)
    session.commit()
    return link.access_token


async def deauthorize(link: VbtStravaLink, session: Session) -> None:
    try:
        token = await fresh_token(link, session)
        async with httpx.AsyncClient(timeout=15) as client:
            await client.post(DEAUTHORIZE_URL, data={"access_token": token})
    except HTTPException:
        pass  # lokaal ontkoppelen gaat altijd door
    session.delete(link)
    session.commit()


async def upload_fit(link: VbtStravaLink, session: Session, fit: bytes, filename: str,
                     name: str, description: str, external_id: str) -> dict:
    token = await fresh_token(link, session)
    async with _strava_call(UPLOADS_URL) as (client, box):
        r = await client.post(
            UPLOADS_URL,
            headers={"Authorization": f"Bearer {token}"},
            data={"data_type": "fit", "name": name, "description": description,
                  "trainer": "1", "external_id": external_id},
            files={"file": (filename, fit, "application/octet-stream")},
        )
        box["status"] = r.status_code
    if r.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"Strava upload-fout ({r.status_code}): {r.text[:200]}")
    return r.json()


async def upload_status(link: VbtStravaLink, session: Session, upload_id: str) -> dict:
    token = await fresh_token(link, session)
    async with _strava_call(UPLOADS_URL) as (client, box):
        r = await client.get(f"{UPLOADS_URL}/{upload_id}", headers={"Authorization": f"Bearer {token}"})
        box["status"] = r.status_code
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Strava status-fout ({r.status_code})")
    return r.json()
