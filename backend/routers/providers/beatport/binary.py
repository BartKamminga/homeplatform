"""BeatCrades — BinaryBeatportProvider: wrapper rond de beatportdl Go-binary.

beatportdl:
- buffert alle stdout (geen TTY → geen real-time output tijdens download)
- geeft altijd exit 1 door EOF in interactieve modus (normaal gedrag)
- organiseert downloads in: downloads_dir/Playlists/<naam>/ of Releases/<naam>/
"""

import asyncio
import logging
import os
import re
import shutil
import tempfile
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from core.settings import settings
from routers.downloader_helpers import update_job
from ..base import DownloadProvider, DownloadResult
from .watcher import watch_progress

logger = logging.getLogger("homeplatform.beatcrades.beatport.binary")

# ── Constanten ─────────────────────────────────────────────────────────────────

NOISE_LINES = ("enter url or search query", "error reading input string")

TYPE_DIRS = frozenset([
    "playlists", "releases", "tracks", "charts", "mixes", "labels", "artists",
])

_AUDIO_EXTS = frozenset([".flac", ".mp3", ".wav", ".m4a", ".ogg", ".opus", ".webm"])

_GO_PANIC_RE = re.compile(r"^goroutine \d+", re.MULTILINE)

_ERR_KW = ("error", "fail", "fatal", "exception", "unauthorized", "invalid", "denied")

_NO_OUTPUT_TIMEOUT = 1800  # seconden zonder output → forceer kill
_READLINE_TIMEOUT  = 12    # seconden wachten per readline → heartbeat-tick


# ── Voorbereiding context ──────────────────────────────────────────────────────

@dataclass
class _PrepContext:
    work_dir: str
    before_dirs: set = field(default_factory=set)
    cmd: list = field(default_factory=list)


# ── Provider ───────────────────────────────────────────────────────────────────

class BinaryBeatportProvider(DownloadProvider):
    """Roept de beatportdl Go-binary aan als subprocess."""

    def __init__(self) -> None:
        self._proc: Optional[asyncio.subprocess.Process] = None
        self._stop: asyncio.Event = asyncio.Event()
        self._watcher: Optional[asyncio.Task] = None

    @property
    def name(self) -> str:
        return "beatportdl-binary"

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
        ctx = self._prepare(url, download_dir, job_id)
        if ctx is None:
            return DownloadResult(success=False, error="Config voorbereiding mislukt.")

        try:
            self._proc = await asyncio.create_subprocess_exec(
                *ctx.cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                stdin=asyncio.subprocess.DEVNULL,
                cwd=ctx.work_dir,
            )
            self._watcher = asyncio.create_task(
                watch_progress(download_dir, job_id, self._stop, ctx.before_dirs)
            )

            lines, error_hints = await self._read_loop(job_id)

            self._stop.set()
            if self._watcher and not self._watcher.done():
                try:
                    await asyncio.wait_for(self._watcher, timeout=5)
                except (asyncio.TimeoutError, asyncio.CancelledError):
                    self._watcher.cancel()

            await self._proc.wait()
            _copy_credentials_back(ctx.work_dir)

            output_path   = _first_new_dir(download_dir, ctx.before_dirs)
            playlist_name = _content_name(download_dir, ctx.before_dirs)
            has_content   = bool(output_path or playlist_name)
            real_errors   = [h for h in error_hints if "error reading input string" not in h.lower()]
            succeeded     = has_content or not real_errors

            logger.info(
                "Resultaat [%s] has_content=%s playlist_name=%r output_path=%r real_errors=%d",
                job_id, has_content, playlist_name, output_path, len(real_errors),
            )

            if succeeded:
                return DownloadResult(
                    success=True,
                    playlist_name=playlist_name,
                    output_path=output_path,
                    move_dir=False,
                    track_count=sum(1 for l in lines if l.startswith("Finished")),
                )
            return DownloadResult(
                success=False,
                error=_build_error(self._proc, lines, real_errors),
            )

        finally:
            if ctx.work_dir:
                shutil.rmtree(ctx.work_dir, ignore_errors=True)

    async def cancel(self) -> None:
        self._stop.set()
        if self._watcher:
            self._watcher.cancel()
        if self._proc:
            try:
                self._proc.kill()
            except Exception:
                pass

    # ── Interne methoden ───────────────────────────────────────────────────────

    def _prepare(self, url: str, download_dir: str, job_id: str) -> Optional[_PrepContext]:
        config_dir = settings.BEATPORTDL_CONFIG_DIR
        if not config_dir:
            update_job(job_id, status="error", error="BEATPORTDL_CONFIG_DIR niet geconfigureerd.")
            return None

        base_config = os.path.join(config_dir, "beatportdl-config.yml")
        if not os.path.exists(base_config):
            update_job(job_id, status="error",
                       error=f"Hernoem je config naar 'beatportdl-config.yml' in {config_dir}")
            return None

        work_dir = None
        try:
            work_dir = tempfile.mkdtemp(prefix=f"bdl_{job_id}_")

            cfg: dict[str, str] = {}
            with open(base_config, "r", encoding="utf-8") as f:
                for line in f:
                    stripped = line.strip()
                    if not stripped or stripped.startswith("#"):
                        continue
                    if ":" in stripped:
                        key, _, val = stripped.partition(":")
                        cfg[key.strip()] = val.strip()

            cfg["downloads_directory"] = download_dir
            cfg["show_progress"] = "false"

            with open(os.path.join(work_dir, "beatportdl-config.yml"), "w", encoding="utf-8") as f:
                for key, val in cfg.items():
                    if any(c in val for c in ':#{}[]|>&*!,"\''):
                        f.write(f'{key}: "{val.replace(chr(34), chr(92)+chr(34))}"\n')
                    else:
                        f.write(f"{key}: {val}\n")

            creds_src = os.path.join(config_dir, "beatportdl-credentials.json")
            if os.path.exists(creds_src):
                shutil.copy2(creds_src, os.path.join(work_dir, "beatportdl-credentials.json"))

        except Exception as e:
            if work_dir:
                shutil.rmtree(work_dir, ignore_errors=True)
            update_job(job_id, status="error", error=f"Kan beatportdl config niet laden: {e}")
            return None

        before_dirs: set = set()
        if os.path.exists(download_dir):
            before_dirs = {
                e for e in os.listdir(download_dir)
                if os.path.isdir(os.path.join(download_dir, e))
            }

        return _PrepContext(work_dir=work_dir, before_dirs=before_dirs, cmd=["beatportdl", url])

    async def _read_loop(self, job_id: str) -> tuple:
        """Lees stdout van beatportdl. Geeft (lines, error_hints) terug.

        beatportdl buffert alles → de read-loop geeft niets tot het proces klaar is.
        Heartbeat pings (last_progress_at) worden elke _READLINE_TIMEOUT s gestuurd
        zodat de UI weet dat de job nog actief is.
        """
        lines: list[str] = []
        error_hints: list[str] = []
        last_output = datetime.utcnow()

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
                update_job(job_id, last_progress_at=now)
                continue

            if not raw:
                break

            last_output = datetime.utcnow()
            line = raw.decode(errors="replace").rstrip()
            if not line:
                continue

            if any(kw in line.lower() for kw in NOISE_LINES):
                continue

            if any(kw in line.lower() for kw in _ERR_KW):
                error_hints.append(line)

            lines.append(line)
            if len(lines) > 60:
                lines.pop(0)

        return lines, error_hints


