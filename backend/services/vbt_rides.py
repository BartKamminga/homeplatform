"""VBT-ritten: samenvatting uit de samples (zelfde rekenwijze als recorder.js in de game).

sample = [t, pos, odo, watt, cadans, hartslag, snelheid, hoogte]
"""
from datetime import datetime, timezone


def naive_utc(dt: datetime) -> datetime:
    """Opslaan als naïeve UTC, net als de rest van de database."""
    return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt


def summarize(samples: list) -> dict:
    n = max(1, len(samples))
    col = lambda i: [s[i] for s in samples if len(s) > i and s[i] is not None]   # noqa: E731
    gain = sum(max(0, b[7] - a[7]) for a, b in zip(samples, samples[1:]) if len(a) > 7 and len(b) > 7)
    watts = col(3)
    return {
        "duration": len(samples),
        "distance": round(samples[-1][2]) if samples else 0,
        "avg_w": round(sum(watts) / n),
        "max_w": max(watts, default=0),
        "avg_cad": round(sum(col(4)) / n),
        "avg_hr": round(sum(col(5)) / n),
        "kj": round(sum(watts) / 1000),
        "elevation": round(gain),
    }
