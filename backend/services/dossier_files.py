"""Bestanden in dossiers (item 1355): upload met automatische tekstextractie,
bijlagen van mails als eigen entries, download en opruimen."""
import hashlib
import re
import uuid
from datetime import datetime
from pathlib import Path

from sqlmodel import Session, select

from core.exceptions import AppError
from core.settings import settings
from models.core import User
from models.dossiers import DossierEntry
from services import text_extract
from services.dossiers import get_dossier, get_entry, touch

UPLOAD_ROOT = Path(settings.UPLOAD_ROOT).resolve()
CATEGORY = "dossiers"
MAX_SIZE_MB = 25
ALLOWED_EXTENSIONS = {
    ".msg", ".eml", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".pdf", ".txt", ".csv",
    ".png", ".jpg", ".jpeg", ".json", ".md", ".html",
}
TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".json"}
MAIL_EXTENSIONS = {".msg", ".eml"}


def _safe_path(rel_path: str) -> Path:
    candidate = (UPLOAD_ROOT / rel_path).resolve()
    if not str(candidate).startswith(str(UPLOAD_ROOT)):
        raise AppError("Invalid path", status_code=400)
    return candidate


def _write(user_id: str, ext: str, content: bytes) -> str:
    rel_path = f"{CATEGORY}/{user_id}/{uuid.uuid4()}{ext}"
    abs_path = _safe_path(rel_path)
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_bytes(content)
    return rel_path


def remove_file(entry: DossierEntry) -> None:
    if entry.file_path:
        path = _safe_path(entry.file_path)
        if path.exists():
            path.unlink()


def _clean_name(filename: str) -> str:
    return text_extract.clean_attachment_name(Path(filename or "").name) or "file"


def save_file(
    session: Session, user: User, dossier_id: str, filename: str, content: bytes,
    content_type: str | None, parent_entry_id: str | None = None, kind: str | None = None,
) -> tuple[DossierEntry, bool]:
    """(entry, created). Hetzelfde bestand (hash) in hetzelfde dossier wordt niet
    opnieuw opgeslagen: (bestaande entry, False)."""
    dossier = get_dossier(session, user, dossier_id)
    filename = _clean_name(filename)
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise AppError(f"File type {ext or '(none)'} is not supported", status_code=415)
    if len(content) > MAX_SIZE_MB * 1024 * 1024:
        raise AppError(f"File is larger than {MAX_SIZE_MB} MB", status_code=413)

    content_hash = hashlib.sha256(content).hexdigest()
    existing = session.exec(
        select(DossierEntry).where(DossierEntry.dossier_id == dossier.id, DossierEntry.content_hash == content_hash)
    ).first()
    if existing:
        return existing, False

    if kind is not None and (kind != "page" or ext != ".html"):
        raise AppError("Only .html files can be added as a page")
    body, attachments, subject = _extract(ext, content)

    entry = DossierEntry(
        dossier_id=dossier.id, user_id=user.id,
        kind=kind or ("mail" if ext in MAIL_EXTENSIONS else "document"),
        title=(subject or _html_title(ext, content) or Path(filename).stem).strip() or filename,
        body=body, file_path=_write(user.id, ext, content), original_filename=filename,
        content_type=content_type, size_bytes=len(content), content_hash=content_hash,
        parent_entry_id=parent_entry_id,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)

    for att_name, att_bytes, att_type in attachments:
        try:
            save_file(session, user, dossier.id, att_name, att_bytes, att_type, parent_entry_id=entry.id)
        except AppError:
            continue  # bv. een niet-ondersteund bijlagetype: de mail zelf blijft staan
    touch(session, dossier)
    session.refresh(entry)
    return entry, True


_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)


def _html_title(ext: str, content: bytes) -> str | None:
    if ext != ".html":
        return None
    match = _TITLE_RE.search(content[:20000].decode("utf-8", errors="replace"))
    return match.group(1).strip() if match else None


def _extract(ext: str, content: bytes) -> tuple[str | None, list, str | None]:
    """(doorzoekbare tekst, bijlagen, mail-onderwerp)."""
    if ext in TEXT_EXTENSIONS:
        return content.decode("utf-8", errors="replace"), [], None
    if ext == ".html":
        return text_extract.html_to_text(content.decode("utf-8", errors="replace")), [], None
    body, _preview, attachments, subject = text_extract.auto_extract(ext, content)
    return body, attachments, subject


def replace_file(
    session: Session, user: User, entry_id: str, filename: str, content: bytes, content_type: str | None,
) -> DossierEntry:
    """Vervangt het bestand van een bestaand stuk; tekst opnieuw geëxtraheerd, bijlagen ongemoeid."""
    entry = get_entry(session, user, entry_id)
    ext = Path(_clean_name(filename)).suffix.lower()
    if not entry.file_path or Path(entry.file_path).suffix.lower() != ext:
        raise AppError("Replace a file with a file of the same type")
    if len(content) > MAX_SIZE_MB * 1024 * 1024:
        raise AppError(f"File is larger than {MAX_SIZE_MB} MB", status_code=413)
    remove_file(entry)
    entry.file_path = _write(user.id, ext, content)
    entry.body, _attachments, _subject = _extract(ext, content)
    entry.size_bytes = len(content)
    entry.content_hash = hashlib.sha256(content).hexdigest()
    entry.content_type = content_type or entry.content_type
    entry.updated_at = datetime.utcnow()
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


def file_for_download(session: Session, user: User, entry_id: str) -> tuple[Path, DossierEntry]:
    entry = get_entry(session, user, entry_id)
    if not entry.file_path:
        raise AppError("This entry has no file", status_code=404)
    path = _safe_path(entry.file_path)
    if not path.exists():
        raise AppError("File is missing on disk", status_code=404)
    return path, entry