# ── Hulpfuncties ───────────────────────────────────────────────────────────────

def _first_new_dir(download_dir: str, before_dirs: set) -> Optional[str]:
    """Geeft de eerste nieuw aangemaakte top-level map terug (voor output_path)."""
    try:
        after = {e for e in os.listdir(download_dir) if os.path.isdir(os.path.join(download_dir, e))}
        new = sorted(after - before_dirs)
        return new[0] if new else None
    except OSError:
        return None


def _content_name(download_dir: str, before_dirs: set) -> Optional[str]:
    """Zoek de echte playlist/release-naam; kijk BINNEN type-mappen (Playlists/, Releases/…).

    Werkt ook bij restarts waarbij de type-map al bestond: zoekt naar de
    meest recentelijk gewijzigde submap binnen bestaande type-mappen.
    """
    try:
        after = {e for e in os.listdir(download_dir) if os.path.isdir(os.path.join(download_dir, e))}
    except OSError:
        return None

    new = sorted(after - before_dirs)

    # Stap 1: nieuwe type-mappen (eerste download)
    for d in new:
        if d.lower() in TYPE_DIRS:
            type_path = os.path.join(download_dir, d)
            try:
                subs = sorted(e for e in os.listdir(type_path)
                              if os.path.isdir(os.path.join(type_path, e)))
                if subs:
                    return subs[0].replace("_", " ").strip()
            except OSError:
                pass
        else:
            return d.replace("_", " ").strip()

    # Stap 2: bestaande type-mappen (restart) — pak de meest recent gewijzigde submap
    for d in sorted(before_dirs):
        if d.lower() not in TYPE_DIRS:
            continue
        type_path = os.path.join(download_dir, d)
        try:
            subs = [
                (e, os.path.getmtime(os.path.join(type_path, e)))
                for e in os.listdir(type_path)
                if os.path.isdir(os.path.join(type_path, e))
            ]
            if subs:
                return max(subs, key=lambda x: x[1])[0].replace("_", " ").strip()
        except OSError:
            pass

    return None


def _copy_credentials_back(work_dir: str) -> None:
    """Kopieer vernieuwde credentials terug naar de config-map."""
    config_dir = settings.BEATPORTDL_CONFIG_DIR
    if not config_dir:
        return
    creds_new = os.path.join(work_dir, "beatportdl-credentials.json")
    if os.path.exists(creds_new):
        try:
            shutil.copy2(creds_new, os.path.join(config_dir, "beatportdl-credentials.json"))
        except Exception as exc:
            logger.warning("Kan credentials niet terugkopieren: %s", exc)



def _build_error(proc, lines: list[str], real_errors: list[str]) -> str:
    if _is_go_panic(lines):
        return (
            f"Beatportdl is gecrasht (panic): {_panic_reason(lines)}\n"
            "Controleer je Beatport-sessie en klik op ↺ om opnieuw te starten."
        )
    if real_errors:
        return (f"[exit {proc.returncode}]\n" + "\n".join(real_errors[-10:])).strip()
    return (f"[exit {proc.returncode}]\n" + "\n".join(lines[-10:])).strip()


def _is_go_panic(lines: list[str]) -> bool:
    return any(_GO_PANIC_RE.match(l) for l in lines)


def _panic_reason(lines: list[str]) -> str:
    for line in lines:
        if "panic:" in line.lower():
            return line.strip()
    for line in lines:
        ll = line.lower()
        if any(k in ll for k in ("tls", "connection reset", "eof", "timeout", "deadline exceeded", "i/o timeout")):
            return line.strip()
    return "Onverwachte crash (beatportdl panic)"
