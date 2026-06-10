import json
from datetime import datetime
from pathlib import Path

from sqlmodel import Session, select

from core.exceptions import AppError
from core.settings import settings
from models.mixmusic import Genre, TrackHeart, TrackMeta

MUSIC_DIR = Path(settings.MUSIC_DIR)
MUSIC_EXTENSIONS = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".wma"}


def scan_tracks(offset: int = 0, limit: int | None = None) -> list[dict]:
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
            except OSError:
                continue
    tracks.sort(key=lambda t: (t["folder"].lower(), t["name"].lower()))
    if limit is not None:
        return tracks[offset:offset + limit]
    return tracks[offset:] if offset else tracks


# ── Genres ──────────────────────────────────────────────────────────────────

def get_genres(session: Session) -> list[Genre]:
    return list(session.exec(select(Genre).order_by(Genre.name)).all())


def add_genre(session: Session, name: str, color: str | None = None) -> Genre:
    if session.exec(select(Genre).where(Genre.name == name)).first():
        raise AppError("Genre bestaat al", status_code=409)
    genre = Genre(name=name, color=color)
    session.add(genre)
    session.commit()
    session.refresh(genre)
    return genre


def delete_genre(session: Session, genre_id: int) -> None:
    genre = session.get(Genre, genre_id)
    if not genre:
        raise AppError("Genre niet gevonden", status_code=404)
    session.delete(genre)
    session.commit()


# ── Track metadata ───────────────────────────────────────────────────────────

def get_all_metas(session: Session) -> dict:
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


def get_track_meta(session: Session, filepath: str) -> TrackMeta | None:
    return session.exec(select(TrackMeta).where(TrackMeta.file_path == filepath)).first()


def upsert_track_meta(session: Session, filepath: str, **updates) -> TrackMeta:
    meta = get_track_meta(session, filepath)
    if not meta:
        meta = TrackMeta(file_path=filepath)
        session.add(meta)

    display_name = updates.get("display_name")
    if display_name is not None:
        meta.display_name = display_name.strip() or None
    rating = updates.get("rating")
    if rating is not None:
        meta.rating = rating if rating > 0 else None
    genres = updates.get("genres")
    if genres is not None:
        meta.genres = json.dumps(genres)
    moments = updates.get("moments")
    if moments is not None:
        meta.moments = json.dumps(moments)
    meta.updated_at = datetime.utcnow()

    session.commit()
    session.refresh(meta)
    return meta


# ── Hearts ───────────────────────────────────────────────────────────────────

def get_hearts(session: Session, filepath: str) -> list[TrackHeart]:
    return list(session.exec(
        select(TrackHeart)
        .where(TrackHeart.file_path == filepath)
        .order_by(TrackHeart.position)
    ).all())


def add_heart(session: Session, filepath: str, position: float) -> TrackHeart:
    heart = TrackHeart(file_path=filepath, position=round(position, 1))
    session.add(heart)
    session.commit()
    session.refresh(heart)
    return heart


def delete_heart(session: Session, heart_id: int) -> None:
    heart = session.get(TrackHeart, heart_id)
    if not heart:
        raise AppError("Hart niet gevonden", status_code=404)
    session.delete(heart)
    session.commit()
