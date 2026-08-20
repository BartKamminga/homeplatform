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
#
# Vijf onafhankelijke 0-100 subscores (nacht/regen/temp/zon/wind), elk met
# een vast gewicht — prioriteit nacht > regen > temp > zon > wind. Nacht was
# eerder een harde poort die temp/regen/zon/wind op 0 zette (klopte niet: die
# subscores worden altijd echt berekend, ook 's nachts); nu telt nacht mee
# als volwaardige, instelbare factor net als de andere vier.
NIGHT_WEIGHT = 0.35
RAIN_WEIGHT = 0.25
SUN_WEIGHT = 0.15
TEMP_WIND_BUDGET = 1 - NIGHT_WEIGHT - RAIN_WEIGHT - SUN_WEIGHT  # 0.25 — verdeeld via de instelbare temp/wind-balans

# Nacht kan ook als absolute (harde) grens gelden i.p.v. alleen gewogen —
# instelbaar via een toggle. De losse subscores blijven altijd echt berekend/
# zichtbaar; dit plafond raakt alleen de eindscore.
NIGHT_ABSOLUTE_MAX = 15  # score (0-100) die een nachtelijk uur maximaal krijgt als de toggle aan staat

# Dag/nacht is geen aan/uit-schakelaar maar een vloeiende schemering: een
# smoothstep-overgang van TWILIGHT_MINUTES rond zonsopgang/-ondergang i.p.v.
# een abrupte sprong tussen het laatste nachtuur en het eerste daguur. Ruim
# gekozen (3 uur) zodat de overgang met uurlijkse data ook echt over meerdere
# uren zichtbaar is, niet slechts 1 tussenwaarde.
TWILIGHT_MINUTES = 180


