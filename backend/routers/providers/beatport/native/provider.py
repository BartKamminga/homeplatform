"""BeatCrades — NativeBeatportProvider: eigen Python-implementatie van de Beatport API.

Vereisten:
- Geldige credentials in BEATPORTDL_CONFIG_DIR/beatport-native-credentials.json
  (aangemaakt na eerste login via BEATPORT_USERNAME / BEATPORT_PASSWORD)
- pip install mutagen httpx
"""

import asyncio
import logging
import os
from typing import Optional

from routers.downloader_helpers import update_job
from ...base import DownloadProvider, DownloadResult
from .auth import BeatportAuth
from .download import run_download

logger = logging.getLogger("homeplatform.beatcrades.beatport.native.provider")


class NativeBeatportProvider(DownloadProvider):
    """Eigen Python-implementatie van de Beatport v4 API."""

    def __init__(self) -> None:
        self._cancelled = asyncio.Event()
        self._auth = BeatportAuth()

    @property
    def name(self) -> str:
        return "beatport-native"

    async def download(
        self,
        *,
        url: str,
        download_dir: str,
        fmt: str,
        job_id: str,
        crade_id: Optional[str],
        crade_name: Optional[str],
    ) -> DownloadResult:
        self._cancelled.clear()

        if not self._auth.is_authenticated():
            ok, err = await self._ensure_auth(job_id)
            if not ok:
                return DownloadResult(success=False, error=err)

        update_job(job_id, status="running", progress="Native Beatport provider gestart...")

        success, playlist_name, track_count, error = await run_download(
            url=url,
            download_dir=download_dir,
            fmt=fmt,
            job_id=job_id,
            crade_name=crade_name,
            auth=self._auth,
            cancelled=self._cancelled,
        )

        if success:
            return DownloadResult(
                success=True,
                playlist_name=playlist_name,
                track_count=track_count,
                move_dir=False,
            )
        return DownloadResult(success=False, error=error or "Onbekende fout.")

    async def cancel(self) -> None:
        self._cancelled.set()

    async def _ensure_auth(self, job_id: str) -> tuple[bool, Optional[str]]:
        """Probeer in te loggen via omgevingsvariabelen."""
        try:
            from core.settings import settings
            username = os.environ.get("BEATPORT_USERNAME") or getattr(settings, "BEATPORT_USERNAME", None)
            password = os.environ.get("BEATPORT_PASSWORD") or getattr(settings, "BEATPORT_PASSWORD", None)
        except Exception:
            username = os.environ.get("BEATPORT_USERNAME")
            password = os.environ.get("BEATPORT_PASSWORD")

        if not username or not password:
            return False, (
                "Native Beatport provider: geen credentials. "
                "Stel BEATPORT_USERNAME en BEATPORT_PASSWORD in als omgevingsvariabelen."
            )

        try:
            update_job(job_id, progress="Beatport login...")
            await self._auth.login(username, password)
            return True, None
        except Exception as exc:
            logger.error("Beatport login mislukt: %s", exc)
            return False, f"Beatport login mislukt: {exc}"
