"""BeatCrades — download queue met crades en groepen (beatportdl + yt-dlp)."""

import asyncio
import logging
import os
import re
import unicodedata
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from core.auth import get_current_user
from core.database import engine, get_session
from core.exceptions import AppError
from core.settings import settings
from models.downloader import DownloadCrade, DownloadCradeGroup, DownloadJob

router = APIRouter(prefix="/api/beatcrades", tags=["beatcrades"])
logger = logging.getLogger("homeplatform.beatcrades")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_name(name: str) -> str:
    """Zet een crade-naam om naar een veilige mapnaam."""
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_str = nfkd.encode("ascii", "ignore").decode()
    safe = re.sub(r"[^\w\-.]", "_", ascii_str).strip("_.")
    return safe or "crade"


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

_PERCENT_RE = re.compile(r"^\[download\]\s+\d")


async def _run_download(job_id: str):
    _update_job(job_id, status="downloading", progress_log="")

    with Session(engine) as s:
        job = s.get(DownloadJob, job_id)
        if not job:
            return
        url = job.url
        source = job.source
        fmt = job.format
        crade_id = job.crade_id

        # Bepaal download-map (crade subdir of root)
        subdir = ""
        if crade_id:
            crade = s.get(DownloadCrade, crade_id)
            if crade and crade.subdir:
                subdir = crade.subdir

    download_dir = os.path.join(settings.DOWNLOAD_DIR, subdir) if subdir else settings.DOWNLOAD_DIR

    try:
        os.makedirs(download_dir, exist_ok=True)
    except Exception as e:
        _update_job(job_id, status="error", error=f"Kan download-map niet aanmaken: {e}")
        return

    if source == "beatport":
        cmd = ["beatportdl", "-d", download_dir]
        if settings.BEATPORTDL_CONFIG_DIR:
            cmd += ["-c", settings.BEATPORTDL_CONFIG_DIR]
        cmd.append(url)
    else:
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
            stderr=asyncio.subprocess.STDOUT,
        )

        lines: list = []
        flush_count = 0
        output_path = None

        async for raw in proc.stdout:
            line = raw.decode(errors="replace").rstrip()
            if not line:
                continue

            m = re.search(r"Destination: (.+\.(?:flac|mp3|m4a|ogg|opus|wav))", line, re.IGNORECASE)
            if m:
                output_path = os.path.basename(m.group(1).strip())

            is_percent = bool(_PERCENT_RE.match(line))
            if is_percent and lines and _PERCENT_RE.match(lines[-1]):
                lines[-1] = line
            else:
                lines.append(line)
                if len(lines) > 40:
                    lines.pop(0)
                flush_count += 1
                if flush_count >= 5:
                    _update_job(job_id, progress_log="\n".join(lines))
                    flush_count = 0

        await proc.wait()
        _update_job(job_id, progress_log="\n".join(lines))

        if proc.returncode == 0:
            _update_job(job_id, status="done", output_path=output_path)
            logger.info("Download klaar: %s → %s", job_id, output_path)
        else:
            error_lines = [l for l in lines if "error" in l.lower()]
            error = "\n".join(error_lines[-5:]) if error_lines else "\n".join(lines[-5:])
            _update_job(job_id, status="error", error=error[:1000].strip())
            logger.warning("Download mislukt: %s", job_id)

    except FileNotFoundError as e:
        tool = e.filename or cmd[0]
        _update_job(job_id, status="error",
                    error=f"'{tool}' niet gevonden. Zorg dat het geïnstalleerd is in de Docker-container.")
    except Exception as e:
        _update_job(job_id, status="error", error=str(e)[:500])


# ── Schemas ───────────────────────────────────────────────────────────────────

class GroupCreate(BaseModel):
    name: str


class GroupUpdate(BaseModel):
    name: str


class GroupOut(BaseModel):
    id: str
    name: str
    created_at: datetime


class CradeCreate(BaseModel):
    name: str = ""
    source_url: str
    format: str = "flac"
    group_id: Optional[str] = None


class CradeUpdate(BaseModel):
    name: Optional[str] = None
    group_id: Optional[str] = None


class CradeOut(BaseModel):
    id: str
    name: str
    subdir: str
    group_id: Optional[str]
    source_url: Optional[str]
    format: str
    created_at: datetime
    # Afgeleid van laatste job:
    status: str
    progress_log: Optional[str]
    error: Optional[str]
    output_path: Optional[str]
    job_id: Optional[str]


class TreeOut(BaseModel):
    groups: List[GroupOut]
    crades: List[CradeOut]


# ── Groups ────────────────────────────────────────────────────────────────────

