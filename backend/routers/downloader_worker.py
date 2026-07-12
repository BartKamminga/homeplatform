"""BeatCrades — achtergrond-worker: semaphore, lees-loop, dispatch.

Verantwoordelijk voor:
- max 2 gelijktijdige downloads via asyncio.Semaphore
- gedeelde lees-loop met heartbeat-pings naar de DB
- dispatch naar de juiste downloader (beatport / yt-dlp)
"""

import asyncio
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from sqlmodel import Session

from core.database import engine
from core.settings import settings
from models.downloader import DownloadCrade, DownloadJob
from routers.downloader_helpers import update_job
import routers.downloader_beatport as beatport
import routers.downloader_ytdlp as ytdlp

logger = logging.getLogger("homeplatform.beatcrades.worker")


# ── Download-wachtrij ─────────────────────────────────────────────────────────

# Actieve processen per job_id — gebruikt door /cancel endpoint
active_procs: dict[str, asyncio.subprocess.Process] = {}

# Max 2 gelijktijdige downloads; overige jobs wachten als 'queued'
_DOWNLOAD_SEM = asyncio.Semaphore(2)

# Proces wordt gekilled als er 30 minuten geen output is
_NO_OUTPUT_TIMEOUT = 1800

# Readline-timeout in seconden; zorgt voor heartbeat-pings ook bij geen output
_READLINE_TIMEOUT = 12

# yt-dlp percentage-regels worden herkend en overschrijven de vorige regel
_PERCENT_RE = re.compile(r"^\[download\]\s+\d")

# Fout-trefwoorden voor het verzamelen van fout-hints
_ERR_KW = ("error", "fail", "fatal", "exception", "unauthorized", "invalid", "denied")


# ── Read-loop resultaat ───────────────────────────────────────────────────────

@dataclass
class _ReadResult:
    lines: list        = field(default_factory=list)
    output_path: Optional[str] = None
    detected_name: Optional[str] = None
    error_hints: list  = field(default_factory=list)
    timed_out: bool    = False


# ── Publiek entry-point ───────────────────────────────────────────────────────

async def run_download(job_id: str) -> None:
    """Semaphore-wrapper: maximaal 2 downloads tegelijk."""
    async with _DOWNLOAD_SEM:
        await _run_inner(job_id)


# ── Interne orchestratie ──────────────────────────────────────────────────────

async def _run_inner(job_id: str) -> None:
    update_job(job_id, status="downloading", progress_log="")

    # Laad job-context uit DB
    with Session(engine) as s:
        job = s.get(DownloadJob, job_id)
        if not job:
            return
        url        = job.url
        source     = job.source
        fmt        = job.format
        crade_id   = job.crade_id
        crade_name: Optional[str] = None
        subdir     = ""
        if crade_id:
            crade = s.get(DownloadCrade, crade_id)
            if crade:
                crade_name = crade.name
                subdir     = crade.subdir or ""

    download_dir = os.path.join(settings.DOWNLOAD_DIR, subdir) if subdir else settings.DOWNLOAD_DIR

    try:
        os.makedirs(download_dir, exist_ok=True)
    except Exception as e:
        update_job(job_id, status="error", error=f"Kan download-map niet aanmaken: {e}")
        return

    # ── Voorbereiding per bron ────────────────────────────────────────────────

    work_dir    = None
    before_dirs: set = set()

    if source == "beatport":
        ctx = beatport.prepare(url, download_dir, job_id)
        if ctx is None:
            return  # prepare() heeft de job al op 'error' gezet
        work_dir    = ctx.work_dir
        before_dirs = ctx.before_dirs
        cmd         = ctx.cmd
    else:
        cmd = ytdlp.build_cmd(url, fmt, download_dir)

    # ── Proces starten ────────────────────────────────────────────────────────

    proc            = None
    _stop_watcher   = None
    _watcher        = None
    try:
        proc_kwargs = {
            "stdout": asyncio.subprocess.PIPE,
            "stderr": asyncio.subprocess.STDOUT,
            "stdin":  asyncio.subprocess.DEVNULL,  # voorkomt interactieve modus in beatportdl
        }
        if work_dir:
            proc_kwargs["cwd"] = work_dir

        proc = await asyncio.create_subprocess_exec(*cmd, **proc_kwargs)
        active_procs[job_id] = proc

        # ── Lees-loop met heartbeat ───────────────────────────────────────────
        # Voor beatport: scan tegelijkertijd de downloadmap voor real-time voortgang.
        # beatportdl buffert alles → de read-loop geeft niets tot het klaar is.

        if source == "beatport":
            _stop_watcher = asyncio.Event()
            _watcher = asyncio.create_task(
                beatport.watch_progress(download_dir, job_id, _stop_watcher, before_dirs)
            )

        result = await _read_loop(proc, job_id, source)

        if source == "beatport" and _stop_watcher and _watcher:
            _stop_watcher.set()
            try:
                await asyncio.wait_for(_watcher, timeout=5)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                _watcher.cancel()
            _watcher = None

        if result.timed_out:
            update_job(
                job_id, status="error",
                error=f"Download gestopt: geen output in {_NO_OUTPUT_TIMEOUT // 60} minuten. "
                      "Klik op 'Herstarten' om opnieuw te proberen.",
            )
            return

        await proc.wait()
        update_job(job_id, progress_log="\n".join(result.lines))
        logger.debug(
            "Proces klaar [%s] source=%s exit=%s regels=%d detected_name=%r",
            job_id, source, proc.returncode, len(result.lines), result.detected_name,
        )

        # ── Resultaat-verwerking per bron ─────────────────────────────────────

        if source == "beatport":
            beatport.handle_result(
                job_id=job_id, crade_id=crade_id, crade_name=crade_name,
                url=url, fmt=fmt, proc=proc,
                lines=result.lines, error_hints=result.error_hints,
                detected_name=result.detected_name,
                work_dir=work_dir, before_dirs=before_dirs, download_dir=download_dir,
            )
        else:
            ytdlp.handle_result(
                job_id=job_id, crade_id=crade_id, crade_name=crade_name,
                proc=proc, lines=result.lines, error_hints=result.error_hints,
                detected_name=result.detected_name,
            )

    except asyncio.CancelledError:
        if proc:
            try:
                proc.kill()
            except Exception:
                pass
        update_job(job_id, status="error", error="Download gestopt door gebruiker.")
        raise
    except FileNotFoundError as e:
        tool = e.filename or cmd[0]
        update_job(job_id, status="error",
                   error=f"'{tool}' niet gevonden. Zorg dat het geïnstalleerd is in de Docker-container.")
    except Exception as e:
        update_job(job_id, status="error", error=str(e)[:500])
    finally:
        # Watcher opruimen als die nog draait (bijv. na exception)
        if _watcher and not _watcher.done():
            if _stop_watcher:
                _stop_watcher.set()
            _watcher.cancel()
        active_procs.pop(job_id, None)
        if work_dir:
            import shutil
            shutil.rmtree(work_dir, ignore_errors=True)


