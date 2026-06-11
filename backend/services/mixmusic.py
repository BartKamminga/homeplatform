from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy import func as sqla_func
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
        for f in MUSIC_DIR.rglob(f"*{ext}"):
            try:
                rel = f.relative_to(MUSIC_DIR)
                parts = rel.parts
                if any(p.lower().startswith("@eadir") for p in parts):
                    continue
                stat = f.stat()
                tracks.append({
                    "name": f.stem,
                    "file": str(rel).replace("\\", "/"),
                    "ext": ext[1:].upper(),
                    "folder": str(parts[0]) if len(parts) > 1 else "",
                    "size": stat.st_size,
                    "_mtime": stat.st_mtime,
                })
            except OSError:
                continue
    tracks.sort(key=lambda t: t["_mtime"], reverse=True)
    for t in tracks:
        del t["_mtime"]
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


# ── Scope helpers ────────────────────────────────────────────────────────────

def _meta_filter(user_id: Optional[str], group_id: Optional[str]):
    if group_id:
        return TrackMeta.group_id == group_id
    return (TrackMeta.user_id == user_id) & TrackMeta.group_id.is_(None)


def _heart_filter(user_id: Optional[str], group_id: Optional[str]):
    if group_id:
        return TrackHeart.group_id == group_id
    return (TrackHeart.user_id == user_id) & TrackHeart.group_id.is_(None)


# ── Track metadata ───────────────────────────────────────────────────────────

def get_all_metas(
    session: Session,
    user_id: Optional[str],
    group_id: Optional[str],
) -> dict:
    metas = session.exec(
        select(TrackMeta).where(_meta_filter(user_id, group_id))
    ).all()
    heart_rows = session.exec(
        select(TrackHeart.file_path, sqla_func.count(TrackHeart.id))
        .where(_heart_filter(user_id, group_id))
        .group_by(TrackHeart.file_path)
    ).all()
    heart_counts = {row[0]: row[1] for row in heart_rows}

    result = {
        m.file_path: {
            "display_name": m.display_name,
            "rating": m.rating,
            "genres": m.genres or [],
            "moments": m.moments or [],
            "heart_count": heart_counts.get(m.file_path, 0),
        }
        for m in metas
    }
    for fp, cnt in heart_counts.items():
        if fp not in result:
            result[fp] = {
                "display_name": None, "rating": None,
                "genres": [], "moments": [], "heart_count": cnt,
            }
    return result


def get_track_meta(
    session: Session,
    filepath: str,
    user_id: Optional[str],
    group_id: Optional[str],
) -> TrackMeta | None:
    return session.exec(
        select(TrackMeta)
        .where(TrackMeta.file_path == filepath)
        .where(_meta_filter(user_id, group_id))
    ).first()


def upsert_track_meta(
    session: Session,
    filepath: str,
    user_id: Optional[str],
    group_id: Optional[str],
    **updates,
) -> TrackMeta:
    meta = get_track_meta(session, filepath, user_id, group_id)
    if not meta:
        meta = TrackMeta(file_path=filepath, user_id=user_id, group_id=group_id)
        session.add(meta)

    if (val := updates.get("display_name")) is not None:
        meta.display_name = val.strip() or None
    if (val := updates.get("rating")) is not None:
        meta.rating = val if val > 0 else None
    if (val := updates.get("genres")) is not None:
        meta.genres = val
    if (val := updates.get("moments")) is not None:
        meta.moments = val
    meta.updated_at = datetime.utcnow()

    session.commit()
    session.refresh(meta)
    return meta


# ── Hearts ───────────────────────────────────────────────────────────────────

def get_hearts(
    session: Session,
    filepath: str,
    user_id: Optional[str],
    group_id: Optional[str],
) -> list[TrackHeart]:
    return list(session.exec(
        select(TrackHeart)
        .where(TrackHeart.file_path == filepath)
        .where(_heart_filter(user_id, group_id))
        .order_by(TrackHeart.position)
    ).all())


def add_heart(
    session: Session,
    filepath: str,
    position: float,
    user_id: Optional[str],
    group_id: Optional[str],
) -> TrackHeart:
    heart = TrackHeart(
        file_path=filepath,
        position=round(position, 1),
        user_id=user_id,
        group_id=group_id,
    )
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
