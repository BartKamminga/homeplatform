"""Gedeelde AppSetting-helper voor de vanger (refactor-plan hockey-inside
Fase 2d, RFTR-B2) - was letterlijk dubbel in routers/hockey_vanger.py en
services/hockey_vanger_scanplan.py."""

from sqlmodel import Session

from models.settings import AppSetting

DISC_TARGET_SEASON = "disc_target_season"


def _get_int_setting(session: Session, key: str, default: int) -> int:
    row = session.get(AppSetting, key)
    if row and row.value and row.value.lstrip("-").isdigit():
        return int(row.value)
    return default


def get_target_season(session: Session) -> str:
    """item 842: was routers/hockey_capture.py's _get_target_season - een
    'private' router-helper die door 3 andere routers en 3 services werd
    geimporteerd (verkeerde afhankelijkheidsrichting voor de services)."""
    row = session.get(AppSetting, DISC_TARGET_SEASON)
    return row.value if row and row.value else "2026-2027"
