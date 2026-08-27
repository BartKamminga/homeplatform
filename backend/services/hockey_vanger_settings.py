"""Gedeelde AppSetting-helper voor de vanger (refactor-plan hockey-inside
Fase 2d, RFTR-B2) - was letterlijk dubbel in routers/hockey_vanger.py en
services/hockey_vanger_scanplan.py."""

from sqlmodel import Session

from models.settings import AppSetting


def _get_int_setting(session: Session, key: str, default: int) -> int:
    row = session.get(AppSetting, key)
    if row and row.value and row.value.lstrip("-").isdigit():
        return int(row.value)
    return default
