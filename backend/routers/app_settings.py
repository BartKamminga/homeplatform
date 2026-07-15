"""HomePlatform — generieke app-instellingen (key/value per namespace)."""

from datetime import datetime
from typing import Dict

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from core.auth import get_current_user
from core.database import get_session
from models.settings import AppSetting

router = APIRouter(tags=["settings"])

_ALLOWED_KEYS = {
    "beatcrades": {"filename_template", "dir_template"},
}


def _allowed(ns: str, suffix: str) -> bool:
    return suffix in _ALLOWED_KEYS.get(ns, set())


def get_setting(key: str, default: str = "", session: Session = None) -> str:
    """Lees een instelling op uit de DB; geeft default terug als de key ontbreekt."""
    if session:
        row = session.get(AppSetting, key)
        return row.value if row else default
    from core.database import engine
    with Session(engine) as s:
        row = s.get(AppSetting, key)
        return row.value if row else default


@router.get("/api/beatcrades/settings")
def get_beatcrades_settings(
    _user=Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Dict[str, str]:
    rows = session.exec(
        select(AppSetting).where(AppSetting.key.startswith("beatcrades."))
    ).all()
    return {r.key.removeprefix("beatcrades."): r.value for r in rows}


@router.put("/api/beatcrades/settings")
def put_beatcrades_settings(
    body: Dict[str, str],
    _user=Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Dict[str, str]:
    for suffix, value in body.items():
        if not _allowed("beatcrades", suffix):
            continue
        key = f"beatcrades.{suffix}"
        existing = session.get(AppSetting, key)
        if existing:
            existing.value = value
            existing.updated_at = datetime.utcnow()
            session.add(existing)
        else:
            session.add(AppSetting(key=key, value=value))
    session.commit()
    return {r.removeprefix("beatcrades."): v for r, v in body.items() if _allowed("beatcrades", r)}