@router.post("/groups", response_model=GroupOut)
def create_group(
    body: GroupCreate,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    g = DownloadCradeGroup(name=body.name.strip(), created_by=user.id)
    session.add(g)
    session.commit()
    session.refresh(g)
    return g


@router.patch("/groups/{group_id}")
def update_group(
    group_id: str,
    body: GroupUpdate,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    g = session.get(DownloadCradeGroup, group_id)
    if not g:
        raise AppError(404, "Groep niet gevonden")
    g.name = body.name.strip()
    g.updated_at = datetime.utcnow()
    session.add(g)
    session.commit()
    return {"ok": True}


@router.delete("/groups/{group_id}")
def delete_group(
    group_id: str,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    g = session.get(DownloadCradeGroup, group_id)
    if not g:
        raise AppError(404, "Groep niet gevonden")
    # Crades loskoppelen (niet verwijderen)
    for c in session.exec(select(DownloadCrade).where(DownloadCrade.group_id == group_id)).all():
        c.group_id = None
        c.updated_at = datetime.utcnow()
        session.add(c)
    session.delete(g)
    session.commit()
    return {"ok": True}


# ── Crades ────────────────────────────────────────────────────────────────────

def _today_name() -> str:
    d = datetime.utcnow()
    return f"{d.day:02d}-{d.month:02d}-{d.year}"


@router.post("/crades", response_model=CradeOut)
async def create_crade(
    body: CradeCreate,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    url = body.url.strip() if hasattr(body, 'url') else body.source_url.strip()
    url = body.source_url.strip()
    if not url:
        raise AppError(400, "URL mag niet leeg zijn")

    name = body.name.strip() or _today_name()
    subdir = _safe_name(name)

    # Maak subdir uniek als die al bestaat voor een andere crade
    existing_subdirs = {
        c.subdir for c in session.exec(select(DownloadCrade)).all()
    }
    base = subdir
    counter = 1
    while subdir in existing_subdirs:
        subdir = f"{base}_{counter}"
        counter += 1

    crade = DownloadCrade(
        name=name,
        subdir=subdir,
        group_id=body.group_id or None,
        source_url=url,
        format=body.format,
        created_by=user.id,
    )
    session.add(crade)
    session.commit()
    session.refresh(crade)

    source = _detect_source(url)
    job = DownloadJob(
        url=url,
        source=source,
        format=body.format,
        crade_id=crade.id,
        created_by=user.id,
    )
    session.add(job)
    session.commit()
    session.refresh(job)

    background_tasks.add_task(_run_download, job.id)

    return CradeOut(
        id=crade.id, name=crade.name, subdir=crade.subdir,
        group_id=crade.group_id, source_url=crade.source_url,
        format=crade.format, created_at=crade.created_at,
        status=job.status, progress_log=job.progress_log,
        error=job.error, output_path=job.output_path, job_id=job.id,
    )


@router.patch("/crades/{crade_id}")
def update_crade(
    crade_id: str,
    body: CradeUpdate,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    c = session.get(DownloadCrade, crade_id)
    if not c:
        raise AppError(404, "Crade niet gevonden")
    if body.name is not None:
        c.name = body.name.strip()
    if "group_id" in body.model_fields_set:
        c.group_id = body.group_id or None
    c.updated_at = datetime.utcnow()
    session.add(c)
    session.commit()
    return {"ok": True}


@router.delete("/crades/{crade_id}")
def delete_crade(
    crade_id: str,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    c = session.get(DownloadCrade, crade_id)
    if not c:
        raise AppError(404, "Crade niet gevonden")
    for job in session.exec(select(DownloadJob).where(DownloadJob.crade_id == crade_id)).all():
        session.delete(job)
    session.delete(c)
    session.commit()
    return {"ok": True}


# ── Tree ──────────────────────────────────────────────────────────────────────

@router.get("/tree", response_model=TreeOut)
def get_tree(
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    groups = session.exec(
        select(DownloadCradeGroup).order_by(DownloadCradeGroup.created_at)
    ).all()

    crades = session.exec(
        select(DownloadCrade).order_by(DownloadCrade.created_at.desc())
    ).all()

    crade_outs = []
    for c in crades:
        job = session.exec(
            select(DownloadJob)
            .where(DownloadJob.crade_id == c.id)
            .order_by(DownloadJob.created_at.desc())
            .limit(1)
        ).first()
        crade_outs.append(CradeOut(
            id=c.id, name=c.name, subdir=c.subdir,
            group_id=c.group_id, source_url=c.source_url,
            format=c.format, created_at=c.created_at,
            status=job.status if job else "no_job",
            progress_log=job.progress_log if job else None,
            error=job.error if job else None,
            output_path=job.output_path if job else None,
            job_id=job.id if job else None,
        ))

    return TreeOut(
        groups=[GroupOut(id=g.id, name=g.name, created_at=g.created_at) for g in groups],
        crades=crade_outs,
    )


# ── Legacy job-list (admin / backward compat) ─────────────────────────────────

class JobOut(BaseModel):
    id: str
    url: str
    source: str
    title: Optional[str]
    artist: Optional[str]
    status: str
    error: Optional[str]
    output_path: Optional[str]
    progress_log: Optional[str]
    format: str
    crade_id: Optional[str]
    created_at: datetime
    updated_at: datetime


@router.get("/jobs", response_model=List[JobOut])
def list_jobs(
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    return session.exec(
        select(DownloadJob).order_by(DownloadJob.created_at.desc()).limit(200)
    ).all()


# ── Stale-job reset (aangeroepen bij herstart) ────────────────────────────────

def reset_stale_jobs():
    with Session(engine) as s:
        stale = s.exec(select(DownloadJob).where(DownloadJob.status == "downloading")).all()
        for job in stale:
            job.status = "queued"
            job.updated_at = datetime.utcnow()
            s.add(job)
        if stale:
            s.commit()
            logger.info("%d download-job(s) gereset naar 'queued' na herstart", len(stale))
