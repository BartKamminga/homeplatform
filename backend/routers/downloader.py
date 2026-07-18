"""BeatCrades — router en API endpoints.

Architectuur:
  downloader.py          ← dit bestand: router + schemas + endpoints
  downloader_helpers.py  ← gedeelde helpers: naamgeving, subdir, DB-schrijven
  downloader_worker.py   ← achtergrond-worker: semaphore, lees-loop, dispatch
  downloader_beatport.py ← beatportdl: config, voorbereiding, resultaatverwerking
  downloader_ytdlp.py    ← yt-dlp: commando, resultaatverwerking
"""

import asyncio as _asyncio
import logging
import os
import shutil
import subprocess
import urllib.request
import urllib.error
import json as _json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from core.auth import get_current_user
from core.database import get_session
from core.exceptions import AppError
from core.settings import settings
from models.downloader import DownloadCrade, DownloadCradeGroup, DownloadJob, DownloadSection
from routers.downloader_helpers import (
    build_subdir, detect_source, expected_subdir, get_app_setting,
    move_crade_dir, slug_from_beatport_url, today_name,
)
from routers.downloader_worker import active_downloads, run_download

router = APIRouter(prefix="/api/beatcrades", tags=["beatcrades"])


# ── Startup-hulp ──────────────────────────────────────────────────────────────

def reset_stale_jobs() -> list:
    """Herplan jobs die bij een vorige server-run als 'downloading'/'queued' achterbleven."""
    from sqlmodel import Session as _S
    from core.database import engine as _engine
    stale_statuses = ("downloading", "queued")
    job_ids = []
    with _S(_engine) as s:
        jobs = s.exec(
            select(DownloadJob).where(DownloadJob.status.in_(stale_statuses))
        ).all()
        for job in jobs:
            job.status = "queued"
            job.error  = None
            job.updated_at = datetime.utcnow()
            s.add(job)
            job_ids.append(job.id)
        if jobs:
            s.commit()
            logger.info("reset_stale_jobs: %d jobs hergepland", len(jobs))
    return job_ids
logger = logging.getLogger("homeplatform.beatcrades")


# ── Schemas ───────────────────────────────────────────────────────────────────

class SectionCreate(BaseModel):
    name: str

class SectionUpdate(BaseModel):
    name: str

class SectionMerge(BaseModel):
    source_id: str
    target_id: str

class RackMerge(BaseModel):
    source_id: str
    target_id: str

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
    notes: Optional[str] = None

class VangerItem(BaseModel):
    url: str
    name: str = ""
    genre: str = "Overig"
    track_count: Optional[int] = None
    artist: str = ""
    item_type: str = ""
    format: str = "flac"

class VangerPushIn(BaseModel):
    section_name: str
    items: List[VangerItem]

class VangerPushOut(BaseModel):
    section_id: str
    rack_count: int
    crade_count: int

class CradeOut(BaseModel):
    id: str
    name: str
    subdir: str
    group_id: Optional[str]
    source_url: Optional[str]
    format: str
    actual_format: Optional[str]
    notes: Optional[str]
    artist: Optional[str]
    item_type: Optional[str]
    track_count: Optional[int]
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


# ── DB-presentatie ────────────────────────────────────────────────────────────

def _crade_out(c: DownloadCrade, job: Optional[DownloadJob]) -> CradeOut:
    return CradeOut(
        id=c.id, name=c.name, subdir=c.subdir,
        group_id=c.group_id, source_url=c.source_url,
        format=c.format, actual_format=job.actual_format if job else None,
        notes=c.notes,
        artist=c.artist, item_type=c.item_type, track_count=c.track_count,
        created_at=c.created_at,
        status=job.status if job else "no_job",
        progress_log=job.progress_log if job else None,
        last_progress_at=job.last_progress_at if job else None,
        error=job.error if job else None,
        output_path=job.output_path if job else None,
        job_id=job.id if job else None,
    )


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
        racks = session.exec(select(DownloadCradeGroup).where(DownloadCradeGroup.section_id == section_id)).all()
        for rack in racks:
            for crade in session.exec(select(DownloadCrade).where(DownloadCrade.group_id == rack.id)).all():
                move_crade_dir(crade, expected_subdir(crade, session), session)
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


