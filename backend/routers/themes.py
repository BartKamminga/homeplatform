from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy import update as sa_update
from pydantic import BaseModel
from typing import Optional

from core.database import get_session, persist
from core.auth import require_admin
from core.logging import log_action
from models.core import User, Theme

router = APIRouter(prefix="/api/admin/themes", tags=["admin - themes"])


class ThemeOut(BaseModel):
    id: str
    name: str
    tokens: Optional[dict]
    is_default: bool


class ThemeCreate(BaseModel):
    name: str
    tokens: Optional[dict] = None


class ThemeUpdate(BaseModel):
    name: Optional[str] = None
    tokens: Optional[dict] = None


@router.get("/", response_model=list[ThemeOut])
def list_themes(
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    return session.exec(select(Theme)).all()


@router.get("/active")
def get_active_theme(session: Session = Depends(get_session)):
    """Publiek endpoint — frontend gebruikt dit om thema te laden."""
    theme = session.exec(select(Theme).where(Theme.is_default == True)).first()
    if not theme:
        return {"tokens": {}}
    return {"id": theme.id, "name": theme.name, "tokens": theme.tokens or {}}


@router.post("/", response_model=ThemeOut, status_code=201)
def create_theme(
    data: ThemeCreate,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    theme = Theme(name=data.name, tokens=data.tokens)
    session.add(theme)
    session.commit()
    session.refresh(theme)
    log_action(session, "theme.create", user_id=admin.id,
               payload={"theme": data.name})
    return theme


@router.patch("/{theme_id}", response_model=ThemeOut)
def update_theme(
    theme_id: str,
    data: ThemeUpdate,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    theme = session.get(Theme, theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Thema niet gevonden")
    if data.name is not None:
        theme.name = data.name
    if data.tokens is not None:
        theme.tokens = data.tokens
    session.add(theme)
    session.commit()
    session.refresh(theme)
    log_action(session, "theme.update", user_id=admin.id,
               payload={"theme": theme.name})
    return theme


@router.post("/{theme_id}/activate")
def activate_theme(
    theme_id: str,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    theme = session.get(Theme, theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Thema niet gevonden")

    session.execute(sa_update(Theme).values(is_default=False))
    theme.is_default = True
    session.add(theme)
    session.commit()
    log_action(session, "theme.activate", user_id=admin.id,
               payload={"theme": theme.name})
    return {"message": f"Thema '{theme.name}' is nu actief"}
