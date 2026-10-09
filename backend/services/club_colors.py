"""Hoofdkleur van een club, automatisch uit het logo (item clubkleuren wedstrijdkop).

De logo's van de bond zijn kleine plaatjes op een witte achtergrond. We tellen
de pixels per (grof afgeronde) kleur, slaan wit/bijna-wit over en wegen
verzadigde kleuren zwaarder dan zwart/grijs - zodat bv. het geel van Victoria
wint van de zwarte omlijning. Handmatige kleur (primary_color_manual) gaat altijd voor.
"""

import colorsys
import io
import re
from collections import Counter
from typing import Optional

import httpx
from PIL import Image

HEX_RE = re.compile(r"#[0-9a-fA-F]{6}")
# Lege string = geprobeerd maar geen kleur gevonden (niet elke keer opnieuw ophalen)
NO_COLOR = ""


def color_from_image(data: bytes) -> Optional[str]:
    img = Image.open(io.BytesIO(data)).convert("RGBA")
    img.thumbnail((64, 64))
    counts: Counter = Counter()
    sums: dict = {}
    for r, g, b, a in img.getdata():
        if a < 128:
            continue
        _, l, _ = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        if l > 0.88:  # wit en bijna-wit (achtergrond)
            continue
        # grof groeperen zodat anti-aliasing niet versnippert; kleur = gemiddelde van de groep
        key = (r // 32, g // 32, b // 32)
        counts[key] += 1
        sr, sg, sb = sums.get(key, (0, 0, 0))
        sums[key] = (sr + r, sg + g, sb + b)
    if not counts:
        return None

    def mean(key):
        n = counts[key]
        return tuple(round(c / n) for c in sums[key])

    def weight(key):
        r, g, b = mean(key)
        _, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        vivid = s if 0.12 < l < 0.85 else 0
        return counts[key] * (0.35 + 1.5 * vivid)

    r, g, b = mean(max(counts, key=weight))
    return f"#{r:02x}{g:02x}{b:02x}"


def color_from_logo_url(url: str, timeout: float = 4.0) -> str:
    """Kleur als '#rrggbb', of NO_COLOR als het logo niet op te halen/te lezen is."""
    try:
        resp = httpx.get(url, timeout=timeout, follow_redirects=True)
        resp.raise_for_status()
        return color_from_image(resp.content) or NO_COLOR
    except Exception:
        return NO_COLOR


def effective_color(club) -> Optional[str]:
    """Handmatige kleur als die er is, anders de automatische; None als onbekend."""
    if club is None:
        return None
    for value in (getattr(club, "primary_color_manual", None), getattr(club, "primary_color", None)):
        if value and HEX_RE.fullmatch(value):
            return value.lower()
    return None