@router.post("/sections/merge")
def merge_sections(
    body: SectionMerge,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    source = session.get(DownloadSection, body.source_id)
    target = session.get(DownloadSection, body.target_id)
    if not source:
        raise AppError("Bronsectie niet gevonden", 404)
    if not target:
        raise AppError("Doelsectie niet gevonden", 404)
    if body.source_id == body.target_id:
        raise AppError("Bron en doel mogen niet dezelfde section zijn", 400)

    source_racks = session.exec(
        select(DownloadCradeGroup).where(DownloadCradeGroup.section_id == body.source_id)
    ).all()
    target_racks = session.exec(
        select(DownloadCradeGroup).where(DownloadCradeGroup.section_id == body.target_id)
    ).all()
    # Index target-racks op genormaliseerde naam voor naam-collision detectie
    target_by_name = {r.name.strip().lower(): r for r in target_racks}

    merged_racks = 0
    moved_racks = 0
    for rack in source_racks:
        existing = target_by_name.get(rack.name.strip().lower())
        if existing:
            # Zelfde naam → crades verplaatsen naar bestaande rack, bron rack verwijderen
            for crade in session.exec(
                select(DownloadCrade).where(DownloadCrade.group_id == rack.id)
            ).all():
                crade.group_id = existing.id
                crade.updated_at = datetime.utcnow()
                session.add(crade)
                move_crade_dir(crade, expected_subdir(crade, session), session)
            session.delete(rack)
            merged_racks += 1
        else:
            rack.section_id = body.target_id
            rack.updated_at = datetime.utcnow()
            session.add(rack)
            for crade in session.exec(
                select(DownloadCrade).where(DownloadCrade.group_id == rack.id)
            ).all():
                move_crade_dir(crade, expected_subdir(crade, session), session)
            moved_racks += 1

    session.delete(source)
    session.commit()
    return {"ok": True, "moved_racks": moved_racks, "merged_racks": merged_racks}


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
        for crade in session.exec(select(DownloadCrade).where(DownloadCrade.group_id == rack_id)).all():
            move_crade_dir(crade, expected_subdir(crade, session), session)
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


@router.post("/racks/merge")
def merge_racks(
    body: RackMerge,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    source = session.get(DownloadCradeGroup, body.source_id)
    target = session.get(DownloadCradeGroup, body.target_id)
    if not source:
        raise AppError("Bronrack niet gevonden", 404)
    if not target:
        raise AppError("Doelrack niet gevonden", 404)
    if body.source_id == body.target_id:
        raise AppError("Bron en doel mogen niet dezelfde rack zijn", 400)

    crades = session.exec(
        select(DownloadCrade).where(DownloadCrade.group_id == body.source_id)
    ).all()
    for crade in crades:
        crade.group_id = body.target_id
        crade.updated_at = datetime.utcnow()
        session.add(crade)
        move_crade_dir(crade, expected_subdir(crade, session), session)

    session.delete(source)
    session.commit()
    return {"ok": True, "moved_crades": len(crades)}


# ── Crades ────────────────────────────────────────────────────────────────────

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

    name    = body.name.strip() or today_name()
    rack    = session.get(DownloadCradeGroup, body.group_id) if body.group_id else None
    section = session.get(DownloadSection, rack.section_id) if rack and rack.section_id else None

    # Zorg voor uniek subdir-pad
    dir_tpl     = get_app_setting("beatcrades.dir_template", "{section}/{rack}/{crade}")
    existing    = {c.subdir for c in session.exec(select(DownloadCrade)).all()}
    base_subdir = build_subdir(name, rack=rack, section=section, dir_template=dir_tpl)
    subdir, counter = base_subdir, 1
    while subdir in existing:
        parts  = base_subdir.rsplit("/", 1)
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

    source = detect_source(url)
    job = DownloadJob(
        url=url, source=source,
        format=body.format, crade_id=crade.id,
        output_path=slug_from_beatport_url(url) if source == "beatport" else None,
        created_by=user.id,
    )
    session.add(job)
    session.commit()
    session.refresh(job)

    background_tasks.add_task(run_download, job.id)
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
    if "notes" in body.model_fields_set:
        c.notes = body.notes
    if renamed_or_moved:
        move_crade_dir(c, expected_subdir(c, session), session)
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
        # Eerste keer starten (from-vanger flow: crade zonder job)
        if not c.source_url:
            raise AppError("Crade heeft geen source URL", 400)
        source = detect_source(c.source_url)
        job = DownloadJob(
            url=c.source_url, source=source,
            format=c.format, crade_id=c.id,
            output_path=slug_from_beatport_url(c.source_url) if source == "beatport" else None,
            created_by=user.id,
        )
        session.add(job)
        session.commit()
        session.refresh(job)
        background_tasks.add_task(run_download, job.id)
        logger.info("Crade gestart (nieuw): %s (job %s)", crade_id, job.id)
        return _crade_out(c, job)

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

    background_tasks.add_task(run_download, job.id)
    logger.info("Crade herstart: %s (job %s)", crade_id, job.id)
    return _crade_out(c, job)


@router.post("/crades/{crade_id}/cancel")
async def cancel_crade(
    crade_id: str,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    c = session.get(DownloadCrade, crade_id)
    if not c:
        raise AppError("Crade niet gevonden", 404)
    job = session.exec(
        select(DownloadJob)
        .where(DownloadJob.crade_id == crade_id)
        .where(DownloadJob.status == "downloading")
    ).first()
    if not job:
        raise AppError("Geen actieve download om te stoppen", 409)
    provider = active_downloads.get(job.id)
    if provider:
        asyncio.create_task(provider.cancel())
    job.status = "error"
    job.error = "Download gestopt door gebruiker. Klik op ↺ om opnieuw te starten."
    job.updated_at = datetime.utcnow()
    session.add(job)
    session.commit()
    session.refresh(job)
    logger.info("Crade gestopt door gebruiker: %s (job %s)", crade_id, job.id)
    return _crade_out(c, job)


# ── Tree ──────────────────────────────────────────────────────────────────────

@router.get("/tree", response_model=TreeOut)
def get_tree(
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    sections = session.exec(select(DownloadSection).order_by(DownloadSection.created_at)).all()
    racks    = session.exec(select(DownloadCradeGroup).order_by(DownloadCradeGroup.name)).all()
    crades   = session.exec(select(DownloadCrade).order_by(DownloadCrade.created_at.desc())).all()

    # Alle jobs in één query — meest recente per crade via dict
    crade_ids = [c.id for c in crades]
    all_jobs  = session.exec(
        select(DownloadJob)
        .where(DownloadJob.crade_id.in_(crade_ids))
        .order_by(DownloadJob.created_at.desc())
    ).all()
    job_map: dict[str, DownloadJob] = {}
    for j in all_jobs:
        if j.crade_id not in job_map:
            job_map[j.crade_id] = j

    crade_map = {c.id: _crade_out(c, job_map.get(c.id)) for c in crades}

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

    return TreeOut(
        sections=section_outs,
        racks=[rack_map[r.id] for r in racks if not r.section_id],
        crades=[crade_map[c.id] for c in crades if not c.group_id],
    )


# ── From Vanger ───────────────────────────────────────────────────────────────

@router.post("/from-vanger", response_model=VangerPushOut)
def push_from_vanger(
    body: VangerPushIn,
    session: Session = Depends(get_session),
    user=Depends(get_current_user),
):
    if not body.items:
        raise AppError("Geen items om te pushen", 400)

    dir_tpl = get_app_setting("beatcrades.dir_template", "{section}/{rack}/{crade}")
    section = DownloadSection(name=body.section_name.strip(), created_by=user.id)
    session.add(section)
    session.flush()

    by_genre: dict = {}
    for item in body.items:
        genre = (item.genre or "Overig").strip() or "Overig"
        by_genre.setdefault(genre, []).append(item)

    existing = {c.subdir for c in session.exec(select(DownloadCrade)).all()}

    crade_count = 0
    for genre, items in by_genre.items():
        rack = DownloadCradeGroup(name=genre, section_id=section.id, created_by=user.id)
        session.add(rack)
        session.flush()

        for item in items:
            name = item.name.strip() or today_name()
            base_subdir = build_subdir(name, rack=rack, section=section, dir_template=dir_tpl)
            subdir, counter = base_subdir, 1
            while subdir in existing:
                parts = base_subdir.rsplit("/", 1)
                subdir = "/".join(parts[:-1] + [f"{parts[-1]}_{counter}"]) if len(parts) > 1 else f"{base_subdir}_{counter}"
                counter += 1
            existing.add(subdir)

            crade = DownloadCrade(
                name=name, subdir=subdir,
                group_id=rack.id,
                source_url=item.url.strip(),
                format=item.format,
                artist=item.artist or None,
                item_type=item.item_type or None,
                track_count=item.track_count or None,
                created_by=user.id,
            )
            session.add(crade)
            crade_count += 1

    session.commit()
    return VangerPushOut(section_id=section.id, rack_count=len(by_genre), crade_count=crade_count)


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
    type: str
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
    known  = {c.subdir.replace("\\", "/").strip("/") for c in crades if c.subdir}
    actions: List[SyncAction] = []

    for crade in crades:
        if not crade.subdir:
            continue
        rel  = crade.subdir.replace("\\", "/").strip("/")
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

        expected_rel = expected_subdir(crade, session)
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
    wanted  = set(body.action_ids)
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
                    select(DownloadJob).where(DownloadJob.crade_id == a.crade_id)
                    .order_by(DownloadJob.created_at.desc()).limit(1)
                ).first()
                if job:
                    job.status = "error"
                    job.error  = "Map verwijderd van disk (gedetecteerd via sync)"
                    job.updated_at = datetime.utcnow()
                    session.add(job)
                results.append({"id": a.id, "ok": True, "message": f"'{a.crade_name}' gemarkeerd als fout"})

            elif a.type == "clear_output":
                job = session.exec(
                    select(DownloadJob).where(DownloadJob.crade_id == a.crade_id)
                    .order_by(DownloadJob.created_at.desc()).limit(1)
                ).first()
                if job:
                    job.output_path = None
                    job.updated_at  = datetime.utcnow()
                    session.add(job)
                results.append({"id": a.id, "ok": True, "message": f"output_path gewist voor '{a.crade_name}'"})

            elif a.type == "add_from_disk":
                new_crade = DownloadCrade(name=a.crade_name, subdir=a.rel_path, created_by=user.id)
                session.add(new_crade)
                results.append({"id": a.id, "ok": True, "message": f"Crade aangemaakt: '{a.crade_name}'"})

            elif a.type == "reorganize_dir":
                crade = session.get(DownloadCrade, a.crade_id)
                if not crade:
                    results.append({"id": a.id, "ok": False, "message": "Crade niet meer gevonden"})
                    continue
                old_rel  = crade.subdir.replace("\\", "/").strip("/")
                new_rel  = expected_subdir(crade, session)
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
                old_parent = os.path.dirname(old_full)
                if old_parent != settings.DOWNLOAD_DIR and os.path.isdir(old_parent):
                    try:
                        os.rmdir(old_parent)
                    except OSError:
                        pass
                crade.subdir = new_rel
                crade.updated_at = datetime.utcnow()
                session.add(crade)
                results.append({"id": a.id, "ok": True, "message": f"'{a.crade_name}' verplaatst → {new_rel}"})

        except Exception as e:
            results.append({"id": a.id, "ok": False, "message": str(e)})

    session.commit()
    return SyncExecuteOut(results=results)


# ── Tool versie-check ─────────────────────────────────────────────────────────

_GH_REPOS = {
    "beatportdl": "unspok3n/beatportdl",
    "ytdlp":      "yt-dlp/yt-dlp",
}


def _local_version(cmd: str) -> str:
    """Roept `<cmd> --version` aan en geeft de eerste regel terug."""
    try:
        result = subprocess.run(
            [cmd, "--version"],
            capture_output=True, text=True, timeout=8,
        )
        line = (result.stdout or result.stderr or "").strip().splitlines()[0]
        return line or "onbekend"
    except FileNotFoundError:
        return "niet gevonden"
    except Exception as exc:
        return f"fout: {exc}"


def _gh_latest(repo: str) -> dict:
    """Haalt de nieuwste GitHub release op voor `repo`."""
    url = f"https://api.github.com/repos/{repo}/releases/latest"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "homeplatform/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = _json.loads(resp.read().decode())
        return {"tag": data.get("tag_name", ""), "url": data.get("html_url", "")}
    except urllib.error.HTTPError as e:
        return {"tag": "", "url": "", "error": f"HTTP {e.code}"}
    except Exception as exc:
        return {"tag": "", "url": "", "error": str(exc)}


@router.get("/tool-versions")
def tool_versions(user=Depends(get_current_user)):
    bdl_local = _local_version("beatportdl")
    ydl_local = _local_version("yt-dlp")
    bdl_gh    = _gh_latest(_GH_REPOS["beatportdl"])
    ydl_gh    = _gh_latest(_GH_REPOS["ytdlp"])

    def _up_to_date(local: str, gh_tag: str) -> bool:
        if not gh_tag or local in ("niet gevonden", "onbekend") or local.startswith("fout"):
            return False
        tag = gh_tag.lstrip("v")
        loc = local.lstrip("v").split()[0]
        return loc == tag

    return {
        "beatportdl": {
            "installed": bdl_local,
            "latest":    bdl_gh.get("tag", ""),
            "up_to_date": _up_to_date(bdl_local, bdl_gh.get("tag", "")),
            "release_url": bdl_gh.get("url", ""),
            "error": bdl_gh.get("error"),
        },
        "ytdlp": {
            "installed":  ydl_local,
            "latest":     ydl_gh.get("tag", ""),
            "up_to_date": _up_to_date(ydl_local, ydl_gh.get("tag", "")),
            "release_url": ydl_gh.get("url", ""),
            "error": ydl_gh.get("error"),
        },
    }
