"""BeatCrades — Native Beatport OAuth2 authentication.

Auth flow (from beatportdl Go source analysis):
1. POST /auth/login/            → sessionid cookie
2. GET  /auth/o/authorize/...   → redirect met authorization code
3. POST /auth/o/token/          → access_token + refresh_token
4. Bearer op alle API-calls; vernieuwen via grant_type=refresh_token

Credentials worden opgeslagen in BEATPORTDL_CONFIG_DIR/beatport-native-credentials.json
"""

import json
import logging
import os
from typing import Optional
from urllib.parse import urlparse, parse_qs

import httpx

from core.settings import settings

logger = logging.getLogger("homeplatform.beatcrades.beatport.native.auth")

BASE_URL = "https://api.beatport.com/v4"
CLIENT_ID = "ryZ8LuyQVPqbK2mBX2Hwt4qSMtnWuTYSqBPO92yQ"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)
_TIMEOUT = httpx.Timeout(40.0)
_CREDS_FILE = "beatport-native-credentials.json"


def _creds_path() -> Optional[str]:
    d = getattr(settings, "BEATPORTDL_CONFIG_DIR", None)
    return os.path.join(d, _CREDS_FILE) if d else None


def _load_credentials() -> dict:
    path = _creds_path()
    if path and os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as exc:
            logger.warning("Kan credentials niet laden: %s", exc)
    return {}


def _save_credentials(data: dict) -> None:
    path = _creds_path()
    if not path:
        return
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as exc:
        logger.warning("Kan credentials niet opslaan: %s", exc)


def _extract_code(location: str) -> Optional[str]:
    """Haal de 'code'-parameter uit een redirect-URI."""
    if not location:
        return None
    try:
        qs = parse_qs(urlparse(location).query)
        codes = qs.get("code", [])
        return codes[0] if codes else None
    except Exception:
        return None


class BeatportAuth:
    """Beheert tokens voor de native Beatport provider."""

    def __init__(self) -> None:
        self._creds = _load_credentials()

    @property
    def access_token(self) -> Optional[str]:
        return self._creds.get("access_token")

    @property
    def refresh_token(self) -> Optional[str]:
        return self._creds.get("refresh_token")

    def is_authenticated(self) -> bool:
        return bool(self.access_token)

    async def login(self, username: str, password: str) -> None:
        """Volledig OAuth2-flow: login → sessionid → code → tokens."""
        async with httpx.AsyncClient(
            base_url=BASE_URL,
            headers={"User-Agent": USER_AGENT},
            timeout=_TIMEOUT,
            follow_redirects=False,
        ) as client:
            # Stap 1: login → sessionid cookie
            resp = await client.post(
                "/auth/login/",
                json={"username": username, "password": password},
            )
            resp.raise_for_status()
            session_id = resp.cookies.get("sessionid")
            if not session_id:
                raise RuntimeError("Geen sessionid in login-response — inloggen mislukt.")

            # Stap 2: authorize → authorization code via redirect-Location-header
            resp = await client.get(
                f"/auth/o/authorize/?client_id={CLIENT_ID}&response_type=code",
                cookies={"sessionid": session_id},
            )
            location = resp.headers.get("location", "")
            code = _extract_code(location)
            if not code:
                raise RuntimeError(
                    f"Geen authorization code in redirect: {location!r}\n"
                    "Controleer client_id en Beatport-accountrechten."
                )

            # Stap 3: code → tokens
            await self._exchange_code(client, code)

    async def _exchange_code(self, client: httpx.AsyncClient, code: str) -> None:
        resp = await client.post(
            "/auth/o/token/",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": CLIENT_ID,
                "redirect_uri": "",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        self._store_tokens(resp.json())

    async def refresh(self) -> None:
        """Ververs het access_token met het refresh_token."""
        if not self.refresh_token:
            raise RuntimeError("Geen refresh_token beschikbaar — log opnieuw in.")
        async with httpx.AsyncClient(
            base_url=BASE_URL,
            headers={"User-Agent": USER_AGENT},
            timeout=_TIMEOUT,
        ) as client:
            resp = await client.post(
                "/auth/o/token/",
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": self.refresh_token,
                    "client_id": CLIENT_ID,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
            self._store_tokens(resp.json())

    def set_tokens(self, access_token: str, refresh_token: Optional[str] = None) -> None:
        """Sla tokens direct op (bijv. vanuit een admin-endpoint)."""
        self._creds["access_token"] = access_token
        if refresh_token:
            self._creds["refresh_token"] = refresh_token
        _save_credentials(self._creds)

    def _store_tokens(self, tokens: dict) -> None:
        self._creds.update({
            "access_token": tokens["access_token"],
            "refresh_token": tokens.get("refresh_token", self.refresh_token),
        })
        _save_credentials(self._creds)
