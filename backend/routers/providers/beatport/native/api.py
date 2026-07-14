"""BeatCrades — Native Beatport v4 API client.

Endpoints:
  GET /catalog/tracks/{id}/
  GET /catalog/tracks/{id}/download/?quality=<kwaliteit>
  GET /catalog/releases/{id}/
  GET /catalog/releases/{id}/tracks/   (gepagineerd)
  GET /catalog/playlists/{id}/
  GET /catalog/playlists/{id}/tracks/  (gepagineerd)

Paginatie: page + per_page queryparams; ga door zolang 'next' niet null is.
"""

import logging
from typing import Generic, List, Optional, TypeVar

import httpx
from pydantic import BaseModel, Field

from .auth import BeatportAuth, BASE_URL, USER_AGENT, _TIMEOUT

logger = logging.getLogger("homeplatform.beatcrades.beatport.native.api")

T = TypeVar("T")


# ── Modellen ───────────────────────────────────────────────────────────────────

class BPArtist(BaseModel):
    id: int
    name: str
    slug: Optional[str] = None


class BPImage(BaseModel):
    id: Optional[int] = None
    uri: Optional[str] = None
    dynamic_uri: Optional[str] = None

    def url(self, width: int = 1400) -> Optional[str]:
        if self.dynamic_uri:
            return (
                self.dynamic_uri
                .replace("{w}", str(width))
                .replace("{h}", str(width))
            )
        return self.uri


class BPLabel(BaseModel):
    id: int
    name: str
    slug: Optional[str] = None


class BPKey(BaseModel):
    camelot_number: Optional[int] = None
    camelot_letter: Optional[str] = None
    name: Optional[str] = None

    def label(self) -> str:
        if self.name:
            return self.name
        if self.camelot_number and self.camelot_letter:
            return f"{self.camelot_number}{self.camelot_letter}"
        return ""


class BPGenre(BaseModel):
    id: int
    name: str
    slug: Optional[str] = None


class BPReleaseSummary(BaseModel):
    id: int
    name: str
    catalog_number: Optional[str] = None
    upc: Optional[str] = None
    image: Optional[BPImage] = None
    new_release_date: Optional[str] = None
    label: Optional[BPLabel] = None


class BPTrack(BaseModel):
    id: int
    name: str
    mix_name: Optional[str] = None
    bpm: Optional[int] = None
    key: Optional[BPKey] = None
    genre: Optional[BPGenre] = None
    sub_genre: Optional[BPGenre] = None
    isrc: Optional[str] = None
    artists: List[BPArtist] = Field(default_factory=list)
    remixers: List[BPArtist] = Field(default_factory=list)
    publish_date: Optional[str] = None
    release: Optional[BPReleaseSummary] = None
    url: Optional[str] = None
    number: Optional[int] = None
    disc_number: Optional[int] = None

    def title(self) -> str:
        if self.mix_name and self.mix_name.lower() != "original mix":
            return f"{self.name} ({self.mix_name})"
        return self.name

    def artist_str(self) -> str:
        names = [a.name for a in self.artists] + [a.name for a in self.remixers]
        if len(names) > 3:
            return ", ".join(names[:3]) + " & Others"
        return ", ".join(names) if names else "Unknown Artist"


class BPRelease(BaseModel):
    id: int
    name: str
    catalog_number: Optional[str] = None
    upc: Optional[str] = None
    label: Optional[BPLabel] = None
    new_release_date: Optional[str] = None
    image: Optional[BPImage] = None


class BPPlaylistItem(BaseModel):
    id: int
    track: Optional[BPTrack] = None
    position: Optional[int] = None


class BPPlaylist(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    item_count: Optional[int] = None
    image: Optional[BPImage] = None


# ── Client ─────────────────────────────────────────────────────────────────────

class BeatportClient:
    """Async HTTP-client voor de Beatport v4 API."""

    def __init__(self, auth: BeatportAuth) -> None:
        self._auth = auth

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._auth.access_token}",
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        }

    async def _get(self, path: str, **params) -> dict:
        async with httpx.AsyncClient(
            base_url=BASE_URL,
            headers=self._headers(),
            timeout=_TIMEOUT,
            follow_redirects=True,
        ) as client:
            resp = await client.get(path, params={k: v for k, v in params.items() if v is not None})
            if resp.status_code == 401:
                logger.info("Token verlopen — verversen...")
                await self._auth.refresh()
                async with httpx.AsyncClient(
                    base_url=BASE_URL,
                    headers=self._headers(),
                    timeout=_TIMEOUT,
                    follow_redirects=True,
                ) as client2:
                    resp = await client2.get(path, params=params)
            resp.raise_for_status()
            return resp.json()

    async def get_track(self, track_id: int) -> BPTrack:
        data = await self._get(f"/catalog/tracks/{track_id}/")
        return BPTrack.model_validate(data)

    async def get_track_download_url(self, track_id: int, quality: str) -> str:
        """Geeft de directe download-URL voor een track terug.

        Verwacht response: {"location": "https://..."} of {"url": "..."}
        """
        data = await self._get(f"/catalog/tracks/{track_id}/download/", quality=quality)
        return data.get("location") or data.get("url") or ""

    async def get_release(self, release_id: int) -> BPRelease:
        data = await self._get(f"/catalog/releases/{release_id}/")
        return BPRelease.model_validate(data)

    async def get_release_tracks(self, release_id: int) -> List[BPTrack]:
        return await self._paginate_all(f"/catalog/releases/{release_id}/tracks/", BPTrack)

    async def get_playlist(self, playlist_id: int) -> BPPlaylist:
        data = await self._get(f"/catalog/playlists/{playlist_id}/")
        return BPPlaylist.model_validate(data)

    async def get_playlist_tracks(self, playlist_id: int) -> List[BPTrack]:
        items = await self._paginate_all(f"/catalog/playlists/{playlist_id}/tracks/", BPPlaylistItem)
        return [item.track for item in items if item.track]

    async def _paginate_all(self, path: str, model_cls, per_page: int = 100) -> list:
        results = []
        page = 1
        while True:
            data = await self._get(path, page=page, per_page=per_page)
            batch = data.get("results", [])
            results.extend(model_cls.model_validate(item) for item in batch)
            if not data.get("next"):
                break
            page += 1
        return results

    async def download_file(self, url: str, dest_path: str) -> None:
        """Download een pre-signed URL naar dest_path (streaming)."""
        async with httpx.AsyncClient(
            headers={"User-Agent": USER_AGENT},
            timeout=httpx.Timeout(300.0),
            follow_redirects=True,
        ) as client:
            async with client.stream("GET", url) as resp:
                resp.raise_for_status()
                with open(dest_path, "wb") as f:
                    async for chunk in resp.aiter_bytes(chunk_size=64 * 1024):
                        f.write(chunk)
