"""Beatload — download queue voor Beatport (beatportdl) en YouTube/SoundCloud (yt-dlp)."""

import asyncio
import logging
import os
import re
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from core.auth import get_current_user
from core.database import engine, get_session
from core.exceptions import AppError
from core.settings import settings
from models.downloader import DownloadJob

router = APIRouter(prefix="/api/beatload", tags=["beatload"])
logger = logging.getLogger("homeplatform.beatload")


# ── Schemas ───────────────────────────────────────────────────────────────────

class JobCreate(BaseModel):
    url: str
    format: str = "flac"


class JobOut(BaseModel):
    id: str
    url: str
    source: str
    title: Optional[str]
    artist: Optional[str]
    status: str
    error: Optional[str]
    output_path: Optional[str]
    format: str
    created_at: datetime
    updated_at: datetime


# ── Helpers ───────────────────────────────────────────────────────────────────

def _detect_source(url: str) -> str:
    u = url.lower()
    if "beatport.com" in u or "beatsource.com" in u:
        return "beatport"
    if "youtu.be" in u or "youtube.com" in u:
        return "youtube"
    if "soundcloud.com" in u:
        return "soundcloud"
    return "auto"


def _update_job(job_id: str, **kwargs):
    with Session(engine) as s:
        job = s.get(DownloadJob, job_id)
        if not job:
            return
        for k, v in kwargs.items():
            setattr(job, k, v)
        job.updated_at = datetime.utcnow()
        s.add(job)
        s.commit()


# ── Background worker ─────────────────────────────────────────────────────────

async def _run_download(job_id: str):
    _update_job(job_id, status="downloading")

    with Session(engine) as s:
        job = s.get(DownloadJob, job_id)
        if not job:
            return
        url = job.url
        source = job.source
        fmt = job.format

    download_dir = settings.DOWNLOAD_DIR
    try:
        os.makedirs(download_dir, exist_ok=True)
    except Exception as e:
        _update_job(job_id, status="error", error=f"Kan download-map niet aanmaken: {e}")
        return

    if source == "beatport":
        # beatportdl flags: -d <dir>  (check je versie via `beatportdl --help`)
        cmd = ["beatportdl", "-d", download_dir]
        if settings.BEATPORTDL_CONFIG_DIR:
            cmd += ["-c", settings.BEATPORTDL_CONFIG_DIR]
        cmd.append(url)
    else:
        # yt-dlp: -x = extract audio, --audio-format = target format
        cmd = [
            "yt-dlp",
            "-x",
            "--audio-format", fmt,
            "--audio-quality", "0",
            "-P", download_dir,
            "-o", "%(uploader)s - %(title)s.%(ext)s",
            url,
        ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        out_text = stdout.decode(errors="replace")
        err_text = stderr.decode(errors="replace")

        if proc.returncode == 0:
            output_path = None
            # yt-dlp meldt het bestand bij [ExtractAudio] of [Merger]
            m = re.search(r"Destination: (.+\.(?:flac|mp3|m4a|ogg|opus|wav))", out_text, re.IGNORECASE)
            if m:
                output_path = os.path.basename(m.group(1).strip())
            _update_job(job_id, status="done", output_path=output_path)
            logger.info("Download klaar: %s → %s", job_id, output_path)
        else:
            error = (err_text or out_text)[:1000].strip()
            _update_job(job_id, status="error", error=error)
            logger.warning("Download mislukt: %s — %s", job_id, error[:200])

    except FileNotFoundError as e:
        tool = e.filename or cmd[0]
        _update_job(
            job_id,
            status="error",
            error=f"'{tool}' niet gevonden. Zorg dat het geïnstalleerd is in de Docker-container.",
        )
    except Exception as e:
        _update_job(job_id, status="error", error=str(e)[:500])


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/download", response_model=JobOut)
async def create_download(
    body: JobCreate,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    url = body.url.strip()
    if not url:
        raise AppError(400, "URL mag niet leeg zijn")

    source = _detect_source(url)
    job = DownloadJob(url=url, source=source, format=body.format, created_by=user.id)
    session.add(job)
    session.commit()
    session.refresh(job)

    background_tasks.add_task(_run_download, job.id)
    return job


@router.get("/jobs", response_model=List[JobOut])
def list_jobs(session: Session = Depends(get_session), user=Depends(get_current_user)):
    jobs = session.exec(
        select(DownloadJob).order_by(DownloadJob.created_at.desc()).limit(100)
    ).all()
    return jobs


@router.delete("/jobs/{job_id}")
def delete_job(
    job_id: str,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    job = session.get(DownloadJob, job_id)
    if not job:
        raise AppError(404, "Job niet gevonden")
    session.delete(job)
    session.commit()
    return {"ok": True}


def reset_stale_jobs():
    """Reset 'downloading'-jobs na een herstart (zodat ze opnieuw gequeued worden)."""
    with Session(engine) as s:
        stale = s.exec(select(DownloadJob).where(DownloadJob.status == "downloading")).all()
        for job in stale:
            job.status = "queued"
            job.updated_at = datetime.utcnow()
            s.add(job)
        if stale:
            s.commit()
            logger.info("%d download-job(s) gereset naar 'queued' na herstart", len(stale))
