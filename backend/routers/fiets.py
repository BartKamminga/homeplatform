"""FietsPrognose router — wanneer kan ik het beste fietsen?"""

from fastapi import APIRouter, Depends

from core.auth import get_current_user
from models.core import User

router = APIRouter(prefix="/api/fiets", tags=["fiets"])


@router.get("/prognose")
def get_prognose(_: User = Depends(get_current_user)):
    # Placeholder — integratie met weer-API (en evt. Claude) volgt later
    return {
        "status": "placeholder",
        "message": "Weer-API integratie volgt",
        "days": [],
    }
