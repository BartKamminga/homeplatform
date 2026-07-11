"""BeatCrades — download queue: Section → Rack → Crade (beatportdl + yt-dlp)."""

import asyncio
import logging
import os
import re
import shutil
import tempfile
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
from models.downloader import DownloadCrade, DownloadCradeGroup, DownloadJob, DownloadSection

router = APIRouter(prefix="/api/beatcrades", tags=["beatcrades"])
logger = logging.getLogger("homeplatform.beatcrades")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_name(name: str) -> str:
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

    # beatportdl leest altijd 'beatportdl-config.yml' vanuit de werkdirectory.
    # downloads_directory is verplicht in de config. Geen -c of -d flags.
    # We schrijven per job een temp config met de juiste downloads_directory.
    work_dir = None

    if source == "beatport":
        config_dir = settings.BEATPORTDL_CONFIG_DIR
        if not config_dir:
            _update_job(job_id, status="error", error="BEATPORTDL_CONFIG_DIR niet geconfigureerd.")
            return
        base_config = os.path.join(config_dir, "beatportdl-config.yml")
        if not os.path.exists(base_config):
            _update_job(job_id, status="error",
                        error=f"Hernoem je config naar 'beatportdl-config.yml' in {config_dir}")
            return
        try:
            work_dir = tempfile.mkdtemp(prefix=f"bdl_{job_id}_")
            # Lees basis-config als key:value paren (negeert comments/lege regels).
            # Schrijf schone YAML zonder comments om encoding-problemen te vermijden.
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
            with open(os.path.join(work_dir, "beatportdl-config.yml"), "w", encoding="utf-8") as f:
                for key, val in cfg.items():
                    # Quoted als de waarde YAML-special chars bevat
                    if any(c in val for c in ':#{}[]|>&*!,"\''):
                        f.write(f'{key}: "{val.replace(chr(34), chr(92)+chr(34))}"\n')
                    else:
                        f.write(f"{key}: {val}\n")
            creds_src = os.path.join(config_dir, "beatportdl-credentials.json")
            if os.path.exists(creds_src):
                shutil.copy2(creds_src, os.path.join(work_dir, "beatportdl-credentials.json"))
        except Exception as e:
            _update_job(job_id, status="error", error=f"Kan beatportdl config niet laden: {e}")
            if work_dir:
                shutil.rmtree(work_dir, ignore_errors=True)
            return
        cmd = ["beatportdl", url]
    else:
        cmd = [
            "yt-dlp", "-x",
            "--audio-format", fmt,
            "--audio-quality", "0",
            "-P", download_dir,
            "-o", "%(uploader)s - %(title)s.%(ext)s",
            url,
        ]

    try:
        proc_kwargs = {"stdout": asyncio.subprocess.PIPE, "stderr": asyncio.subprocess.STDOUT}
        if work_dir:
            proc_kwargs["cwd"] = work_dir
        proc = await asyncio.create_subprocess_exec(*cmd, **proc_kwargs)

        lines: list = []
        error_hints: list = []  # alle regels met fout-keywords, onbeperkt
        flush_count = 0
        output_path = None
        _ERR_KW = ("error", "fail", "fatal", "exception", "unauthorized", "invalid", "denied")

        async for raw in proc.stdout:
            line = raw.decode(errors="replace").rstrip()
            if not line:
                continue

            m = re.search(r"Destination: (.+\.(?:flac|mp3|m4a|ogg|opus|wav))", line, re.IGNORECASE)
            if m:
                output_path = os.path.basename(m.group(1).strip())

            if any(kw in line.lower() for kw in _ERR_KW):
                error_hints.append(line)

            is_percent = bool(_PERCENT_RE.match(line))
            if is_percent and lines and _PERCENT_RE.match(lines[-1]):
                lines[-1] = line
            else:
                lines.append(line)
                if len(lines) > 60:
                    lines.pop(0)
                flush_count += 1
                if flush_count >= 5:
                    _update_job(job_id, progress_log="\n".join(lines), last_progress_at=datetime.utcnow())
                    flush_count = 0

        await proc.wait()
        _update_job(job_id, progress_log="\n".join(lines))

        if work_dir:
            creds_new = os.path.join(work_dir, "beatportdl-credentials.json")
            if os.path.exists(creds_new):
                shutil.copy2(creds_new, os.path.join(settings.BEATPORTDL_CONFIG_DIR, "beatportdl-credentials.json"))

        if proc.returncode == 0:
            _update_job(job_id, status="done", output_path=output_path)
            logger.info("Download klaar: %s → %s", job_id, output_path)
        else:
            if error_hints:
                error = "\n".join(error_hints[-10:])
            else:
                error = "\n".join(lines[-10:])
            error = f"[exit {proc.returncode}]\n{error}".strip()
            _update_job(job_id, status="error", error=error[:1500])
            logger.error("Download mislukt [%s] exit=%d: %s", job_id, proc.returncode, error[:300])

    except FileNotFoundError as e:
        tool = e.filename or cmd[0]
        _update_job(job_id, status="error",
                    error=f"'{tool}' niet gevonden. Zorg dat het geïnstalleerd is in de Docker-container.")
    except Exception as e:
        _update_job(job_id, status="error", error=str(e)[:500])
    finally:
        if work_dir:
            shutil.rmtree(work_dir, ignore_errors=True)