# ── Gedeelde lees-loop ────────────────────────────────────────────────────────

async def _read_loop(proc, job_id: str, source: str) -> _ReadResult:
    """Leest stdout van het proces, schrijft voortgang naar DB, retourneert ReadResult.

    Heartbeat: als het proces geen output geeft (beatportdl buffert alles),
    wordt elke _READLINE_TIMEOUT seconden toch een DB-ping gedaan zodat de UI
    weet dat de download nog actief is.
    """
    result      = _ReadResult()
    flush_count = 0
    last_output = datetime.utcnow()
    last_ping   = datetime.utcnow()
    # beatportdl heeft geen playlist-header; naam-detectie verloopt via mapstructuur.
    # yt-dlp geeft wel een playlist-naam regel.
    name_patterns = [ytdlp.PLAYLIST_NAME_RE]

    while True:
        try:
            raw = await asyncio.wait_for(proc.stdout.readline(), timeout=_READLINE_TIMEOUT)
        except asyncio.TimeoutError:
            now = datetime.utcnow()
            if (now - last_output).total_seconds() >= _NO_OUTPUT_TIMEOUT:
                proc.kill()
                result.timed_out = True
                return result
            # Heartbeat: laat de UI weten dat het proces nog actief is
            prog = "\n".join(result.lines) if result.lines else _waiting_msg(source)
            update_job(job_id, progress_log=prog, last_progress_at=now)
            last_ping = now
            continue

        if not raw:
            break

        last_output = datetime.utcnow()
        line = raw.decode(errors="replace").rstrip()
        if not line:
            continue

        # Ruis-filter: beatportdl-interactieve-modus berichten overslaan
        if source == "beatport" and any(kw in line.lower() for kw in beatport.NOISE_LINES):
            continue

        # Huidig track-bestandspad (voor CradeRow "♪ Naam" display)
        m = re.search(r"Destination: (.+\.(?:flac|mp3|m4a|ogg|opus|wav))", line, re.IGNORECASE)
        if m:
            result.output_path = os.path.basename(m.group(1).strip())

        # Playlist/release naam detectie (beide downloaders)
        if result.detected_name is None:
            for pat in name_patterns:
                pm = pat.match(line)
                if pm:
                    raw_name = pm.group(1).strip()
                    # Strip eventueel trailing beatportdl ID: "My Playlist (123456)"
                    result.detected_name = re.sub(r"\s*\(\d+\)\s*$", "", raw_name).strip()
                    break

        # Fout-hints verzamelen voor foutmelding bij mislukking
        if any(kw in line.lower() for kw in _ERR_KW):
            result.error_hints.append(line)

        # Percentage-regels (yt-dlp) overschrijven de vorige in plaats van appenden
        now = datetime.utcnow()
        if bool(_PERCENT_RE.match(line)) and result.lines and _PERCENT_RE.match(result.lines[-1]):
            result.lines[-1] = line
        else:
            result.lines.append(line)
            if len(result.lines) > 60:
                result.lines.pop(0)
            flush_count += 1

        # DB-update: elke 5 nieuwe regels of elke 30 seconden
        do_ping = (now - last_ping).total_seconds() >= 30
        if flush_count >= 5 or do_ping:
            update_job(job_id, progress_log="\n".join(result.lines), last_progress_at=now)
            flush_count = 0
            last_ping = now

    return result


def _waiting_msg(source: str) -> str:
    if source == "beatport":
        return "Beatportdl gestart, wachten op eerste output…"
    return "Downloaden gestart, wachten op voortgang…"
