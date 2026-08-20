"""Fiets prognose — Open-Meteo integratie en score-model.

Beantwoordt: wanneer is het de komende 3 dagen (overdag, blokken van 1-3 uur)
goed fietsweer, op basis van regen, temperatuur en wind (snelheid + richting)?
"""

import logging
import time
from datetime import datetime, timedelta
from math import atan2, cos, degrees, radians, sin

import httpx

from core.analytics import log_site_event

logger = logging.getLogger("homeplatform")

OPENMETEO_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_DAYS = 3
CACHE_TTL = 1800  # 30 min — cachet de RUWE Open-Meteo respons, niet de gescoorde output,
# zodat een gewijzigde windvoorkeur direct een andere score geeft zonder cache-invalidatie.

# ── Score-model constanten — MVP-startpunt, later instelbaar via instellingen ──
# (roadmap-item "Score-drempels/comfortband instelbaar maken via instellingen")

# Regen — harde poort: boven de drempel telt temperatuur/wind niet meer mee.
RAIN_PROB_THRESHOLD = 50   # %
RAIN_MM_THRESHOLD = 0.2    # mm/uur
RAIN_GATE_SCORE_MAX = 15   # score (0-100) die een geblokkeerd uur maximaal krijgt

# Temperatuur — comfortcurve met een piek-band, geleidelijk aflopend naar de randen.
TEMP_OPTIMAL_MIN = 15.0    # °C
TEMP_OPTIMAL_MAX = 22.0    # °C
TEMP_FALLOFF_RATE = 4.0    # scorepunten verlies per °C buiten de band

# Wind — snelheid: penalty die harder oploopt boven het knikpunt.
WIND_KNEE_KMH = 25.0
WIND_LINEAR_PENALTY_PER_KMH = 1.5
WIND_STEEP_PENALTY_PER_KMH = 4.0

# Wind — richting t.o.v. de voorkeur van de gebruiker (cosinus-gewogen bonus/malus).
WIND_DIR_BONUS_MAX = 10
WIND_DIR_MALUS_MAX = 10

# Gewicht temperatuur vs. wind in de eindscore — MVP-vast, later instelbaar
# (roadmap-item "Gewicht temperatuur vs. wind instelbaar maken").
TEMP_WEIGHT = 0.6
WIND_WEIGHT = 0.4

# Zon — kleine bonus bovenop temp/wind, geen eigen gewicht (voorkomt dat de
# instelbare temp/wind-verdeling opnieuw ontworpen moet worden). Alleen overdag:
# 's nachts is er geen zon, ongeacht bewolking.
SUN_BONUS_MAX = 8  # scorepunten bij een volledig onbewolkte lucht

# Licht/donker — 's nachts fietsen is sowieso minder aantrekkelijk (zicht/
# veiligheid), los van het weer. Vaste malus, geen eigen gewicht.
NIGHT_PENALTY = 15  # scorepunten

# Twee onafhankelijke modellen (beide via Open-Meteo, geen 2e integratie nodig)
# voor een betrouwbaardere score — gemiddelde van KNMI (Harmonie) en NOAA GFS.
# (ecmwf_ifs04 gaf op 3 dagen vooruit alleen null-waarden — niet gebruiken.)
# Kort label -> Open-Meteo model-id, gebruikt voor de aan/uit-toggle per bron (item 790).
SOURCE_MODELS = {"knmi": "knmi_seamless", "gfs": "gfs_seamless"}
WEATHER_MODELS = ",".join(SOURCE_MODELS.values())
# Boven deze verschillen tussen de twee modellen markeren we het uur als "low confidence".
DISAGREEMENT_TEMP_C = 3.0
DISAGREEMENT_RAIN_PROB = 25

_WEEKDAGEN = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"]
_MAANDEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"]

_cache: dict[str, dict] = {}  # key: "lat,lon" (afgerond) -> {"data":..., "ts":...}


def _cache_key(lat: float, lon: float) -> str:
    return f"{round(lat, 2)},{round(lon, 2)}"


