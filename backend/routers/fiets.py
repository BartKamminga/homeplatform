"""FietsPrognose router — wanneer kan ik het beste fietsen?"""

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from core.auth import get_current_user
from core.database import get_session
from core.settings import settings
from models.core import User, UserPreference
from services import fiets as svc

router = APIRouter(prefix="/api/fiets", tags=["fiets"])

# Extra-keys die 1-op-1 doorschuiven naar het score-model (zie services/fiets.py score_hour)
_PREF_KEYS = {
    "fiets_wind_pref_deg": "wind_pref_deg",
    "fiets_temp_min": "temp_min",
    "fiets_temp_max": "temp_max",
    "fiets_rain_prob_threshold": "rain_prob_threshold",
    "fiets_wind_knee_kmh": "wind_knee_kmh",
    "fiets_temp_weight": "temp_weight",
}


def _get_extra(current_user: User, session: Session) -> dict:
    row = session.exec(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    ).first()
    return row.extra or {} if row else {}


@router.get("/prognose")
async def get_prognose(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    extra = _get_extra(current_user, session)
    prefs = {out: extra[key] for key, out in _PREF_KEYS.items() if extra.get(key) is not None}

    lat = extra.get("fiets_lat", settings.FIETS_LAT)
    lon = extra.get("fiets_lon", settings.FIETS_LON)
    location_label = extra.get("fiets_location_label", settings.FIETS_LOCATION_LABEL)

    return await svc.build_prognose(lat, lon, prefs, location_label)


@router.get("/geocode")
async def geocode(q: str, _: User = Depends(get_current_user)):
    return {"results": await svc.geocode_location(q)}
