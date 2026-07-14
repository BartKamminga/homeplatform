"""BeatCrades — Native Beatport download-orchestrator.

Detecteert URL-type (track / release / playlist / chart) uit de Beatport-URL,
haalt metadata op via de API, downloadt elk audiobestand en tagt het.

Kwaliteit-mapping (te bevestigen via live API):
  flac → "lossless"
  wav  → "lossless"
  mp3  → "medium-quality"  (320 kbps)
"""

import asyncio
import logging
import os
from typing import Optional
from urllib.parse import urlparse

import httpx

from routers.downloader_helpers import update_job
from .auth import BeatportAuth
from .api import BeatportClient, BPTrack
from .tagger import tag_track

logger = logging.getLogger("homeplatform.beatcrades.beatport.native.download")

_FMT_TO_QUALITY: dict[str, str] = {
    "flac": "lossless",
    "wav":  "lossless",
    "mp3":  "medium-quality",
}

_TYPE_MAP: dict[str, str] = {
    "track":     "tracks",
    "tracks":    "tracks",
    "release":   "releases",
    "releases":  "releases",
    "playlist":  "playlists",
    "playlists": "playlists",
    "chart":     "charts",
    "charts":    "charts",
}


def parse_beatport_url(url: str) -> tuple[str, int]:
    """Geef (link_type, id) terug voor een Beatport-URL.

    link_type: 'tracks' | 'releases' | 'playlists' | 'charts'
    """
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if host not in ("www.beatport.com", "api.beatport.com"):
        raise ValueError(f"Geen Beatport-URL: {url!r}")

    segments = [s for s in parsed.path.split("/") if s]

    # Strip locale prefix (2-char, bijv. "en") en "catalog"
    while segments and (len(segments[0]) == 2 or segments[0] == "catalog"):
        segments.pop(0)

    if not segments:
        raise ValueError(f"Kan URL-type niet bepalen: {url!r}")

    link_type = _TYPE_MAP.get(segments[0].lower())
    if not link_type:
        raise ValueError(f"Onbekend URL-type {segments[0]!r} in: {url!r}")

    # ID staat doorgaans als laatste segment (na slug) of direct op positie 1
    link_id: Optional[int] = None
    for seg in reversed(segments[1:]):
        try:
            link_id = int(seg)
            break
        except ValueError:
            continue

    if link_id is None:
        raise ValueError(f"Geen numeriek ID gevonden in URL: {url!r}")

    return link_type, link_id


async def download_cover(image_url: str) -> Optional[bytes]:
    """Download cover art; retourneert None bij fouten."""
    if not image_url:
        return None
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0), follow_redirects=True) as client:
            resp = await client.get(image_url)
            resp.raise_for_status()
            return resp.content
    except Exception as exc:
        logger.warning("Cover download mislukt (%s): %s", image_url, exc)
        return None


async def run_download(
    *,
    url: str,
    download_dir: str,
    fmt: str,
    job_id: str,
    crade_name: Optional[str],
    auth: BeatportAuth,
    cancelled: asyncio.Event,
) -> tuple[bool, Optional[str], int, Optional[str]]:
    """Voer de volledige download uit.

    Retourneert (success, playlist_name, track_count, error_message).
    """
    client = BeatportClient(auth)
    quality = _FMT_TO_QUALITY.get(fmt, "lossless")

    try:
        link_type, link_id = parse_beatport_url(url)
    except ValueError as exc:
        return False, None, 0, str(exc)

    update_job(job_id, progress="Metadata ophalen...")
    try:
        if link_type == "tracks":
            tracks, name = await _load_track(client, link_id)
        elif link_type == "releases":
            tracks, name = await _load_release(client, link_id)
        elif link_type in ("playlists", "charts"):
            tracks, name = await _load_playlist(client, link_id)
        else:
            return False, None, 0, f"Niet-ondersteund type: {link_type}"
    except Exception as exc:
        logger.error("Metadata ophalen mislukt: %s", exc)
        return False, None, 0, f"Metadata ophalen mislukt: {exc}"

    if not tracks:
        return False, name, 0, "Geen tracks gevonden."

    safe_name = _safe_dirname(name or f"beatport_{link_id}")
    dest_dir = os.path.join(download_dir, safe_name)
    os.makedirs(dest_dir, exist_ok=True)

    count = 0
    for i, track in enumerate(tracks):
        if cancelled.is_set():
            break
        update_job(job_id, progress=f"{i + 1}/{len(tracks)}: {track.title()}")
        if await _download_track(client, track, dest_dir, fmt, quality):
            count += 1

    return True, name, count, None


async def _load_track(client: BeatportClient, track_id: int) -> tuple[list[BPTrack], str]:
    track = await client.get_track(track_id)
    return [track], track.title()


async def _load_release(client: BeatportClient, release_id: int) -> tuple[list[BPTrack], str]:
    release = await client.get_release(release_id)
    tracks = await client.get_release_tracks(release_id)
    return tracks, release.name


async def _load_playlist(client: BeatportClient, playlist_id: int) -> tuple[list[BPTrack], str]:
    playlist = await client.get_playlist(playlist_id)
    tracks = await client.get_playlist_tracks(playlist_id)
    return tracks, playlist.name


async def _download_track(
    client: BeatportClient,
    track: BPTrack,
    dest_dir: str,
    fmt: str,
    quality: str,
) -> bool:
    try:
        dl_url = await client.get_track_download_url(track.id, quality)
        if not dl_url:
            logger.warning("Geen download-URL voor track %s", track.id)
            return False

        ext = ".flac" if fmt != "mp3" else ".mp3"
        filename = _safe_filename(f"{track.artist_str()} - {track.title()}{ext}")
        dest_path = os.path.join(dest_dir, filename)

        await client.download_file(dl_url, dest_path)

        cover_data: Optional[bytes] = None
        if track.release and track.release.image:
            img_url = track.release.image.url()
            if img_url:
                cover_data = await download_cover(img_url)

        tag_track(dest_path, track, cover_data)
        return True

    except Exception as exc:
        logger.error("Track %s download mislukt: %s", track.id, exc)
        return False


def _safe_filename(name: str) -> str:
    for ch in r'\/:*?"<>|':
        name = name.replace(ch, "_")
    return name[:200].strip()


def _safe_dirname(name: str) -> str:
    for ch in r'\/:*?"<>|':
        name = name.replace(ch, "_")
    return name[:100].strip()
