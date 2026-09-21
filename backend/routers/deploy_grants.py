"""Registratie van externe deploy-toegang (item 1173) - SSH-sleutels van
niet-homeplatform-repo's die iets op de G4 mogen deployen, met hun
sudo-allowlist/forced-command-restrictie. Puur naslag voor beheerders; de
daadwerkelijke restrictie leeft in authorized_keys/sudoers op de server,
dit is geen enforcement-laag."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from core.crud import get_or_404
from core.database import get_session
from core.auth import require_admin
from core.logging import log_action
from models.core import ExternalDeployGrant, User

router = APIRouter(prefix="/api/admin/deploy-grants", tags=["admin - deploy-grants"])


class DeployGrantIn(BaseModel):
    name: str
    repo_url: Optional[str] = None
    host: str = "192.168.30.232"
    deploy_user: str
    forced_command: Optional[str] = None
    sudo_rule: Optional[str] = None
    ports: Optional[str] = None
    notes: Optional[str] = None


class DeployGrantUpdate(BaseModel):
    name: Optional[str] = None
    repo_url: Optional[str] = None
    host: Optional[str] = None
    deploy_user: Optional[str] = None
    forced_command: Optional[str] = None
    sudo_rule: Optional[str] = None
    ports: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


@router.get("/")
def list_deploy_grants(session: Session = Depends(get_session), _: User = Depends(require_admin)):
    return session.exec(select(ExternalDeployGrant).order_by(ExternalDeployGrant.created_at)).all()


@router.post("/", status_code=201)
def create_deploy_grant(
    body: DeployGrantIn,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    grant = ExternalDeployGrant(**body.model_dump())
    session.add(grant)
    session.commit()
    session.refresh(grant)
    log_action(session, "deploy_grant.create", user_id=admin.id, payload={"name": grant.name})
    return grant


@router.patch("/{grant_id}")
def update_deploy_grant(
    grant_id: str,
    body: DeployGrantUpdate,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    grant = get_or_404(session, ExternalDeployGrant, grant_id, "Deploy-toegang")
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(grant, key, value)
    grant.updated_at = datetime.utcnow()
    session.add(grant)
    session.commit()
    session.refresh(grant)
    log_action(session, "deploy_grant.update", user_id=admin.id, payload={"name": grant.name, "status": grant.status})
    return grant


@router.delete("/{grant_id}")
def delete_deploy_grant(
    grant_id: str,
    session: Session = Depends(get_session),
    admin: User = Depends(require_admin),
):
    grant = get_or_404(session, ExternalDeployGrant, grant_id, "Deploy-toegang")
    session.delete(grant)
    session.commit()
    log_action(session, "deploy_grant.delete", user_id=admin.id, payload={"name": grant.name})
    return {"ok": True}
