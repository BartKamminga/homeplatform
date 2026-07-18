"""BeatCrades — DownloadProvider ABC en DownloadResult dataclass."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class DownloadResult:
    success: bool
    playlist_name: Optional[str] = None
    track_count: int = 0
    output_path: Optional[str] = None
    move_dir: bool = False  # True → rename_crade verplaatst ook de map op disk
    error: Optional[str] = None
    stalled: bool = False   # True → no-output timeout getriggerd; worker mag eenmalig herstarten


class DownloadProvider(ABC):
    """Abstract base voor alle download-backends in BeatCrades.

    Implementaties:
      BinaryBeatportProvider  — beatportdl Go-binary als subprocess
      NativeBeatportProvider  — eigen Python-implementatie van de Beatport API
      YtdlpProvider           — yt-dlp als subprocess
    """

    @abstractmethod
    async def download(
        self,
        *,
        url: str,
        download_dir: str,
        fmt: str,
        job_id: str,
        crade_id: Optional[str],
        crade_name: Optional[str],
        filename_template: str = "{title} - {artist}",
    ) -> DownloadResult:
        """Start de download. Schrijft voortgang naar DB via update_job().
        Retourneert DownloadResult na afsluiting."""
        ...

    @abstractmethod
    async def cancel(self) -> None:
        """Annuleer de lopende download graceful."""
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """Leesbare naam voor logging en diagnostiek."""
        ...
