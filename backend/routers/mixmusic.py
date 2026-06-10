"""Mix Music router — thin HTTP layer; business logic lives in services/mixmusic.py."""

import urllib.parse
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session

from core.database import get_session
from core.auth import get_current_user
from core.exceptions import AppError
from core.logging import log_action
from models.core import User
import services.mixmusic as svc

router = APIRouter(prefix="/api/mixmusic", tags=["mixmusic"])

MUSIC_DIR = svc.MUSIC_DIR
MUSIC_EXTENSIONS = svc.MUSIC_EXTENSIONS

MIME_TYPES = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".opus": "audio/ogg",
    ".wma": "audio/x-ms-wma",
}


# ── Schemas ──────────────────────────────────────────────────────────────────

class Track(BaseModel):
    name: str
    file: str
    ext: str
    folder: str
    size: int


class GenreCreate(BaseModel):
    name: str
    color: Optional[str] = None


class HeartIn(BaseModel):
    position: float


class TrackMetaIn(BaseModel):
    display_name: Optional[str] = None
    rating: Optional[int] = None
    genres: Optional[list[str]] = None
    moments: Optional[list[str]] = None


class TrackMetaOut(BaseModel):
    file_path: str
    display_name: Optional[str] = None
    rating: Optional[int] = None
    genres: list[str] = []
    moments: list[str] = []


def _meta_to_out(meta) -> TrackMetaOut:
    return TrackMetaOut(
        file_path=meta.file_path,
        display_name=meta.display_name,
        rating=meta.rating,
        genres=meta.genres or [],
        moments=meta.moments or [],
    )


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "ok", "music_dir": str(MUSIC_DIR), "exists": MUSIC_DIR.exists()}


@router.get("/tracks", response_model=list[Track])
def get_tracks(
    offset: int = Query(default=0, ge=0),
    limit: Optional[int] = Query(default=None, ge=1),
    _: User = Depends(get_current_user),
):
    return svc.scan_tracks(offset=offset, limit=limit)


@router.get("/stream/{filepath:path}")
async def stream_music(filepath: str, request: Request):
    filepath = urllib.parse.unquote(filepath)
    music_path = MUSIC_DIR / filepath

    try:
        music_path.resolve().relative_to(MUSIC_DIR.resolve())
    except ValueError:
        raise AppError("Toegang geweigerd", status_code=403)

    if not music_path.exists():
        raise AppError("Bestand niet gevonden", status_code=404)

    if music_path.suffix.lower() not in MUSIC_EXTENSIONS:
        raise AppError("Bestandstype niet ondersteund", status_code=400)

    mime = MIME_TYPES.get(music_path.suffix.lower(), "audio/mpeg")
    file_size = music_path.stat().st_size
    range_header = request.headers.get("Range")

    if range_header:
        byte_start, byte_end = 0, file_size - 1
        try:
            range_val = range_header.replace("bytes=", "")
            parts = range_val.split("-")
            if parts[0]:
                byte_start = int(parts[0])
            if parts[1]:
                byte_end = int(parts[1])
        except Exception:
            pass

        length = byte_end - byte_start + 1

        def generate():
            with open(music_path, "rb") as f:
                f.seek(byte_start)
                remaining = length
                chunk = 65536
                while remaining > 0:
                    data = f.read(min(chunk, remaining))
                    if not data:
                        break
                    yield data
                    remaining -= len(data)

        return StreamingResponse(
            generate(),
            status_code=206,
            media_type=mime,
            headers={
                "Content-Range": f"bytes {byte_start}-{byte_end}/{file_size}",
                "Content-Length": str(length),
                "Accept-Ranges": "bytes",
            },
        )

    return FileResponse(
        path=music_path,
        media_type=mime,
        headers={"Accept-Ranges": "bytes", "Content-Length": str(file_size)},
    )


# ── Genres ───────────────────────────────────────────────────────────────────

@router.get("/genres")
def get_genres(session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return svc.get_genres(session)


@router.post("/genres", status_code=201)
def add_genre(body: GenreCreate, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return svc.add_genre(session, body.name.strip(), body.color)


@router.delete("/genres/{genre_id}", status_code=204)
def delete_genre(genre_id: int, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    svc.delete_genre(session, genre_id)


# ── Track metadata ───────────────────────────────────────────────────────────

@router.get("/metas")
def get_all_metas(session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return svc.get_all_metas(session)


@router.get("/meta/{filepath:path}", response_model=TrackMetaOut)
def get_track_meta(filepath: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    filepath = urllib.parse.unquote(filepath)
    meta = svc.get_track_meta(session, filepath)
    if not meta:
        return TrackMetaOut(file_path=filepath)
    return _meta_to_out(meta)


@router.patch("/meta/{filepath:path}", response_model=TrackMetaOut)
def update_track_meta(
    filepath: str,
    body: TrackMetaIn,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
):
    filepath = urllib.parse.unquote(filepath)
    meta = svc.upsert_track_meta(session, filepath, **body.model_dump(exclude_unset=True))
    return _meta_to_out(meta)


# ── Hearts ───────────────────────────────────────────────────────────────────

@router.get("/hearts/{filepath:path}")
def get_hearts(filepath: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return svc.get_hearts(session, urllib.parse.unquote(filepath))


@router.post("/hearts/{filepath:path}", status_code=201)
def add_heart(filepath: str, body: HeartIn, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    fp = urllib.parse.unquote(filepath)
    heart = svc.add_heart(session, fp, body.position)
    log_action(session, "heart.add", site="mixmusic", user_id=user.id, payload={"file": fp, "position": body.position})
    return heart


@router.delete("/hearts/{heart_id}", status_code=204)
def delete_heart(heart_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    svc.delete_heart(session, heart_id)
    log_action(session, "heart.delete", site="mixmusic", user_id=user.id, payload={"heart_id": heart_id})
