"""BeatCrades — NativeBeatportProvider: stub voor fase 2.

De native Python-implementatie van de Beatport API wordt hier gebouwd
zodra auth.py, api.py en download.py gereed zijn.
"""

import asyncio
from typing import Optional

from ...base import DownloadProvider, DownloadResult


class NativeBeatportProvider(DownloadProvider):
    """Eigen Python-implementatie van de Beatport API (fase 2 — nog niet gereed)."""

    def __init__(self) -> None:
        self._cancelled = asyncio.Event()

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
        return DownloadResult(
            success=False,
            error="Native Beatport provider is nog niet geïmplementeerd.",
        )

    async def cancel(self) -> None:
        self._cancelled.set()
