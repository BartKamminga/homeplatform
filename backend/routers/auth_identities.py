"""Gekoppelde logins van de ingelogde gebruiker (lijst/ontkoppelen) en de
publieke sleutels van onze eigen tokens (jwks). Item 1271 - de OIDC-flow
zelf staat in auth_oidc.py."""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from core.auth import get_current_user, public_jwks
from core.database import get_session
from core.logging import log_action
from models.core import User, UserIdentity

identities_router = APIRouter(prefix="/api/auth/identities", tags=["auth"])
wellknown_router = APIRouter(tags=["auth"])

@identities_router.get("")
def list_identities(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    rows = session.exec(select(UserIdentity).where(UserIdentity.user_id == current_user.id)).all()
    return [{"id": r.id, "provider": r.provider, "email": r.email, "linked_at": r.linked_at,
             "last_login_at": r.last_login_at} for r in rows]


@identities_router.delete("/{identity_id}", status_code=204)
def unlink_identity(identity_id: str, current_user: User = Depends(get_current_user),
                    session: Session = Depends(get_session)):
    identity = session.get(UserIdentity, identity_id)
    if not identity or identity.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Linked sign-in not found")
    session.delete(identity)
    session.commit()
    log_action(session, "user.identity_unlink", user_id=current_user.id, payload={"provider": identity.provider})


@wellknown_router.get("/.well-known/jwks.json")
@wellknown_router.get("/api/auth/jwks.json")
def jwks_endpoint():
    """Publieke sleutel(s) waarmee onze eigen tokens (RS256) te controleren zijn."""
    return public_jwks()
