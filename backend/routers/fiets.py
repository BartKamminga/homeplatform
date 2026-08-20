"""FietsPrognose router — wanneer kan ik het beste fietsen?"""

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from core.auth import get_current_user
from core.database import get_session
from core.settings import settings
from models.core import User, UserPreference
from services import fiets as svc

router = APIRouter(prefix="/api/fiets", tags=["fiets"])


@router.get("/prognose")
async def get_prognose(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    pref_row = session.exec(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    ).first()
    pref_deg = (pref_row.extra or {}).get("fiets_wind_pref_deg") if pref_row else None

    return await svc.build_prognose(
        settings.FIETS_LAT, settings.FIETS_LON, pref_deg, settings.FIETS_LOCATION_LABEL
    )
