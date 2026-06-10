"""
Mix Music router
Serveert muziekbestanden en beheert track-metadata (genre, rating, moment).
"""

import json
import os
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import Optional  # noqa: F401 — gebruikt in Pydantic schemas

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from core.database import get_session
from core.auth import get_current_user
from models.core import User
from models.mixmusic import Genre, TrackHeart, TrackMeta

router = APIRouter(prefix="/api/mixmusic", tags=["mixmusic"])

MUSIC_DIR = Path(os.environ.get("MUSIC_DIR", "/app/music"))
MUSIC_EXTENSIONS = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".wma"}

MIME_TYPES = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".opus": "audio/opus",
    ".wma": "audio/x-ms-wma",
}


# ── Pydantic schemas ────────────────────────────────────────────────────────

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


# ── Helpers ─────────────────────────────────────────────────────────────────

def scan_tracks() -> list[dict]:
    tracks = []
    if not MUSIC_DIR.exists():
        return tracks
    for ext in MUSIC_EXTENSIONS:
        for f in sorted(MUSIC_DIR.rglob(f"*{ext}")):
            try:
                rel = f.relative_to(MUSIC_DIR)
                parts = rel.parts
                tracks.append({
                    "name": f.stem,
                    "file": str(rel).replace("\\", "/"),
                    "ext": ext[1:].upper(),
                    "folder": str(parts[0]) if len(parts) > 1 else "",
                    "size": f.stat().st_size,
                })
            except Exception:
                continue
    tracks.sort(key=lambda t: (t["folder"].lower(), t["name"].lower()))
    return tracks


def _meta_to_out(meta: TrackMeta) -> TrackMetaOut:
    return TrackMetaOut(
        file_path=meta.file_path,
        display_name=meta.display_name,
        rating=meta.rating,
        genres=json.loads(meta.genres) if meta.genres else [],
        moments=json.loads(meta.moments) if meta.moments else [],
    )


# ── Bestaande endpoints ──────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {
        "status": "ok",
        "music_dir": str(MUSIC_DIR),
        "exists": MUSIC_DIR.exists(),
    }


@router.get("/tracks", response_model=list[Track])
def get_tracks(_: User = Depends(get_current_user)):
    return scan_tracks()


@router.get("/stream/{filepath:path}")
async def stream_music(filepath: str, request: Request):
    filepath = urllib.parse.unquote(filepath)
    music_path = MUSIC_DIR / filepath

    try:
        music_path.resolve().relative_to(MUSIC_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Toegang geweigerd")

    if not music_path.exists():
        raise HTTPException(status_code=404, detail="Bestand niet gevonden")

    if music_path.suffix.lower() not in MUSIC_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Bestandstype niet ondersteund")

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


# ── Genre endpoints ──────────────────────────────────────────────────────────

@router.get("/genres")
def get_genres(session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    return session.exec(select(Genre).order_by(Genre.name)).all()


@router.post("/genres", status_code=201)
def add_genre(body: GenreCreate, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    existing = session.exec(select(Genre).where(Genre.name == body.name.strip())).first()
    if existing:
        raise HTTPException(status_code=409, detail="Genre bestaat al")
    genre = Genre(name=body.name.strip(), color=body.color)
    session.add(genre)
    session.commit()
    session.refresh(genre)
    return genre


@router.delete("/genres/{genre_id}", status_code=204)
def delete_genre(genre_id: int, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    genre = session.get(Genre, genre_id)
    if not genre:
        raise HTTPException(status_code=404, detail="Genre niet gevonden")
    session.delete(genre)
    session.commit()


# ── Track-metadata endpoints ─────────────────────────────────────────────────

@router.get("/metas")
def get_all_metas(session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    """Alle track-metadata in één keer, als dict filepath→meta."""
    metas = session.exec(select(TrackMeta)).all()
    return {
        m.file_path: {
            "display_name": m.display_name,
            "rating": m.rating,
            "genres": json.loads(m.genres) if m.genres else [],
            "moments": json.loads(m.moments) if m.moments else [],
        }
        for m in metas
    }


@router.get("/meta/{filepath:path}", response_model=TrackMetaOut)
def get_track_meta(filepath: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    filepath = urllib.parse.unquote(filepath)
    meta = session.exec(select(TrackMeta).where(TrackMeta.file_path == filepath)).first()
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
    meta = session.exec(select(TrackMeta).where(TrackMeta.file_path == filepath)).first()
    if not meta:
        meta = TrackMeta(file_path=filepath)
        session.add(meta)

    if body.display_name is not None:
        meta.display_name = body.display_name.strip() or None
    if body.rating is not None:
        meta.rating = body.rating if body.rating > 0 else None
    if body.genres is not None:
        meta.genres = json.dumps(body.genres)
    if body.moments is not None:
        meta.moments = json.dumps(body.moments)
    meta.updated_at = datetime.utcnow()

    session.commit()
    session.refresh(meta)
    return _meta_to_out(meta)


# ── Heart / favoriete momenten endpoints ─────────────────────────────────────

@router.get("/hearts/{filepath:path}")
def get_hearts(filepath: str, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    filepath = urllib.parse.unquote(filepath)
    return session.exec(
        select(TrackHeart)
        .where(TrackHeart.file_path == filepath)
        .order_by(TrackHeart.position)
    ).all()


@router.post("/hearts/{filepath:path}", status_code=201)
def add_heart(filepath: str, body: HeartIn, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    filepath = urllib.parse.unquote(filepath)
    heart = TrackHeart(file_path=filepath, position=round(body.position, 1))
    session.add(heart)
    session.commit()
    session.refresh(heart)
    return heart


@router.delete("/hearts/{heart_id}", status_code=204)
def delete_heart(heart_id: int, session: Session = Depends(get_session), _: User = Depends(get_current_user)):
    heart = session.get(TrackHeart, heart_id)
    if not heart:
        raise HTTPException(status_code=404, detail="Hart niet gevonden")
    session.delete(heart)
    session.commit()
