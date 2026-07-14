"""BeatCrades — gedeelde helpers: naamgeving, subdir-beheer, DB-schrijven."""

import logging
import os
import re
import shutil
import unicodedata
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

from sqlmodel import Session

from core.database import engine
from core.settings import settings
from models.downloader import DownloadCrade, DownloadCradeGroup, DownloadJob, DownloadSection

logger = logging.getLogger("homeplatform.beatcrades")


# ── Naam-hulpfuncties ─────────────────────────────────────────────────────────

_BP_TYPES = frozenset([
    "playlist", "playlists", "release", "releases",
    "track", "tracks", "artist", "artists",
    "chart", "charts", "label", "labels", "mix", "mixes",
])


def safe_name(name: str) -> str:
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_str = nfkd.encode("ascii", "ignore").decode()
    ascii_str = re.sub(r"\s+", "-", ascii_str)
    safe = re.sub(r"[^\w\-]", "", ascii_str)
    safe = re.sub(r"-+", "-", safe).strip("-")
    return safe or "crade"


def build_subdir(crade_name: str, rack=None, section=None) -> str:
    """Bouw hiërarchisch subdir-pad op: [section/][rack/]crade."""
    parts = []
    if section:
        parts.append(safe_name(section.name))
    if rack:
        parts.append(safe_name(rack.name))
    parts.append(safe_name(crade_name))
    return "/".join(parts)


def expected_subdir(crade: DownloadCrade, session: Session) -> str:
    """Bereken het verwachte subdir-pad voor een bestaande crade."""
    rack = session.get(DownloadCradeGroup, crade.group_id) if crade.group_id else None
    section = session.get(DownloadSection, rack.section_id) if rack and rack.section_id else None
    return build_subdir(crade.name, rack=rack, section=section)


def move_crade_dir(crade: DownloadCrade, new_rel: str, session: Session) -> None:
    """Verplaats de disk-map van crade naar new_rel en update crade.subdir."""
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


def rename_crade(crade_id: str, new_name: str, *, move_dir: bool) -> None:
    """Hernoem een crade in de DB; verplaats de map alleen als move_dir=True."""
    try:
        with Session(engine) as s:
            c = s.get(DownloadCrade, crade_id)
            if not c or c.name == new_name:
                return
            old_name = c.name
            if move_dir:
                rack = s.get(DownloadCradeGroup, c.group_id) if c.group_id else None
                section = s.get(DownloadSection, rack.section_id) if rack and rack.section_id else None
                move_crade_dir(c, build_subdir(new_name, rack=rack, section=section), s)
            else:
                c.updated_at = datetime.utcnow()
                s.add(c)
            c.name = new_name
            s.commit()
            logger.info("Crade hernoemd van '%s' naar '%s'", old_name, new_name)
    except Exception as exc:
        logger.warning("Kan crade-naam niet bijwerken: %s", exc)


# ── Bron-detectie ─────────────────────────────────────────────────────────────

def detect_source(url: str) -> str:
    u = url.lower()
    if "beatport.com" in u or "beatsource.com" in u:
        return "beatport"
    if "youtu.be" in u or "youtube.com" in u:
        return "youtube"
    if "soundcloud.com" in u:
        return "soundcloud"
    return "auto"


def slug_from_beatport_url(url: str) -> Optional[str]:
    """Haal een leesbare naam op uit de Beatport URL-slug."""
    try:
        parts = [p for p in urlparse(url).path.split("/") if p]
        for i, p in enumerate(parts):
            if p.lower() in _BP_TYPES and i + 1 < len(parts):
                slug = parts[i + 1]
                if not slug.isdigit():
                    return slug.replace("-", " ").title()
    except Exception:
        pass
    return None


def today_name() -> str:
    d = datetime.utcnow()
    return f"{d.day:02d}-{d.month:02d}-{d.year}"


def write_info_file(
    download_dir: str,
    *,
    name: Optional[str] = None,
    url: str = "",
    provider: str = "",
    fmt: str = "",
    track_count: int = 0,
    output_path: Optional[str] = None,
) -> None:
    """Schrijf BeatCrades.info naar de download-map met uitgebreide metadata."""
    try:
        audio_exts = {".flac", ".mp3", ".wav", ".aiff", ".m4a", ".ogg", ".aac"}
        files: list[str] = []
        for root, _, fnames in os.walk(download_dir):
            for fn in sorted(fnames):
                if os.path.splitext(fn)[1].lower() in audio_exts:
                    rel = os.path.relpath(os.path.join(root, fn), download_dir)
                    files.append(rel.replace("\\", "/"))
        files.sort()

        lines = [
            f"name:       {name or 'onbekend'}",
            f"url:        {url}",
            f"provider:   {provider}",
            f"format:     {fmt}",
            f"downloaded: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC",
        ]
        if track_count:
            lines.append(f"tracks:     {track_count}")
        if output_path:
            lines.append(f"output:     {output_path}")
        if files:
            lines.append(f"files ({len(files)}):")
            for f in files:
                lines.append(f"  {f}")

        with open(os.path.join(download_dir, "BeatCrades.info"), "w", encoding="utf-8") as fh:
            fh.write("\n".join(lines) + "\n")
    except Exception as exc:
        logger.warning("Kan BeatCrades.info niet schrijven: %s", exc)


# ── DB-schrijven ──────────────────────────────────────────────────────────────

def update_job(job_id: str, **kwargs) -> None:
    """Schrijf job-velden naar de DB in een eigen sessie."""
    with Session(engine) as s:
        job = s.get(DownloadJob, job_id)
        if not job:
            return
        for k, v in kwargs.items():
            setattr(job, k, v)
        job.updated_at = datetime.utcnow()
        s.add(job)
        s.commit()