# ── Schemas ───────────────────────────────────────────────────────────────────

class SectionCreate(BaseModel):
    name: str

class SectionUpdate(BaseModel):
    name: str

class RackCreate(BaseModel):
    name: str
    section_id: Optional[str] = None

class RackUpdate(BaseModel):
    name: Optional[str] = None
    section_id: Optional[str] = None

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
    status: str
    progress_log: Optional[str]
    last_progress_at: Optional[datetime]
    error: Optional[str]
    output_path: Optional[str]
    job_id: Optional[str]

class RackOut(BaseModel):
    id: str
    name: str
    section_id: Optional[str]
    created_at: datetime
    crades: List[CradeOut] = []

class SectionOut(BaseModel):
    id: str
    name: str
    created_at: datetime
    racks: List[RackOut] = []

class TreeOut(BaseModel):
    sections: List[SectionOut]
    racks: List[RackOut]
    crades: List[CradeOut]


# ── Sections ──────────────────────────────────────────────────────────────────

@router.post("/sections")
def create_section(
    body: SectionCreate,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    s = DownloadSection(name=body.name.strip(), created_by=user.id)
    session.add(s)
    session.commit()
    session.refresh(s)
    return {"id": s.id, "name": s.name, "created_at": s.created_at, "racks": []}


@router.patch("/sections/{section_id}")
def update_section(
    section_id: str,
    body: SectionUpdate,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    s = session.get(DownloadSection, section_id)
    if not s:
        raise AppError("Section niet gevonden", 404)
    s.name = body.name.strip()
    s.updated_at = datetime.utcnow()
    session.add(s)
    session.commit()
    return {"ok": True}


@router.delete("/sections/{section_id}")
def delete_section(
    section_id: str,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    s = session.get(DownloadSection, section_id)
    if not s:
        raise AppError("Section niet gevonden", 404)
    for r in session.exec(select(DownloadCradeGroup).where(DownloadCradeGroup.section_id == section_id)).all():
        r.section_id = None
        r.updated_at = datetime.utcnow()
        session.add(r)
    session.delete(s)
    session.commit()
    return {"ok": True}


# ── Racks ─────────────────────────────────────────────────────────────────────

@router.post("/racks")
def create_rack(
    body: RackCreate,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    r = DownloadCradeGroup(name=body.name.strip(), section_id=body.section_id or None, created_by=user.id)
    session.add(r)
    session.commit()
    session.refresh(r)
    return {"id": r.id, "name": r.name, "section_id": r.section_id, "created_at": r.created_at, "crades": []}


@router.patch("/racks/{rack_id}")
def update_rack(
    rack_id: str,
    body: RackUpdate,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    r = session.get(DownloadCradeGroup, rack_id)
    if not r:
        raise AppError("Rack niet gevonden", 404)
    if body.name is not None:
        r.name = body.name.strip()
    if "section_id" in body.model_fields_set:
        r.section_id = body.section_id or None
    r.updated_at = datetime.utcnow()
    session.add(r)
    session.commit()
    return {"ok": True}


@router.delete("/racks/{rack_id}")
def delete_rack(
    rack_id: str,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    r = session.get(DownloadCradeGroup, rack_id)
    if not r:
        raise AppError("Rack niet gevonden", 404)
    for c in session.exec(select(DownloadCrade).where(DownloadCrade.group_id == rack_id)).all():
        c.group_id = None
        c.updated_at = datetime.utcnow()
        session.add(c)
    session.delete(r)
    session.commit()
    return {"ok": True}


# ── Crades ────────────────────────────────────────────────────────────────────

def _today_name() -> str:
    d = datetime.utcnow()
    return f"{d.day:02d}-{d.month:02d}-{d.year}"


def _crade_out(c: DownloadCrade, job: Optional[DownloadJob]) -> CradeOut:
    return CradeOut(
        id=c.id, name=c.name, subdir=c.subdir,
        group_id=c.group_id, source_url=c.source_url,
        format=c.format, created_at=c.created_at,
        status=job.status if job else "no_job",
        progress_log=job.progress_log if job else None,
        last_progress_at=job.last_progress_at if job else None,
        error=job.error if job else None,
        output_path=job.output_path if job else None,
        job_id=job.id if job else None,
    )


@router.post("/crades", response_model=CradeOut)
async def create_crade(
    body: CradeCreate,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    url = body.source_url.strip()
    if not url:
        raise AppError("URL mag niet leeg zijn", 400)

    name = body.name.strip() or _today_name()
    subdir = _safe_name(name)
    existing = {c.subdir for c in session.exec(select(DownloadCrade)).all()}
    base = subdir
    counter = 1
    while subdir in existing:
        subdir = f"{base}_{counter}"
        counter += 1

    crade = DownloadCrade(
        name=name, subdir=subdir,
        group_id=body.group_id or None,
        source_url=url, format=body.format,
        created_by=user.id,
    )
    session.add(crade)
    session.commit()
    session.refresh(crade)

    job = DownloadJob(
        url=url, source=_detect_source(url),
        format=body.format, crade_id=crade.id,
        created_by=user.id,
    )
    session.add(job)
    session.commit()
    session.refresh(job)

    background_tasks.add_task(_run_download, job.id)
    return _crade_out(crade, job)


@router.patch("/crades/{crade_id}")
def update_crade(
    crade_id: str,
    body: CradeUpdate,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    c = session.get(DownloadCrade, crade_id)
    if not c:
        raise AppError("Crade niet gevonden", 404)
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
        raise AppError("Crade niet gevonden", 404)
    for job in session.exec(select(DownloadJob).where(DownloadJob.crade_id == crade_id)).all():
        session.delete(job)
    session.delete(c)
    session.commit()
    return {"ok": True}


@router.post("/crades/{crade_id}/restart", response_model=CradeOut)
async def restart_crade(
    crade_id: str,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    c = session.get(DownloadCrade, crade_id)
    if not c:
        raise AppError("Crade niet gevonden", 404)

    job = session.exec(
        select(DownloadJob)
        .where(DownloadJob.crade_id == crade_id)
        .order_by(DownloadJob.created_at.desc())
        .limit(1)
    ).first()

    if not job:
        raise AppError("Geen job gevonden voor deze crade", 404)
    if job.status == "downloading":
        raise AppError("Download is al actief", 409)

    job.status = "queued"
    job.error = None
    job.progress_log = None
    job.last_progress_at = None
    job.updated_at = datetime.utcnow()
    session.add(job)
    session.commit()
    session.refresh(job)

    background_tasks.add_task(_run_download, job.id)
    logger.info("Crade herstart: %s (job %s)", crade_id, job.id)
    return _crade_out(c, job)


# ── Tree ──────────────────────────────────────────────────────────────────────

@router.get("/tree", response_model=TreeOut)
def get_tree(
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    sections = session.exec(select(DownloadSection).order_by(DownloadSection.created_at)).all()
    racks    = session.exec(select(DownloadCradeGroup).order_by(DownloadCradeGroup.created_at)).all()
    crades   = session.exec(select(DownloadCrade).order_by(DownloadCrade.created_at.desc())).all()

    crade_map = {}
    for c in crades:
        job = session.exec(
            select(DownloadJob)
            .where(DownloadJob.crade_id == c.id)
            .order_by(DownloadJob.created_at.desc())
            .limit(1)
        ).first()
        crade_map[c.id] = _crade_out(c, job)

    rack_map = {}
    for r in racks:
        rack_crades = [crade_map[c.id] for c in crades if c.group_id == r.id]
        rack_map[r.id] = RackOut(
            id=r.id, name=r.name, section_id=r.section_id,
            created_at=r.created_at, crades=rack_crades,
        )

    section_outs = []
    for s in sections:
        section_racks = [rack_map[r.id] for r in racks if r.section_id == s.id]
        section_outs.append(SectionOut(id=s.id, name=s.name, created_at=s.created_at, racks=section_racks))

    free_racks  = [rack_map[r.id] for r in racks if not r.section_id]
    free_crades = [crade_map[c.id] for c in crades if not c.group_id]

    return TreeOut(sections=section_outs, racks=free_racks, crades=free_crades)


# ── Legacy job-list ───────────────────────────────────────────────────────────

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


# ── Stale-job reset ───────────────────────────────────────────────────────────

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
