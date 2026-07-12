"""BeatCrades — yt-dlp: commando en resultaatverwerking.

yt-dlp is een Python-tool die:
- real-time output geeft (geen bufferprobleem)
- exit 0 bij succes, non-zero bij mislukking
- zelf een mapnaam kiest op basis van de playlist-metadata
"""

import logging
import re
from typing import Optional

from routers.downloader_helpers import update_job, rename_crade

logger = logging.getLogger("homeplatform.beatcrades.ytdlp")


# ── Constanten ────────────────────────────────────────────────────────────────

# Playlist-naam herkenning uit yt-dlp output
PLAYLIST_NAME_RE = re.compile(
    r"^\[download\] Downloading playlist:\s*(.+)",
    re.IGNORECASE,
)


# ── Commando-opbouw ───────────────────────────────────────────────────────────

def build_cmd(url: str, fmt: str, download_dir: str) -> list[str]:
    """Bouw de yt-dlp commandoregel op."""
    return [
        "yt-dlp", "-x",
        "--audio-format", fmt,
        "--audio-quality", "0",
        "-P", download_dir,
        "-o", "%(artist,uploader)s - %(title)s.%(ext)s",
        url,
    ]


# ── Resultaatverwerking ───────────────────────────────────────────────────────

def handle_result(
    *,
    job_id: str,
    crade_id: Optional[str],
    crade_name: Optional[str],
    proc,
    lines: list[str],
    error_hints: list[str],
    detected_name: Optional[str],
) -> None:
    """Sluit een yt-dlp-run af: job afsluiten en crade eventueel hernoemen."""
    if proc.returncode == 0:
        update_job(job_id, status="done")
        logger.info("Download klaar [%s] crade=%r (yt-dlp)", job_id, crade_name)

        if detected_name and crade_id:
            # yt-dlp: verplaats ook de map naar de nieuwe naam
            rename_crade(crade_id, detected_name, move_dir=True)
    else:
        error = _build_error(proc, error_hints, lines)
        update_job(job_id, status="error", error=error[:1500])
        logger.error("Download mislukt [%s] exit=%d: %s", job_id, proc.returncode, error[:300])


def _build_error(proc, error_hints: list[str], lines: list[str]) -> str:
    if error_hints:
        return (f"[exit {proc.returncode}]\n" + "\n".join(error_hints[-10:])).strip()
    return (f"[exit {proc.returncode}]\n" + "\n".join(lines[-10:])).strip()
