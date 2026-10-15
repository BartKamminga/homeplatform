"""Item 1351: EF, aerobic decoupling en HR/W-fit per rit (services/vbt_hr.py)."""
from services.vbt_hr import hr_metrics


def ride(seconds, watts, hr):
    """samples [t, pos, odo, watt, cadans, hartslag, snelheid, hoogte]; watts/hr = functie van t"""
    return [[t, 0, t * 8, watts(t), 85, hr(t), 8, 0] for t in range(seconds)]


def test_short_ride_not_eligible():
    m = hr_metrics(ride(1200, lambda t: 150, lambda t: 130))
    assert m == {"v": 1, "eligible": False}


def test_no_heart_rate_not_eligible():
    assert not hr_metrics(ride(3600, lambda t: 150, lambda t: 0))["eligible"]


def test_steady_ride_without_drift():
    m = hr_metrics(ride(3600, lambda t: 150, lambda t: 125))
    assert m["eligible"] and m["steady"]
    assert m["ef"] == 1.2
    assert m["np"] == 150
    assert m["decoupling"] == 0.0


def test_heart_rate_drift_gives_decoupling():
    # zelfde vermogen, hartslag loopt van 120 naar 132 op: W/HR zakt in de tweede helft
    m = hr_metrics(ride(3600, lambda t: 150, lambda t: 120 + 12 * t / 3600))
    assert m["decoupling"] > 3


def test_fit_watts_against_heart_rate():
    # vermogen stijgt per 5 minuten; hartslag = 60 + 0.5 * watt -> watt = -120 + 2 * hr
    w = lambda t: 120 + 10 * (t // 300)   # noqa: E731
    m = hr_metrics(ride(3600, w, lambda t: 60 + 0.5 * w(t)))
    assert m["fit"]["b"] == 2.0
    assert m["fit"]["a"] == -120.0
    assert not m["steady"] or m["fit"]["hrHi"] > m["fit"]["hrLo"]


def test_coasting_and_warmup_ignored():
    # eerste 10 min en freewheelen (0 W) tellen niet mee
    m = hr_metrics(ride(3600, lambda t: 0 if t < 600 or t % 10 == 0 else 200, lambda t: 140))
    assert m["np"] == 200
