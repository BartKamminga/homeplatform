"""FietsPrognose router — wanneer kan ik het beste fietsen?"""

from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlmodel import Session, select

from core.analytics import client_ip, hash_ip, log_site_event
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
    "fiets_wind_knee_kmh": "wind_knee_kmh",
    "fiets_temp_weight": "temp_weight",
    "fiets_weight_rain": "weight_rain",
    "fiets_weight_temp": "weight_temp",
    "fiets_weight_sun": "weight_sun",
    "fiets_weight_wind": "weight_wind",
    "fiets_include_night": "include_night",
    "fiets_ride_duration_h": "ride_duration_h",
    "fiets_label_excellent": "label_excellent",
    "fiets_label_good": "label_good",
    "fiets_label_fair": "label_fair",
}


def _get_extra(current_user: User, session: Session) -> dict:
    row = session.exec(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    ).first()
    return row.extra or {} if row else {}


@router.get("/prognose")
async def get_prognose(
    request: Request,
    sources: Optional[str] = None,  # comma-gescheiden: "knmi,gfs" — togglebaar op de main page (item 790)
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    extra = _get_extra(current_user, session)
    prefs = {out: extra[key] for key, out in _PREF_KEYS.items() if extra.get(key) is not None}

    lat = extra.get("fiets_lat", settings.FIETS_LAT)
    lon = extra.get("fiets_lon", settings.FIETS_LON)
    location_label = extra.get("fiets_location_label", settings.FIETS_LOCATION_LABEL)
    source_list = [s.strip() for s in sources.split(",")] if sources else None

    result = await svc.build_prognose(lat, lon, prefs, location_label, source_list)
    try:
        log_site_event(
            "fiets", "api_call",
            ip_hash=hash_ip(client_ip(request)),
            user_agent=request.headers.get("User-Agent", ""),
            endpoint="/api/fiets/prognose",
        )
    except Exception:
        pass
    return result


@router.get("/geocode")
async def geocode(q: str, _: User = Depends(get_current_user)):
    return {"results": await svc.geocode_location(q)}


@router.get("/debug")
async def get_debug_view(
    weight_rain: Optional[float] = None,
    weight_temp: Optional[float] = None,
    weight_sun: Optional[float] = None,
    weight_wind: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Ruwe brondata (KNMI/GFS los) + score-tussenstappen per uur — voor de
    debug/data-pagina (item 797), om te leren hoe de score tot stand komt.
    De query-params zijn een live preview (overschrijven de opgeslagen
    gewichten alleen voor deze aanroep, zonder op te slaan)."""
    extra = _get_extra(current_user, session)
    prefs = {out: extra[key] for key, out in _PREF_KEYS.items() if extra.get(key) is not None}

    preview = {
        "weight_rain": weight_rain, "weight_temp": weight_temp,
        "weight_sun": weight_sun, "weight_wind": weight_wind,
    }
    prefs.update({k: v for k, v in preview.items() if v is not None})

    lat = extra.get("fiets_lat", settings.FIETS_LAT)
    lon = extra.get("fiets_lon", settings.FIETS_LON)
    return await svc.build_debug_view(lat, lon, prefs)