def _blend_models(raw_hourly: dict, model_ids: list[str]) -> dict:
    """Middelt de gekozen modellen (1 of 2 van SOURCE_MODELS) per uur tot één
    hourly-dict met de gebruikelijke (ongesuffixte) veldnamen, plus
    low_confidence per uur waar twee bronnen het duidelijk oneens zijn
    (altijd False als er maar 1 bron actief is — niets om mee te vergelijken)."""
    n = len(raw_hourly["time"])
    blended = {
        "time": raw_hourly["time"],
        "temperature_2m": [], "precipitation_probability": [], "precipitation": [],
        "wind_speed_10m": [], "wind_direction_10m": [], "is_day": [],
        "cloud_cover": [], "low_confidence": [],
    }
    for i in range(n):
        temps = [raw_hourly[f"temperature_2m_{m}"][i] for m in model_ids]
        probs = [raw_hourly[f"precipitation_probability_{m}"][i] for m in model_ids]
        rains = [raw_hourly[f"precipitation_{m}"][i] for m in model_ids]
        winds = [raw_hourly[f"wind_speed_10m_{m}"][i] for m in model_ids]
        dirs = [raw_hourly[f"wind_direction_10m_{m}"][i] for m in model_ids]
        clouds = [raw_hourly[f"cloud_cover_{m}"][i] for m in model_ids]

        # Vector-gemiddelde voor windrichting (voorkomt vertekening rond 0/360).
        sin_avg = sum(sin(radians(d)) for d in dirs) / len(dirs)
        cos_avg = sum(cos(radians(d)) for d in dirs) / len(dirs)
        wind_dir_avg = (degrees(atan2(sin_avg, cos_avg)) + 360) % 360

        blended["temperature_2m"].append(round(sum(temps) / len(temps), 1))
        blended["precipitation_probability"].append(round(sum(probs) / len(probs)))
        blended["precipitation"].append(round(sum(rains) / len(rains), 2))
        blended["wind_speed_10m"].append(round(sum(winds) / len(winds), 1))
        blended["wind_direction_10m"].append(round(wind_dir_avg))
        blended["cloud_cover"].append(round(sum(clouds) / len(clouds)))
        blended["is_day"].append(raw_hourly[f"is_day_{model_ids[0]}"][i])
        blended["low_confidence"].append(
            len(model_ids) > 1 and (max(temps) - min(temps) > DISAGREEMENT_TEMP_C
                                     or max(probs) - min(probs) > DISAGREEMENT_RAIN_PROB)
        )
    return blended


async def fetch_openmeteo_raw(lat: float, lon: float) -> dict | None:
    """Haalt uurlijkse forecast op bij Open-Meteo voor beide modellen (KNMI + GFS),
    ongeblend, met een TTL-cache per locatie — zodat het aan/uit togglen van een
    bron (item 790) geen nieuwe Open-Meteo-call vereist, alleen herblenden."""
    key = _cache_key(lat, lon)
    now = time.time()
    cached = _cache.get(key)
    if cached is not None and now - cached["ts"] < CACHE_TTL:
        return cached["data"]

    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,precipitation_probability,precipitation,"
                  "wind_speed_10m,wind_direction_10m,is_day,cloud_cover",
        "forecast_days": FORECAST_DAYS,
        "timezone": "auto",
        "models": WEATHER_MODELS,
    }
    t0 = time.time()
    status_code = 0
    data = None
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(OPENMETEO_URL, params=params)
            status_code = response.status_code
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        logger.warning("fiets: open-meteo fetch failed — %s", exc)

    try:
        log_site_event(
            "fiets", "source_call",
            source_url=OPENMETEO_URL,
            duration_ms=int((time.time() - t0) * 1000),
            status_code=status_code,
            result_count=len(data["hourly"]["time"]) if data else 0,
        )
    except Exception:
        pass

    if data is not None:
        _cache[key] = {"data": data, "ts": now}
    return data


