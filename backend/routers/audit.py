from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
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


@router.get("/", response_model=list[AuditLogOut])
def list_audit_log(
    limit: int = Query(default=50, le=200),
    site: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    query = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    if site:
        query = query.where(AuditLog.site == site)
    if action:
        query = query.where(AuditLog.action.contains(action))

    return session.exec(query).all()