def _smoothstep(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def _daylight_factor(hour_dt: datetime, sunrise: datetime, sunset: datetime) -> float:
    """0 = volledig nacht, 1 = volledig dag, met een vloeiende overgang rond
    beide randen i.p.v. een harde 0/1-sprong."""
    half = TWILIGHT_MINUTES / 2
    since_sunrise = (hour_dt - sunrise).total_seconds() / 60
    since_sunset = (hour_dt - sunset).total_seconds() / 60
    ramp_up = _smoothstep((since_sunrise + half) / TWILIGHT_MINUTES)
    ramp_down = 1 - _smoothstep((since_sunset + half) / TWILIGHT_MINUTES)
    return min(ramp_up, ramp_down)

# Regen — geen harde poort. Regenkans bleek zwak gecorreleerd met werkelijke
# neerslag (vaak 100% kans bij 0mm), dus telt niet mee. In plaats daarvan:
# mm + WMO weather_code-tier (licht/matig/zwaar) bepalen samen de regen-score
# (100 = droog, 0 = zware bui).
MM_IMPACT_PER_MM = 0.25
TIER_IMPACT = {0: 0.0, 1: 0.10, 2: 0.25, 3: 0.45}

# WMO weather_code -> intensiteits-tier. Codes die geen neerslag betekenen
# (helder/bewolkt/mist) vallen op tier 0.
_TIER_3_CODES = {55, 57, 65, 66, 67, 75, 82, 86, 95, 96, 99}   # zwaar (regen/onweer/ijzel)
_TIER_2_CODES = {53, 63, 73, 81}                                # matig
_TIER_1_CODES = {51, 56, 61, 71, 77, 80, 85}                    # licht


def _code_tier(code: int) -> int:
    if code in _TIER_3_CODES:
        return 3
    if code in _TIER_2_CODES:
        return 2
    if code in _TIER_1_CODES:
        return 1
    return 0

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

# Verdeling van TEMP_WIND_BUDGET tussen temp en wind — instelbaar
# (roadmap-item "Gewicht temperatuur vs. wind instelbaar maken").
TEMP_SPLIT = 0.6  # 60% van het temp/wind-budget naar temp, 40% naar wind


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
        "cloud_cover": [], "low_confidence": [], "rain_tier": [],
    }
    for i in range(n):
        temps = [raw_hourly[f"temperature_2m_{m}"][i] for m in model_ids]
        probs = [raw_hourly[f"precipitation_probability_{m}"][i] for m in model_ids]
        rains = [raw_hourly[f"precipitation_{m}"][i] for m in model_ids]
        winds = [raw_hourly[f"wind_speed_10m_{m}"][i] for m in model_ids]
        dirs = [raw_hourly[f"wind_direction_10m_{m}"][i] for m in model_ids]
        clouds = [raw_hourly[f"cloud_cover_{m}"][i] for m in model_ids]
        # Ergst-geval tier van de actieve bronnen (voorzichtig: als 1 bron regen
        # ziet, wegen we die mee i.p.v. het te middelen/negeren).
        tier = max(_code_tier(raw_hourly[f"weather_code_{m}"][i]) for m in model_ids)

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
        blended["rain_tier"].append(tier)
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
                  "wind_speed_10m,wind_direction_10m,is_day,cloud_cover,weather_code",
        "daily": "sunrise,sunset",
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
    rain_mm: float,
    rain_tier: int,
    wind_kmh: float,
    wind_dir_deg: float,
    cloud_cover: float,
    daylight_factor: float,
    prefs: dict | None = None,
) -> dict:
    """Score 0-100 voor één uur, opgesplitst in 5 gewogen subscores: nacht, regen,
    temp, zon, wind (prioriteit in die volgorde). Elke subscore wordt altijd
    echt berekend — ook 's nachts — zodat de bijdragen nooit ten onrechte 0 zijn.

    `prefs` overschrijft per gebruiker instelbare defaults (roadmap-items
    "Score-drempels/comfortband instelbaar maken" en "Gewicht instelbaar maken");
    ontbrekende keys vallen terug op de MVP-constanten hierboven."""
    prefs = prefs or {}
    pref_deg = prefs.get("wind_pref_deg")
    temp_min = prefs.get("temp_min", TEMP_OPTIMAL_MIN)
    temp_max = prefs.get("temp_max", TEMP_OPTIMAL_MAX)
    wind_knee_kmh = prefs.get("wind_knee_kmh", WIND_KNEE_KMH)

    # Eigen profiel: als de gebruiker alle 5 gewichten los heeft ingesteld
    # (debug-pagina), genormaliseerd gebruiken i.p.v. de vaste verdeling.
    custom_keys = ("weight_night", "weight_rain", "weight_temp", "weight_sun", "weight_wind")
    if all(prefs.get(k) is not None for k in custom_keys):
        raw = {k: max(0.0, prefs[k]) for k in custom_keys}
        total_raw = sum(raw.values()) or 1.0
        night_weight = raw["weight_night"] / total_raw
        rain_weight = raw["weight_rain"] / total_raw
        temp_weight = raw["weight_temp"] / total_raw
        sun_weight = raw["weight_sun"] / total_raw
        wind_weight = raw["weight_wind"] / total_raw
    else:
        temp_split = prefs.get("temp_weight", TEMP_SPLIT)
        night_weight = NIGHT_WEIGHT
        rain_weight = RAIN_WEIGHT
        sun_weight = SUN_WEIGHT
        temp_weight = temp_split * TEMP_WIND_BUDGET
        wind_weight = (1 - temp_split) * TEMP_WIND_BUDGET

    night_score = daylight_factor * 100.0

    rain_impact = min(1.0, (rain_mm or 0) * MM_IMPACT_PER_MM + TIER_IMPACT.get(rain_tier, 0.0))
    rain_score = (1 - rain_impact) * 100

    temp_penalty = max(0.0, temp_min - temp, temp - temp_max)
    temp_score = max(0.0, min(100.0, 100.0 - temp_penalty * TEMP_FALLOFF_RATE))

    sun_score = 100.0 - (cloud_cover or 0)

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

    night_contrib = night_weight * night_score
    rain_contrib = rain_weight * rain_score
    temp_contrib = temp_weight * temp_score
    sun_contrib = sun_weight * sun_score
    wind_contrib = wind_weight * wind_score

    total = max(0.0, min(100.0, night_contrib + rain_contrib + temp_contrib + sun_contrib + wind_contrib))
    if prefs.get("night_absolute") and daylight_factor < 0.5:
        total = min(total, NIGHT_ABSOLUTE_MAX)
    return {
        "score": round(total, 1),
        "night_gated": daylight_factor < 0.5,
        "daylight_factor": round(daylight_factor, 2),
        "night_contrib": round(night_contrib, 1),
        "rain_contrib": round(rain_contrib, 1),
        "temp_contrib": round(temp_contrib, 1),
        "sun_contrib": round(sun_contrib, 1),
        "wind_contrib": round(wind_contrib, 1),
    }


# Score-staffel voor de beste-moment-labels (0-10 schaal) — MVP-defaults,
# instelbaar via de debug-pagina (nerd-instelling, niet in gewone instellingen).
LABEL_EXCELLENT = 8.0
LABEL_GOOD = 6.0
LABEL_FAIR = 4.0


def _score_label(score: float, prefs: dict | None = None) -> str:
    prefs = prefs or {}
    if score >= prefs.get("label_excellent", LABEL_EXCELLENT):
        return "uitstekend fietsweer"
    if score >= prefs.get("label_good", LABEL_GOOD):
        return "goed fietsweer"
    if score >= prefs.get("label_fair", LABEL_FAIR):
        return "matig fietsweer"
    return "slecht fietsweer"


def best_window(hours: list[dict], min_h: int = 1, max_h: int = 3, prefs: dict | None = None) -> dict | None:
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

    best["label"] = f"{best['start'][11:16]}–{best['end'][11:16]}, {_score_label(best['avg_score'], prefs)}"
    return best


