"""BeatCrades — download queue: Section → Rack → Crade (beatportdl + yt-dlp)."""

import asyncio
import logging
import os
import re
import shutil
import tempfile
import unicodedata
from urllib.parse import urlparse
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


def _build_subdir(crade_name: str, rack=None, section=None) -> str:
    """Bouw hiërarchisch subdir-pad op basis van DB-positie."""
    parts = []
    if section:
        parts.append(_safe_name(section.name))
    if rack:
        parts.append(_safe_name(rack.name))
    parts.append(_safe_name(crade_name))
    return "/".join(parts)


def _expected_subdir(crade: DownloadCrade, session: Session) -> str:
    """Bereken het verwachte subdir-pad voor een bestaande crade."""
    rack = session.get(DownloadCradeGroup, crade.group_id) if crade.group_id else None
    section = session.get(DownloadSection, rack.section_id) if rack and rack.section_id else None
    return _build_subdir(crade.name, rack=rack, section=section)


def _move_crade_dir(crade: DownloadCrade, new_rel: str, session: Session) -> None:
    """Verplaats de disk-map van crade naar new_rel en update crade.subdir in de sessie."""
    old_rel = (crade.subdir or "").replace("\\", "/").strip("/")
    if not old_rel or old_rel == new_rel:
        crade.subdir = new_rel
        crade.updated_at = datetime.utcnow()
        session.add(crade)
        return
    old_full = os.path.join(settings.DOWNLOAD_DIR, old_rel)
    new_full = os.path.join(settings.DOWNLOAD_DIR, new_rel)
    if os.path.isdir(old_full) and not os.path.exists(new_full):
        try:
            os.makedirs(os.path.dirname(new_full), exist_ok=True)
            shutil.move(old_full, new_full)
            old_parent = os.path.dirname(old_full)
            if old_parent != settings.DOWNLOAD_DIR and os.path.isdir(old_parent):
                try:
                    os.rmdir(old_parent)
                except OSError:
                    pass
        except Exception as exc:
            logger.warning("Kan mapnaam niet bijwerken van %s naar %s: %s", old_rel, new_rel, exc)
    crade.subdir = new_rel
    crade.updated_at = datetime.utcnow()
    session.add(crade)


def _slug_from_beatport_url(url: str) -> Optional[str]:
    """Haal een leesbare naam op uit de Beatport URL-slug."""
    try:
        parts = [p for p in urlparse(url).path.split("/") if p]
        # bijv. ['playlist', 'house-vibes-2024', '12345678']
        if len(parts) >= 2:
            return parts[1].replace("-", " ").title()
    except Exception:
        pass
    return None


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


