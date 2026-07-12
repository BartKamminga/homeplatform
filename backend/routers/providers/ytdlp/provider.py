"""BeatCrades — YtdlpProvider: wrapper rond yt-dlp.

yt-dlp:
- geeft real-time output (geen bufferprobleem)
- exit 0 bij succes, non-zero bij mislukking
- detecteert playlist-naam via stdout: "[youtube:tab] Playlist Naam: Downloading N items"
"""

import asyncio
import logging
import re
from datetime import datetime
from typing import Optional

from routers.downloader_helpers import update_job
from ..base import DownloadProvider, DownloadResult

logger = logging.getLogger("homeplatform.beatcrades.ytdlp")

# ── Constanten ─────────────────────────────────────────────────────────────────

PLAYLIST_NAME_RE = re.compile(
    r"^\[[\w:]+\] Playlist (.+?): Downloading \d+ items",
    re.IGNORECASE,
)

_PERCENT_RE = re.compile(r"^\[download\]\s+\d")

_ERR_KW = ("error", "fail", "fatal", "exception", "unauthorized", "invalid", "denied")

_NO_OUTPUT_TIMEOUT = 1800
_READLINE_TIMEOUT  = 12


# ── Provider ───────────────────────────────────────────────────────────────────

class YtdlpProvider(DownloadProvider):
    """Roept yt-dlp aan als subprocess; geeft real-time output."""

    def __init__(self) -> None:
        self._proc: Optional[asyncio.subprocess.Process] = None

    @property
    def name(self) -> str:
        return "yt-dlp"

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
        cmd = _build_cmd(url, fmt, download_dir)
        self._proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            stdin=asyncio.subprocess.DEVNULL,
        )

        lines, detected_name, error_hints = await self._read_loop(job_id)
        await self._proc.wait()

        logger.debug(
            "Klaar [%s] exit=%s regels=%d detected_name=%r",
            job_id, self._proc.returncode, len(lines), detected_name,
        )

        if self._proc.returncode == 0:
            return DownloadResult(
                success=True,
                playlist_name=detected_name,
                move_dir=True,
            )
        return DownloadResult(
            success=False,
            error=_build_error(self._proc, error_hints, lines),
        )

    async def cancel(self) -> None:
        if self._proc:
            try:
                self._proc.kill()
            except Exception:
                pass

    async def _read_loop(self, job_id: str) -> tuple:
        """Lees stdout van yt-dlp en schrijf voortgang naar DB.

        Geeft (lines, detected_name, error_hints) terug.
        """
        lines: list[str] = []
        error_hints: list[str] = []
        detected_name: Optional[str] = None
        last_output = last_ping = datetime.utcnow()
        flush_count = 0

        while True:
            try:
                raw = await asyncio.wait_for(
                    self._proc.stdout.readline(), timeout=_READLINE_TIMEOUT
                )
            except asyncio.TimeoutError:
                now = datetime.utcnow()
                if (now - last_output).total_seconds() >= _NO_OUTPUT_TIMEOUT:
                    self._proc.kill()
                    break
                prog = "\n".join(lines) if lines else "Downloaden gestart…"
                update_job(job_id, progress_log=prog, last_progress_at=now)
                last_ping = now
                continue

            if not raw:
                break

            last_output = datetime.utcnow()
            line = raw.decode(errors="replace").rstrip()
            if not line:
                continue

            if detected_name is None:
                m = PLAYLIST_NAME_RE.match(line)
                if m:
                    detected_name = m.group(1).strip()

            if any(kw in line.lower() for kw in _ERR_KW):
                error_hints.append(line)

            if _PERCENT_RE.match(line) and lines and _PERCENT_RE.match(lines[-1]):
                lines[-1] = line
            else:
                lines.append(line)
                if len(lines) > 60:
                    lines.pop(0)
                flush_count += 1

            now = datetime.utcnow()
            if flush_count >= 5 or (now - last_ping).total_seconds() >= 30:
                update_job(job_id, progress_log="\n".join(lines), last_progress_at=now)
                flush_count = 0
                last_ping = now

        return lines, detected_name, error_hints


# ── Hulpfuncties ───────────────────────────────────────────────────────────────

def _build_cmd(url: str, fmt: str, download_dir: str) -> list[str]:
    return [
        "yt-dlp", "-x",
        "--audio-format", fmt,
        "--audio-quality", "0",
        "-P", download_dir,
        "-o", "%(artist,uploader)s - %(title)s.%(ext)s",
        url,
    ]


def _build_error(proc, error_hints: list[str], lines: list[str]) -> str:
    if error_hints:
        return (f"[exit {proc.returncode}]\n" + "\n".join(error_hints[-10:])).strip()
    return (f"[exit {proc.returncode}]\n" + "\n".join(lines[-10:])).strip()
