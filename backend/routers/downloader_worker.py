"""BeatCrades — achtergrond-worker: semaphore, provider-dispatch.

De worker is volledig source-agnostisch. Hij laadt de job uit de DB,
kiest via de factory de juiste provider en delegeert het volledige
download-proces aan die provider.
"""

import asyncio
import logging
import os
from typing import Optional

from sqlmodel import Session

from core.database import engine
from core.settings import settings
from models.downloader import DownloadCrade, DownloadCradeGroup, DownloadJob, DownloadSection
from routers.downloader_helpers import rename_crade, update_job, write_info_file
from routers.providers.factory import get_provider
from routers.providers.base import DownloadProvider

logger = logging.getLogger("homeplatform.beatcrades.worker")


# ── Download-wachtrij ─────────────────────────────────────────────────────────

# Actieve providers per job_id — gebruikt door /cancel endpoint
active_downloads: dict[str, DownloadProvider] = {}

# Max 2 gelijktijdige downloads; overige jobs wachten als 'queued'
_DOWNLOAD_SEM = asyncio.Semaphore(2)


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
        crade_name:      Optional[str] = None
        crade_artist:    Optional[str] = None
        crade_item_type: Optional[str] = None
        subdir = ""
        if crade_id:
            crade = s.get(DownloadCrade, crade_id)
            if crade:
                crade_name      = crade.name
                crade_artist    = crade.artist
                crade_item_type = crade.item_type
                subdir          = crade.subdir or ""

    download_dir = os.path.join(settings.DOWNLOAD_DIR, subdir) if subdir else settings.DOWNLOAD_DIR

    try:
        os.makedirs(download_dir, exist_ok=True)
    except Exception as e:
        update_job(job_id, status="error", error=f"Kan download-map niet aanmaken: {e}")
        return

    provider = get_provider(source)
    active_downloads[job_id] = provider

    try:
        result = await provider.download(
            url=url,
            download_dir=download_dir,
            fmt=fmt,
            job_id=job_id,
            crade_id=crade_id,
            crade_name=crade_name,
        )
    except asyncio.CancelledError:
        await provider.cancel()
        update_job(job_id, status="error", error="Download gestopt door gebruiker.")
        raise
    except FileNotFoundError as e:
        tool = e.filename or "onbekend"
        update_job(job_id, status="error",
                   error=f"'{tool}' niet gevonden. Zorg dat het geïnstalleerd is in de Docker-container.")
        return
    except Exception as e:
        update_job(job_id, status="error", error=str(e)[:500])
        return
    finally:
        active_downloads.pop(job_id, None)

    if result.success:
        update_job(job_id, status="done", output_path=result.output_path)
        if result.playlist_name and crade_id:
            rename_crade(crade_id, result.playlist_name, move_dir=result.move_dir)
        write_info_file(
            download_dir,
            name=crade_name,
            url=url,
            provider=provider.name,
            fmt=fmt,
            track_count=result.track_count,
            output_path=result.output_path,
            artist=crade_artist,
            item_type=crade_item_type,
        )
        logger.info(
            "Download klaar [%s] source=%s provider=%s tracks=%d",
            job_id, source, provider.name, result.track_count,
        )
    else:
        error = (result.error or "Onbekende fout")[:1500]
        update_job(job_id, status="error", error=error)
        logger.error("Download mislukt [%s] source=%s: %s", job_id, source, error[:300])