def _sun_times_by_date(raw: dict, model_id: str) -> dict[str, tuple]:
    """date -> (sunrise, sunset) als datetime, voor de vloeiende dag/nacht-curve."""
    daily = raw.get("daily", {})
    dates = daily.get("time", [])
    sunrises = daily.get(f"sunrise_{model_id}", [])
    sunsets = daily.get(f"sunset_{model_id}", [])
    return {
        date: (datetime.fromisoformat(sunrises[i]), datetime.fromisoformat(sunsets[i]))
        for i, date in enumerate(dates)
        if i < len(sunrises) and i < len(sunsets)
    }


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
    rain_tiers = hourly["rain_tier"]
    sun_times = _sun_times_by_date(raw, SOURCE_MODELS[active_sources[0]])

    days_map: dict[str, list[dict]] = {}
    for i, iso_time in enumerate(times):
        is_daytime = bool(is_days[i])
        sunrise, sunset = sun_times.get(iso_time[:10], (None, None))
        daylight_factor = _daylight_factor(datetime.fromisoformat(iso_time), sunrise, sunset) if sunrise else float(is_daytime)
        s = score_hour(temps[i], rain_mms[i], rain_tiers[i], winds[i], wind_dirs[i], cloud_covers[i], daylight_factor, prefs)
        days_map.setdefault(iso_time[:10], []).append({
            "time": iso_time,
            "is_daytime": is_daytime,
            "score": round(s["score"] / 10, 1),
            "breakdown": {
                "night_gated": s["night_gated"],
                "night_contrib": round(s["night_contrib"] / 10, 1),
                "rain_contrib": round(s["rain_contrib"] / 10, 1),
                "temp_contrib": round(s["temp_contrib"] / 10, 1),
                "sun_contrib": round(s["sun_contrib"] / 10, 1),
                "wind_contrib": round(s["wind_contrib"] / 10, 1),
            },
            "temp": temps[i],
            "rain_prob": rain_probs[i],
            "rain_mm": rain_mms[i],
            "rain_tier": rain_tiers[i],
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
            "best_window": best_window(hours, prefs=prefs),
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


async def build_debug_view(lat: float, lon: float, prefs: dict | None = None) -> dict:
    """Per uur: de ruwe waarden per bron (KNMI/GFS los), het geblende resultaat
    en de score-tussenstappen — voor de debug/data-pagina (item 797), puur om
    te leren hoe de score tot stand komt. Gebruikt altijd beide bronnen."""
    prefs = prefs or {}
    raw = await fetch_openmeteo_raw(lat, lon)
    if raw is None:
        return {"status": "error", "message": "Weerdata niet beschikbaar", "rows": []}

    raw_hourly = raw["hourly"]
    blended = _blend_models(raw_hourly, list(SOURCE_MODELS.values()))
    n = len(raw_hourly["time"])
    sun_times = _sun_times_by_date(raw, next(iter(SOURCE_MODELS.values())))

    rows = []
    for i in range(n):
        per_source = {}
        for key, model_id in SOURCE_MODELS.items():
            per_source[key] = {
                "temp": raw_hourly[f"temperature_2m_{model_id}"][i],
                "rain_prob": raw_hourly[f"precipitation_probability_{model_id}"][i],
                "rain_mm": raw_hourly[f"precipitation_{model_id}"][i],
                "weather_code": raw_hourly[f"weather_code_{model_id}"][i],
                "cloud_cover": raw_hourly[f"cloud_cover_{model_id}"][i],
                "wind_kmh": raw_hourly[f"wind_speed_10m_{model_id}"][i],
                "wind_dir": raw_hourly[f"wind_direction_10m_{model_id}"][i],
            }

        is_daytime = bool(blended["is_day"][i])
        sunrise, sunset = sun_times.get(blended["time"][i][:10], (None, None))
        daylight_factor = _daylight_factor(datetime.fromisoformat(blended["time"][i]), sunrise, sunset) if sunrise else float(is_daytime)
        s = score_hour(
            blended["temperature_2m"][i], blended["precipitation"][i], blended["rain_tier"][i],
            blended["wind_speed_10m"][i], blended["wind_direction_10m"][i], blended["cloud_cover"][i],
            daylight_factor, prefs,
        )
        rows.append({
            "time": blended["time"][i],
            "is_daytime": is_daytime,
            "sources": per_source,
            "blended": {
                "temp": blended["temperature_2m"][i],
                "rain_prob": blended["precipitation_probability"][i],
                "rain_mm": blended["precipitation"][i],
                "rain_tier": blended["rain_tier"][i],
                "cloud_cover": blended["cloud_cover"][i],
                "wind_kmh": blended["wind_speed_10m"][i],
                "wind_dir": blended["wind_direction_10m"][i],
            },
            "low_confidence": blended["low_confidence"][i],
            "score": s,
        })

    return {"status": "ok", "rows": rows}