_NO_OUTPUT_TIMEOUT = 1800  # seconden: kill als er 30 min geen output is


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
    work_dir   = None
    before_dirs: set = set()

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
        # Snapshot bestaande subdirs zodat we na afloop de nieuwe kunnen detecteren
        if os.path.exists(download_dir):
            before_dirs = {e for e in os.listdir(download_dir)
                           if os.path.isdir(os.path.join(download_dir, e))}
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
        proc_kwargs = {
            "stdout": asyncio.subprocess.PIPE,
            "stderr": asyncio.subprocess.STDOUT,
            "stdin": asyncio.subprocess.DEVNULL,  # voorkomt interactieve modus in beatportdl
        }
        if work_dir:
            proc_kwargs["cwd"] = work_dir
        proc = await asyncio.create_subprocess_exec(*cmd, **proc_kwargs)

        lines: list = []
        error_hints: list = []  # alle regels met fout-keywords, onbeperkt
        flush_count = 0
        output_path = None
        _ERR_KW = ("error", "fail", "fatal", "exception", "unauthorized", "invalid", "denied")

        timed_out = False
        while True:
            try:
                raw = await asyncio.wait_for(proc.stdout.readline(), timeout=_NO_OUTPUT_TIMEOUT)
            except asyncio.TimeoutError:
                proc.kill()
                timed_out = True
                break
            if not raw:
                break

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

        if timed_out:
            _update_job(
                job_id, status="error",
                error=f"Download gestopt: geen output in {_NO_OUTPUT_TIMEOUT // 60} minuten. "
                      "Klik op 'Herstarten' om opnieuw te proberen.",
            )
            return

        await proc.wait()
        _update_job(job_id, progress_log="\n".join(lines))

        if work_dir:
            creds_new = os.path.join(work_dir, "beatportdl-credentials.json")
            if os.path.exists(creds_new):
                shutil.copy2(creds_new, os.path.join(settings.BEATPORTDL_CONFIG_DIR, "beatportdl-credentials.json"))

        # beatportdl eindigt altijd met exit 1 door EOF in interactieve modus.
        # Beschouw het als succes als er geen echte fouten zijn (alleen EOF-melding).
        real_errors = [h for h in error_hints if "error reading input string" not in h.lower()]
        succeeded = proc.returncode == 0 or (work_dir and not real_errors)
        if succeeded and work_dir and os.path.exists(download_dir):
            # Detecteer nieuw aangemaakte submap = playlist/release naam
            after_dirs = {e for e in os.listdir(download_dir)
                          if os.path.isdir(os.path.join(download_dir, e))}
            new_dirs = sorted(after_dirs - before_dirs)
            if new_dirs:
                output_path = new_dirs[0]
        if succeeded:
            _update_job(job_id, status="done", output_path=output_path)
            logger.info("Download klaar: %s → %s", job_id, output_path)
        else:
            if real_errors:
                error = "\n".join(real_errors[-10:])
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
    renamed = body.name.strip() != s.name
    s.name = body.name.strip()
    s.updated_at = datetime.utcnow()
    session.add(s)
    if renamed:
        # Herbereken subdir voor alle craDes in racks van deze section
        racks = session.exec(select(DownloadCradeGroup).where(DownloadCradeGroup.section_id == section_id)).all()
        for rack in racks:
            craders = session.exec(select(DownloadCrade).where(DownloadCrade.group_id == rack.id)).all()
            for crade in craders:
                _move_crade_dir(crade, _expected_subdir(crade, session), session)
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
    renamed_or_moved = False
    if body.name is not None and body.name.strip() != r.name:
        r.name = body.name.strip()
        renamed_or_moved = True
    elif body.name is not None:
        r.name = body.name.strip()
    if "section_id" in body.model_fields_set:
        if (body.section_id or None) != r.section_id:
            renamed_or_moved = True
        r.section_id = body.section_id or None
    r.updated_at = datetime.utcnow()
    session.add(r)
    if renamed_or_moved:
        # Herbereken subdir voor alle craDes in dit rack
        craders = session.exec(select(DownloadCrade).where(DownloadCrade.group_id == rack_id)).all()
        for crade in craders:
            _move_crade_dir(crade, _expected_subdir(crade, session), session)
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
    rack    = session.get(DownloadCradeGroup, body.group_id) if body.group_id else None
    section = session.get(DownloadSection, rack.section_id) if rack and rack.section_id else None
    existing = {c.subdir for c in session.exec(select(DownloadCrade)).all()}
    base_subdir = _build_subdir(name, rack=rack, section=section)
    subdir, counter = base_subdir, 1
    while subdir in existing:
        # alleen het laatste deel uniek maken
        parts = base_subdir.rsplit("/", 1)
        subdir = "/".join(parts[:-1] + [f"{parts[-1]}_{counter}"]) if len(parts) > 1 else f"{base_subdir}_{counter}"
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

    source = _detect_source(url)
    job = DownloadJob(
        url=url, source=source,
        format=body.format, crade_id=crade.id,
        output_path=_slug_from_beatport_url(url) if source == "beatport" else None,
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
    renamed_or_moved = False
    if body.name is not None and body.name.strip() != c.name:
        c.name = body.name.strip()
        renamed_or_moved = True
    elif body.name is not None:
        c.name = body.name.strip()
    if "group_id" in body.model_fields_set:
        if (body.group_id or None) != c.group_id:
            renamed_or_moved = True
        c.group_id = body.group_id or None
    if renamed_or_moved:
        _move_crade_dir(c, _expected_subdir(c, session), session)
    else:
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


# ── Disk-sync ─────────────────────────────────────────────────────────────────

class SyncAction(BaseModel):
    id: str
    type: str   # create_dir | clear_output | mark_missing | add_from_disk
    crade_id: Optional[str] = None
    crade_name: str
    description: str
    path: str
    rel_path: str
    selected: bool = True


class SyncPreviewOut(BaseModel):
    actions: List[SyncAction]
    download_root: str


class SyncExecuteIn(BaseModel):
    action_ids: List[str]


class SyncExecuteOut(BaseModel):
    results: List[dict]


def _scan_unknown_dirs(download_root: str, known_normalized: set) -> list:
    results = []

    def _walk(abs_path: str, rel: str, depth: int):
        if depth > 5:
            return
        try:
            entries = [e for e in os.scandir(abs_path) if e.is_dir(follow_symlinks=False)]
        except (PermissionError, FileNotFoundError):
            return
        for entry in entries:
            child_rel = (rel + "/" + entry.name).lstrip("/")
            if child_rel in known_normalized:
                continue
            if any(k.startswith(child_rel + "/") for k in known_normalized):
                _walk(entry.path, child_rel, depth + 1)
                continue
            results.append({"rel_path": child_rel, "abs_path": entry.path, "name": entry.name})

    _walk(download_root, "", 0)
    return results


def _build_sync_actions(session: Session, download_root: str) -> List[SyncAction]:
    crades = session.exec(select(DownloadCrade)).all()
    known = {c.subdir.replace("\\", "/").strip("/") for c in crades if c.subdir}
    actions: List[SyncAction] = []

    for crade in crades:
        if not crade.subdir:
            continue
        rel = crade.subdir.replace("\\", "/").strip("/")
        full = os.path.join(download_root, rel)
        exists = os.path.isdir(full)

        job = session.exec(
            select(DownloadJob)
            .where(DownloadJob.crade_id == crade.id)
            .order_by(DownloadJob.created_at.desc())
            .limit(1)
        ).first()

        if not exists:
            if job and job.status == "done":
                actions.append(SyncAction(
                    id=f"missing_{crade.id}", type="mark_missing",
                    crade_id=crade.id, crade_name=crade.name,
                    description="Download was klaar maar map is verwijderd van disk.",
                    path=full, rel_path=rel, selected=False,
                ))
            else:
                actions.append(SyncAction(
                    id=f"mkdir_{crade.id}", type="create_dir",
                    crade_id=crade.id, crade_name=crade.name,
                    description="Crade staat in DB maar de downloadmap bestaat nog niet op disk.",
                    path=full, rel_path=rel, selected=True,
                ))
        elif job and job.output_path:
            op_full = os.path.join(full, job.output_path)
            if not os.path.isdir(op_full) and not os.path.isfile(op_full):
                actions.append(SyncAction(
                    id=f"clearop_{crade.id}", type="clear_output",
                    crade_id=crade.id, crade_name=crade.name,
                    description=f"output_path '{job.output_path}' bestaat niet meer op disk.",
                    path=op_full, rel_path=f"{rel}/{job.output_path}", selected=True,
                ))

        # Controleer of het pad overeenkomt met de DB-hiërarchie
        expected_rel = _expected_subdir(crade, session)
        if exists and expected_rel != rel:
            expected_full = os.path.join(download_root, expected_rel)
            if not os.path.isdir(expected_full):
                actions.append(SyncAction(
                    id=f"reorg_{crade.id}", type="reorganize_dir",
                    crade_id=crade.id, crade_name=crade.name,
                    description=f"Huidige map: {rel} → verwacht: {expected_rel}",
                    path=expected_full, rel_path=expected_rel, selected=False,
                ))

    if os.path.isdir(download_root):
        for u in _scan_unknown_dirs(download_root, known):
            aid = "disk_" + u["rel_path"].replace("/", "_").replace(" ", "_")
            actions.append(SyncAction(
                id=aid, type="add_from_disk",
                crade_id=None, crade_name=u["name"],
                description="Map gevonden op disk zonder bijbehorende crade in DB.",
                path=u["abs_path"], rel_path=u["rel_path"], selected=False,
            ))

    return actions


@router.get("/sync/preview", response_model=SyncPreviewOut)
def sync_preview(
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    actions = _build_sync_actions(session, settings.DOWNLOAD_DIR)
    return SyncPreviewOut(actions=actions, download_root=settings.DOWNLOAD_DIR)


@router.post("/sync/execute", response_model=SyncExecuteOut)
def sync_execute(
    body: SyncExecuteIn,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    wanted = set(body.action_ids)
    actions = _build_sync_actions(session, settings.DOWNLOAD_DIR)
    results = []

    for a in actions:
        if a.id not in wanted:
            continue
        try:
            if a.type == "create_dir":
                os.makedirs(a.path, exist_ok=True)
                results.append({"id": a.id, "ok": True, "message": f"Map aangemaakt: {a.rel_path}"})

            elif a.type == "mark_missing":
                job = session.exec(
                    select(DownloadJob)
                    .where(DownloadJob.crade_id == a.crade_id)
                    .order_by(DownloadJob.created_at.desc())
                    .limit(1)
                ).first()
                if job:
                    job.status = "error"
                    job.error = "Map verwijderd van disk (gedetecteerd via sync)"
                    job.updated_at = datetime.utcnow()
                    session.add(job)
                results.append({"id": a.id, "ok": True, "message": f"'{a.crade_name}' gemarkeerd als fout"})

            elif a.type == "clear_output":
                job = session.exec(
                    select(DownloadJob)
                    .where(DownloadJob.crade_id == a.crade_id)
                    .order_by(DownloadJob.created_at.desc())
                    .limit(1)
                ).first()
                if job:
                    job.output_path = None
                    job.updated_at = datetime.utcnow()
                    session.add(job)
                results.append({"id": a.id, "ok": True, "message": f"output_path gewist voor '{a.crade_name}'"})

            elif a.type == "add_from_disk":
                new_crade = DownloadCrade(
                    name=a.crade_name,
                    subdir=a.rel_path,
                    created_by=user.id,
                )
                session.add(new_crade)
                results.append({"id": a.id, "ok": True, "message": f"Crade aangemaakt: '{a.crade_name}'"})

            elif a.type == "reorganize_dir":
                crade = session.get(DownloadCrade, a.crade_id)
                if not crade:
                    results.append({"id": a.id, "ok": False, "message": "Crade niet meer gevonden"})
                    continue
                old_rel  = crade.subdir.replace("\\", "/").strip("/")
                new_rel  = _expected_subdir(crade, session)
                old_full = os.path.join(settings.DOWNLOAD_DIR, old_rel)
                new_full = os.path.join(settings.DOWNLOAD_DIR, new_rel)
                if not os.path.isdir(old_full):
                    results.append({"id": a.id, "ok": False, "message": f"Bronmap bestaat niet: {old_rel}"})
                    continue
                if os.path.exists(new_full):
                    results.append({"id": a.id, "ok": False, "message": f"Doelmap bestaat al: {new_rel}"})
                    continue
                os.makedirs(os.path.dirname(new_full), exist_ok=True)
                shutil.move(old_full, new_full)
                # Verwijder lege bovenliggende mappen
                old_parent = os.path.dirname(old_full)
                if old_parent != settings.DOWNLOAD_DIR and os.path.isdir(old_parent):
                    try:
                        os.rmdir(old_parent)
                    except OSError:
                        pass  # niet leeg, laten staan
                crade.subdir = new_rel
                crade.updated_at = datetime.utcnow()
                session.add(crade)
                results.append({"id": a.id, "ok": True, "message": f"'{a.crade_name}' verplaatst → {new_rel}"})

        except Exception as e:
            results.append({"id": a.id, "ok": False, "message": str(e)})

    session.commit()
    return SyncExecuteOut(results=results)


# ── Stale-job reset ───────────────────────────────────────────────────────────

def reset_stale_jobs():
    with Session(engine) as s:
        stale = s.exec(
            select(DownloadJob).where(DownloadJob.status.in_(["downloading", "queued"]))
        ).all()
        for job in stale:
            job.status = "error"
            job.error = "Server herstart tijdens download. Klik op 'Herstarten' om opnieuw te proberen."
            job.updated_at = datetime.utcnow()
            s.add(job)
        if stale:
            s.commit()
            logger.info("%d download-job(s) gereset naar 'error' na herstart", len(stale))
