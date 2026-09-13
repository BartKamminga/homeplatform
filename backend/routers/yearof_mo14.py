"""YearOf MO14 ("MO14 à Paris") — supportersite voor Victoria MO14-1.

Fase 1 (roadmap item 1143): alleen het fundament — een publiek status-endpoint
en een beheerder-only me-endpoint om de login-flow end-to-end te bewijzen.
Publieke content/tokens komen in latere fases (zie roadmap item 1142/1144+).
"""

from fastapi import APIRouter, Depends

from core.auth import get_current_user
from models.core import User

router = APIRouter(prefix="/api/yearof-mo14", tags=["yearof-mo14"])


@router.get("/status")
def status():
    """Publiek, geen auth — bewijst dat de site/router leeft."""
    return {"site": "yearof-mo14", "fase": 1, "status": "fundament"}


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    """Beheerder-only — bewijst dat de bestaande homeplatform-login werkt voor deze site."""
    return {"username": current_user.username, "email": current_user.email}
