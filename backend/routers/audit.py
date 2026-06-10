from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from core.database import get_session
from core.auth import require_admin
from models.core import User, AuditLog

router = APIRouter(prefix="/api/admin/audit-log", tags=["admin - audit log"])


class AuditLogOut(BaseModel):
    id: str
    user_id: Optional[str]
    site: Optional[str]
    action: str
    payload: Optional[dict]
    created_at: datetime


class AuditLogPage(BaseModel):
    items: list[AuditLogOut]
    total: int
    offset: int
    limit: int


@router.get("/", response_model=AuditLogPage)
def list_audit_log(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    site: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    base = select(AuditLog)
    if site:
        base = base.where(AuditLog.site == site)
    if action:
        base = base.where(AuditLog.action.contains(action))

    total = session.exec(select(func.count()).select_from(base.subquery())).one()
    items = session.exec(
        base.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)
    ).all()

    return AuditLogPage(
        items=[AuditLogOut.model_validate(i, from_attributes=True) for i in items],
        total=total,
        offset=offset,
        limit=limit,
    )