async def geocode_location(query: str) -> list[dict]:
    """Zoekt plaatsnamen op via de Open-Meteo geocoding-API (ook gratis, geen key)."""
    if not query or len(query) < 2:
        return []
    params = {"name": query, "count": 5, "language": "nl", "format": "json"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(GEOCODE_URL, params=params)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        logger.warning("fiets: geocode fetch failed — %s", exc)
        return []

    return [
        {
            "label": ", ".join(filter(None, [r.get("name"), r.get("admin1"), r.get("country")])),
            "lat": r["latitude"],
            "lon": r["longitude"],
        }
        for r in data.get("results", [])
    ]


def score_hour(
    temp: float,
    rain_prob: float,
    rain_mm: float,
    wind_kmh: float,
    wind_dir_deg: float,
    cloud_cover: float,
    is_daytime: bool,
    prefs: dict | None = None,
) -> dict:
    """Score 0-100 voor één uur, opgesplitst in bijdragen (voor de gesegmenteerde
    balk: welk deel komt van temperatuur/wind/zon). Regen is een harde poort;
    's nachts geen zon-bonus en een vaste malus (zicht/veiligheid).

    `prefs` overschrijft per gebruiker instelbare defaults (roadmap-items
    "Score-drempels/comfortband instelbaar maken" en "Gewicht instelbaar maken");
    ontbrekende keys vallen terug op de MVP-constanten hierboven."""
    prefs = prefs or {}
    pref_deg = prefs.get("wind_pref_deg")
    temp_min = prefs.get("temp_min", TEMP_OPTIMAL_MIN)
    temp_max = prefs.get("temp_max", TEMP_OPTIMAL_MAX)
    rain_prob_threshold = prefs.get("rain_prob_threshold", RAIN_PROB_THRESHOLD)
    wind_knee_kmh = prefs.get("wind_knee_kmh", WIND_KNEE_KMH)
    temp_weight = prefs.get("temp_weight", TEMP_WEIGHT)
    wind_weight = 1 - temp_weight
    # Percentage-korting i.p.v. vaste puntenaftrek, zodat temp/wind-bijdragen
    # en het eindcijfer altijd exact blijven optellen (nodig voor de
    # gestapelde grafiek — geen apart "nacht"-laagje nodig).
    night_factor = 1.0 if is_daytime else (1 - NIGHT_PENALTY / 100)

    if (rain_prob or 0) > rain_prob_threshold or (rain_mm or 0) > RAIN_MM_THRESHOLD:
        gated = max(0.0, (RAIN_GATE_SCORE_MAX - (rain_prob or 0) / 10) * night_factor)
        return {
            "score": round(gated, 1), "rain_gated": True,
            "temp_contrib": 0.0, "wind_contrib": 0.0, "sun_bonus": 0.0,
        }

    temp_penalty = max(0.0, temp_min - temp, temp - temp_max)
    temp_score = max(0.0, min(100.0, 100.0 - temp_penalty * TEMP_FALLOFF_RATE))

    if wind_kmh <= wind_knee_kmh:
        wind_penalty = wind_kmh * WIND_LINEAR_PENALTY_PER_KMH
    else:
        wind_penalty = (
            wind_knee_kmh * WIND_LINEAR_PENALTY_PER_KMH
            + (wind_kmh - wind_knee_kmh) * WIND_STEEP_PENALTY_PER_KMH
        )
    wind_score = max(0.0, 100.0 - wind_penalty)

    if pref_deg is not None:
        cos_diff = cos(radians(wind_dir_deg - pref_deg))
        adjustment = cos_diff * (WIND_DIR_BONUS_MAX if cos_diff >= 0 else WIND_DIR_MALUS_MAX)
        wind_score = max(0.0, min(100.0, wind_score + adjustment))

    temp_contrib = temp_weight * temp_score * night_factor
    wind_contrib = wind_weight * wind_score * night_factor
    sun_bonus = (100 - (cloud_cover or 0)) / 100 * SUN_BONUS_MAX if is_daytime else 0.0

    total = max(0.0, min(100.0, temp_contrib + wind_contrib + sun_bonus))
    return {
        "score": round(total, 1),
        "rain_gated": False,
        "temp_contrib": round(temp_contrib, 1),
        "wind_contrib": round(wind_contrib, 1),
        "sun_bonus": round(sun_bonus, 1),
    }


def _score_label(score: float) -> str:
    if score >= 8:
        return "uitstekend fietsweer"
    if score >= 6:
        return "goed fietsweer"
    if score >= 4:
        return "matig fietsweer"
    return "slecht fietsweer"


def best_window(hours: list[dict], min_h: int = 1, max_h: int = 3) -> dict | None:
    """Schuift over de daguren en kiest het venster (1-3u) met de hoogste gemiddelde score.
    Bij gelijke score wint de vroegste starttijd — niet kritisch, de volledige tijdlijn
    blijft ook zichtbaar in de grafiek."""
    daytime = [h for h in hours if h["is_daytime"]]
    if not daytime:
        return None

    best = None
    for window_len in range(min_h, max_h + 1):
        for start_idx in range(0, len(daytime) - window_len + 1):
            window = daytime[start_idx:start_idx + window_len]
            avg_score = round(sum(h["score"] for h in window) / len(window), 1)
            if best is None or avg_score > best["avg_score"]:
                end_dt = datetime.fromisoformat(window[-1]["time"]) + timedelta(hours=1)
                best = {
                    "start": window[0]["time"],
                    "end": end_dt.isoformat(),
                    "avg_score": avg_score,
                }

    best["label"] = f"{best['start'][11:16]}–{best['end'][11:16]}, {_score_label(best['avg_score'])}"
    return best


def _format_day_label(date_key: str) -> str:
    d = datetime.strptime(date_key, "%Y-%m-%d")
    return f"{_WEEKDAGEN[d.weekday()]} {d.day} {_MAANDEN[d.month - 1]}"


async def build_prognose(
    lat: float, lon: float, prefs: dict | None = None, location_label: str = "",
    sources: list[str] | None = None,
) -> dict:
    prefs = prefs or {}
    active_sources = [s for s in (sources or list(SOURCE_MODELS)) if s in SOURCE_MODELS] or list(SOURCE_MODELS)
    raw = await fetch_openmeteo_raw(lat, lon)
    if raw is None:
        return {"status": "error", "message": "Weerdata niet beschikbaar", "days": []}

    hourly = _blend_models(raw["hourly"], [SOURCE_MODELS[s] for s in active_sources])
    times = hourly["time"]
    temps = hourly["temperature_2m"]
    rain_probs = hourly["precipitation_probability"]
    rain_mms = hourly["precipitation"]
    winds = hourly["wind_speed_10m"]
    wind_dirs = hourly["wind_direction_10m"]
    is_days = hourly["is_day"]
    cloud_covers = hourly["cloud_cover"]
    low_confidences = hourly["low_confidence"]

    days_map: dict[str, list[dict]] = {}
    for i, iso_time in enumerate(times):
        is_daytime = bool(is_days[i])
        s = score_hour(temps[i], rain_probs[i], rain_mms[i], winds[i], wind_dirs[i], cloud_covers[i], is_daytime, prefs)
        days_map.setdefault(iso_time[:10], []).append({
            "time": iso_time,
            "is_daytime": is_daytime,
            "score": round(s["score"] / 10, 1),
            "breakdown": {
                "rain_gated": s["rain_gated"],
                "temp_contrib": round(s["temp_contrib"] / 10, 1),
                "wind_contrib": round(s["wind_contrib"] / 10, 1),
                "sun_bonus": round(s["sun_bonus"] / 10, 1),
            },
            "temp": temps[i],
            "rain_prob": rain_probs[i],
            "rain_mm": rain_mms[i],
            "wind_kmh": winds[i],
            "wind_dir": wind_dirs[i],
            "cloud_cover": cloud_covers[i],
            "low_confidence": low_confidences[i],
        })

    days = [
        {
            "date": date_key,
            "label": _format_day_label(date_key),
            "hours": hours,
            "best_window": best_window(hours),
        }
        for date_key, hours in sorted(days_map.items())
    ]

    cached = _cache.get(_cache_key(lat, lon))
    return {
        "status": "ok",
        "location": {"lat": lat, "lon": lon, "label": location_label},
        "sources": active_sources,
        "wind_pref_deg": prefs.get("wind_pref_deg"),
        "scale": "0-10",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "cache_age_s": int(time.time() - cached["ts"]) if cached else 0,
        "days": days,
    }
