"""Fiets prognose — Open-Meteo integratie en score-model.

Beantwoordt: wanneer is het de komende 3 dagen (overdag, blokken van 1-3 uur)
goed fietsweer, op basis van regen, temperatuur en wind (snelheid + richting)?
"""

import logging
import time
from datetime import datetime, timedelta
from math import cos, radians

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

_WEEKDAGEN = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"]
_MAANDEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"]

_cache: dict[str, dict] = {}  # key: "lat,lon" (afgerond) -> {"data":..., "ts":...}


def _cache_key(lat: float, lon: float) -> str:
    return f"{round(lat, 2)},{round(lon, 2)}"


async def fetch_openmeteo_hourly(lat: float, lon: float) -> dict | None:
    """Haalt uurlijkse forecast op bij Open-Meteo, met een TTL-cache op de ruwe respons per locatie."""
    key = _cache_key(lat, lon)
    now = time.time()
    cached = _cache.get(key)
    if cached is not None and now - cached["ts"] < CACHE_TTL:
        return cached["data"]

    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,precipitation_probability,precipitation,"
                  "wind_speed_10m,wind_direction_10m,is_day",
        "forecast_days": FORECAST_DAYS,
        "timezone": "auto",
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
    prefs: dict | None = None,
) -> float:
    """Score 0-100 voor één uur. Regen is een harde poort; temp/wind wegen anders mee.

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

    if (rain_prob or 0) > rain_prob_threshold or (rain_mm or 0) > RAIN_MM_THRESHOLD:
        return max(0.0, RAIN_GATE_SCORE_MAX - (rain_prob or 0) / 10)

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

    return round(max(0.0, min(100.0, temp_weight * temp_score + wind_weight * wind_score)), 1)


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
    lat: float, lon: float, prefs: dict | None = None, location_label: str = ""
) -> dict:
    prefs = prefs or {}
    raw = await fetch_openmeteo_hourly(lat, lon)
    if raw is None:
        return {"status": "error", "message": "Weerdata niet beschikbaar", "days": []}

    hourly = raw["hourly"]
    times = hourly["time"]
    temps = hourly["temperature_2m"]
    rain_probs = hourly["precipitation_probability"]
    rain_mms = hourly["precipitation"]
    winds = hourly["wind_speed_10m"]
    wind_dirs = hourly["wind_direction_10m"]
    is_days = hourly["is_day"]

    days_map: dict[str, list[dict]] = {}
    for i, iso_time in enumerate(times):
        raw_score = score_hour(temps[i], rain_probs[i], rain_mms[i], winds[i], wind_dirs[i], prefs)
        days_map.setdefault(iso_time[:10], []).append({
            "time": iso_time,
            "is_daytime": bool(is_days[i]),
            "score": round(raw_score / 10, 1),
            "temp": temps[i],
            "rain_prob": rain_probs[i],
            "rain_mm": rain_mms[i],
            "wind_kmh": winds[i],
            "wind_dir": wind_dirs[i],
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
        "wind_pref_deg": prefs.get("wind_pref_deg"),
        "scale": "0-10",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "cache_age_s": int(time.time() - cached["ts"]) if cached else 0,
        "days": days,
    }
