"""VBT: analyse per rit, bewaard in vbt_rides.hr_metrics (JSON) en lui aangevuld voor oudere ritten.

- hartslag/vermogen (item 1351): zie services/vbt_hr.py
- zones (item 1297): seconden per vermogenszone (Coggan, t.o.v. de FTP van die rit, zelfde grenzen als
  engine/config.js) en een hartslaghistogram per 5 bpm (de app rekent dat om naar zones met de hrMax van nu)
- mmp (item 1302): beste gemiddelde vermogen over 5, 8, 20 en 60 min - basis voor de virtuele FTP

sample = [t, pos, odo, watt, cadans, hartslag, snelheid, hoogte]
"""
from services.vbt_hr import hr_metrics

VERSION = 2
POWER_ZONES = [0.55, 0.75, 0.90, 1.05, 1.20, 1.50]     # bovengrenzen Z1..Z6 als fractie van FTP; daarboven Z7
HR_BUCKET = 5
MMP_WINDOWS = [300, 480, 1200, 3600]


def _zone_index(f: float) -> int:
    for i, top in enumerate(POWER_ZONES):
        if f <= top:
            return i
    return len(POWER_ZONES)


def zones(samples: list, ftp: int) -> dict:
    pw = [0] * (len(POWER_ZONES) + 1)
    hr: dict = {}
    for s in samples:
        w = s[3] if len(s) > 3 and s[3] is not None else 0
        pw[_zone_index(w / ftp)] += 1
        h = s[5] if len(s) > 5 and s[5] else 0
        if h > 0:
            b = str(int(h // HR_BUCKET * HR_BUCKET))
            hr[b] = hr.get(b, 0) + 1
    return {"pw": pw, "hr": hr}


def mmp(samples: list) -> dict:
    """Beste gemiddelde vermogen per venster (s); alleen vensters die in de rit passen."""
    watts = [(s[3] or 0) if len(s) > 3 else 0 for s in samples]
    out = {}
    for win in MMP_WINDOWS:
        if len(watts) < win:
            continue
        run = sum(watts[:win])
        best = run
        for i in range(win, len(watts)):
            run += watts[i] - watts[i - win]
            best = max(best, run)
        out[str(win)] = round(best / win)
    return out


def analyze(samples: list, ftp: int | None) -> dict:
    out = hr_metrics(samples or [])
    out["v"] = VERSION
    if samples:
        out["zones"] = zones(samples, ftp or 180)
        out["mmp"] = mmp(samples)
    return out
