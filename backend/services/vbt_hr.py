"""VBT: verhouding hartslag/vermogen per rit (item 1351) - zelfde rekenwijze als ui/features/rides/hrMetrics.js.

- EF (Efficiency Factor) = Normalized Power / gemiddelde hartslag
- decoupling (Pw:HR) = hoeveel de verhouding W/HR in de tweede helft lager ligt dan in de eerste helft (%)
- fit = lineaire fit watt = a + b * hartslag over minuutblokken; de app rekent daarmee 'watt bij vaste hartslag'
  uit met de hrMax van dat moment (daarom bewaren we de fit en niet het getal zelf)

Alleen samples met hartslag en vermogen tellen mee (pauzes zitten niet in de samples, freewheelen wel: 0 W valt weg),
en de eerste 10 minuten niet (opwarmen, hartslag loopt nog op).
sample = [t, pos, odo, watt, cadans, hartslag, snelheid, hoogte]
"""
VERSION = 1
WARMUP = 600          # s
MIN_DURATION = 1800   # s rit
MIN_VALID = 1200      # s bruikbare samples na het opwarmen
STEADY_VI = 1.05      # variability index (NP / gem. W) tot hier = gelijkmatige rit
BIN = 60              # s per blok voor de fit


def _np(watts: list) -> float:
    """Normalized Power: 30 s voortschrijdend gemiddelde, tot de 4e macht, gemiddeld, 4e-machtswortel."""
    if len(watts) < 30:
        return sum(watts) / max(1, len(watts))
    run = sum(watts[:30])
    rolled = [run / 30]
    for i in range(30, len(watts)):
        run += watts[i] - watts[i - 30]
        rolled.append(run / 30)
    return (sum(r ** 4 for r in rolled) / len(rolled)) ** 0.25


def _fit(pairs: list):
    """Kleinste-kwadratenfit watt = a + b * hr over minuutblokken; None als er te weinig spreiding is."""
    bins = [pairs[i:i + BIN] for i in range(0, len(pairs) - BIN + 1, BIN)]
    pts = [(sum(h for _, h in b) / BIN, sum(w for w, _ in b) / BIN) for b in bins]
    if len(pts) < 10:
        return None
    hrs = [h for h, _ in pts]
    if max(hrs) - min(hrs) < 8:
        return None
    mh = sum(hrs) / len(pts)
    mw = sum(w for _, w in pts) / len(pts)
    sxx = sum((h - mh) ** 2 for h in hrs)
    b = sum((h - mh) * (w - mw) for h, w in pts) / sxx
    if b <= 0:
        return None
    return {"a": round(mw - b * mh, 2), "b": round(b, 4), "hrLo": round(min(hrs)), "hrHi": round(max(hrs))}


def hr_metrics(samples: list) -> dict:
    """{'v': 1, 'eligible': False} als de rit niet bruikbaar is; anders ook ef, np, decoupling, steady, fit."""
    out = {"v": VERSION, "eligible": False}
    if not samples or len(samples) < MIN_DURATION:
        return out
    pairs = [(s[3], s[5]) for s in samples[WARMUP:]
             if len(s) > 5 and s[3] and s[5] and s[3] > 0 and s[5] > 0]
    if len(pairs) < MIN_VALID:
        return out
    watts = [w for w, _ in pairs]
    avg_w = sum(watts) / len(watts)
    avg_hr = sum(h for _, h in pairs) / len(pairs)
    np_w = _np(watts)
    half = len(pairs) // 2

    def ratio(part):
        return (sum(w for w, _ in part) / len(part)) / (sum(h for _, h in part) / len(part))

    r1, r2 = ratio(pairs[:half]), ratio(pairs[half:])
    out.update({
        "eligible": True,
        "ef": round(np_w / avg_hr, 2),
        "np": round(np_w),
        "decoupling": round((r1 - r2) / r1 * 100, 1),
        "steady": np_w / avg_w <= STEADY_VI,
        "fit": _fit(pairs),
    })
    return out
