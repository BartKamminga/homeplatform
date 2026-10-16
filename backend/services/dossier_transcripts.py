"""Gespreksopnames in dossiers (item 1355): audio opslaan, op de achtergrond laten uitschrijven
door de Whisper-dienst op G4 (docker-compose.whisper.yml) en het transcript in het stuk zetten.
De samenvatting met besluiten en acties volgt in stap 2 (agent_worker) of in een dossiersessie."""
import hashlib
import logging
from datetime import datetime
from pathlib import Path

import httpx
from sqlmodel import Session

from core.database import engine
from core.exceptions import AppError
from core.settings import settings
from models.core import User
from models.dossiers import DossierEntry
from services.dossier_files import MAX_SIZE_MB, _safe_path, _write
from services.dossiers import get_dossier, get_entry, touch

log = logging.getLogger(__name__)

AUDIO_EXTENSIONS = {".webm", ".ogg", ".m4a", ".mp3", ".wav", ".mp4"}
TIMEOUT_SEC = 3600  # een gesprek van een uur kan op 3 cores een flink deel daarvan duren


def whisper_enabled() -> bool:
    return bool(settings.WHISPER_TOKEN and settings.WHISPER_URL)


def save_recording(
    session: Session, user: User, dossier_id: str, filename: str, content: bytes,
    content_type: str | None, title: str | None, consent: bool,
) -> DossierEntry:
    if not consent:
        raise AppError("Confirm that everyone in the conversation knows it is being recorded")
    dossier = get_dossier(session, user, dossier_id)
    ext = Path(filename or "").suffix.lower() or ".webm"
    if ext not in AUDIO_EXTENSIONS:
        raise AppError(f"Audio type {ext} is not supported", status_code=415)
    if len(content) > MAX_SIZE_MB * 4 * 1024 * 1024:
        raise AppError(f"Recording is larger than {MAX_SIZE_MB * 4} MB", status_code=413)
    stamp = datetime.now().strftime("%d-%m-%Y %H:%M")
    entry = DossierEntry(
        dossier_id=dossier.id, user_id=user.id, kind="transcript",
        title=(title or "").strip() or f"Conversation {stamp}",
        file_path=_write(user.id, ext, content), original_filename=f"recording{ext}",
        content_type=content_type, size_bytes=len(content), content_hash=hashlib.sha256(content).hexdigest(),
        occurred_at=datetime.utcnow(), processing="queued" if whisper_enabled() else "failed",
        body=None if whisper_enabled() else "Transcription is not configured (WHISPER_TOKEN missing).",
    )
    session.add(entry)
    touch(session, dossier)
    session.refresh(entry)
    return entry


def requeue(session: Session, user: User, entry_id: str) -> DossierEntry:
    entry = get_entry(session, user, entry_id)
    if entry.kind != "transcript" or not entry.file_path:
        raise AppError("Only recordings can be transcribed")
    if not whisper_enabled():
        raise AppError("Transcription is not configured", status_code=503)
    entry.processing = "queued"
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


def _format(result: dict) -> str:
    def ts(sec: float) -> str:
        sec = int(sec or 0)
        return f"{sec // 3600:d}:{sec % 3600 // 60:02d}:{sec % 60:02d}" if sec >= 3600 else f"{sec // 60:02d}:{sec % 60:02d}"
    lines = [f"[{ts(s['start'])}] {s['text']}" for s in result.get("segments", []) if s.get("text")]
    minutes = round((result.get("duration") or 0) / 60)
    return f"Transcript ({minutes} min, Whisper)\n\n" + ("\n".join(lines) or result.get("text") or "(no speech found)")


def transcribe(entry_id: str) -> None:
    """Achtergrondtaak: eigen sessie, want de request-sessie is dan al dicht."""
    with Session(engine) as session:
        entry = session.get(DossierEntry, entry_id)
        if entry is None or entry.processing not in ("queued", "failed"):
            return
        entry.processing = "transcribing"
        session.add(entry)
        session.commit()
        try:
            path = _safe_path(entry.file_path)
            with path.open("rb") as audio:
                resp = httpx.post(
                    f"{settings.WHISPER_URL.rstrip('/')}/transcribe",
                    headers={"X-Whisper-Token": settings.WHISPER_TOKEN},
                    files={"audio": (path.name, audio, entry.content_type or "application/octet-stream")},
                    data={"language": "nl"}, timeout=TIMEOUT_SEC,
                )
            resp.raise_for_status()
            entry.body = _format(resp.json())
            entry.processing = "done"
        except Exception as err:  # netwerk, Whisper-fout of onleesbare audio: zichtbaar maken, opnieuw te proberen
            log.warning("Transcription failed for %s: %s", entry_id, err)
            entry.body = f"Transcription failed: {err}. Try again from the dossier page."
            entry.processing = "failed"
        entry.updated_at = datetime.utcnow()
        session.add(entry)
        session.commit()
