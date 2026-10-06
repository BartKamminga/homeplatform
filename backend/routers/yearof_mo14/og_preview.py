"""Link-preview voor WhatsApp e.d. (Open Graph) bij de korte links /l/<code>.

WhatsApp leest titel/omschrijving/plaatje uit de HTML achter een link. Een
kale redirect levert alleen "webheaven.nl" op - daarom geeft /l/<code> een
kleine HTML-pagina met og:-tags die de bezoeker direct doorstuurt.

Per soort link:
- player: naam van de speelster + haar profielfoto (zelfde gegevens als de
  spelerslink zelf toont, dus niets extra's).
- match:  wedstrijdtitel + een highlight-foto (de wedstrijdlink toont die ook).
- site:   algemene titel + het standaardplaatje.
Verlopen/onbekende links krijgen alleen de algemene titel en het
standaardplaatje - geen namen of fotos.
"""

import io
import json
from functools import lru_cache
from html import escape
from typing import Optional

import httpx
from fastapi import Request
from PIL import Image, ImageDraw, ImageFont

from core.settings import settings

SITE_NAME = "MO14 à Paris"
DEFAULT_TITLE = "MO14 à Paris"
DEFAULT_DESCRIPTION = "Volg Victoria MO14-1 op weg naar Parijs: wedstrijden, foto's, interviews en de actie."
DEFAULT_IMAGE_PATH = "/api/yearof-mo14/og-default.png?v=2"  # v ophogen bij een nieuw ontwerp: WhatsApp cachet plaatjes per URL

NAVY = (18, 32, 60)
YELLOW = (244, 200, 30)


def public_base_url(request: Request) -> str:
    """Absolute basis-URL voor og:image/og:url - WhatsApp accepteert geen
    relatieve paden. EXTERNAL_URL (secret per omgeving) gaat voor; anders
    afgeleid van de proxy-headers (Caddy/cloudflared)."""
    if settings.EXTERNAL_URL:
        return settings.EXTERNAL_URL.rstrip("/")
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
    return f"{proto}://{host}"


def preview_html(
    *, base: str, link_path: str, target: str, title: str, description: str, image_path: Optional[str],
) -> str:
    """HTML met og:-tags + directe doorverwijzing (meta refresh + JS voor
    browsers; crawlers lezen alleen de tags)."""
    image_url = f"{base}{image_path or DEFAULT_IMAGE_PATH}"
    t, d, img, url, tgt = (escape(x, quote=True) for x in (title, description, image_url, f"{base}{link_path}", target))
    return f"""<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>{t}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{escape(SITE_NAME)}">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:image" content="{img}">
<meta property="og:url" content="{url}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url={tgt}">
<script>location.replace({_js_string(target)})</script>
</head>
<body><a href="{tgt}">Ga naar {t}</a></body>
</html>"""


def _js_string(value: str) -> str:
    # Veilig als JS-string binnen <script>: geen </script>-ontsnapping mogelijk.
    return json.dumps(value).replace("<", "\\u003c").replace(">", "\\u003e")


@lru_cache(maxsize=1)
def default_image_png() -> bytes:
    """Standaardplaatje 800x800, in de huisstijl van de site. Vierkant omdat
    WhatsApp de preview als klein vierkant toont en een breed plaatje in het
    midden bijsnijdt (dan viel de tekst eraf). Gegenereerd i.p.v. een los
    bestand, zodat er geen asset-pipeline nodig is; 1x per proces opgebouwd."""
    size = 800
    img = Image.new("RGB", (size, size), NAVY)
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, size, 24], fill=YELLOW)
    big = ImageFont.load_default(size=170)
    small = ImageFont.load_default(size=44)

    def centered(text: str, y: int, font, fill) -> int:
        x = (size - draw.textlength(text, font=font)) / 2
        draw.text((x, y), text, font=font, fill=fill)
        return x

    centered("MO14", 150, big, (255, 255, 255))
    # Het ingebouwde lettertype heeft geen "à": gewone "a" + zelf getekend accent.
    x = centered("a Paris", 340, big, (255, 255, 255))
    a_width = draw.textlength("a", font=big)
    a_top = draw.textbbox((x, 340), "a", font=big)[1]
    draw.line([(x + a_width * 0.3, a_top - 50), (x + a_width * 0.6, a_top - 12)], fill=(255, 255, 255), width=13)
    centered("Victoria MO14-1", 590, small, YELLOW)
    centered("Pinksterweekend 2027", 650, small, (154, 165, 192))
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Wedstrijdplaatje: beide clublogo's naast elkaar + uitslag/"vs" + datum.
# De logo's van hockeyweerelt zijn 80x80 met een ondertekende URL (grootte niet
# aan te passen) - daarom zelf samenstellen op 800x800 i.p.v. direct linken.
# ---------------------------------------------------------------------------

_logo_cache: dict[str, Image.Image] = {}


def _fetch_logo(url: str) -> Optional[Image.Image]:
    """Alleen geslaagde downloads cachen - een tijdelijke storing mag niet
    voorgoed een logo-loos plaatje opleveren."""
    if url in _logo_cache:
        return _logo_cache[url]
    try:
        res = httpx.get(url, timeout=4, follow_redirects=True)
        res.raise_for_status()
        logo = Image.open(io.BytesIO(res.content)).convert("RGBA")
    except Exception:
        return None
    if len(_logo_cache) < 128:
        _logo_cache[url] = logo
    return logo


def _club_short(name: str) -> str:
    # "Alphen MO14-1" -> "Alphen": teamaanduiding is dubbel op een MO14-site
    return name.replace(" MO14-1", "").replace(" MO14", "").strip()


@lru_cache(maxsize=64)
def match_image_png(
    home_name: str, away_name: str, home_logo: Optional[str], away_logo: Optional[str], score: str, date: str,
) -> bytes:
    size = 800
    img = Image.new("RGB", (size, size), NAVY)
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, size, 24], fill=YELLOW)
    name_font = ImageFont.load_default(size=40)
    score_font = ImageFont.load_default(size=120)
    small = ImageFont.load_default(size=40)

    card, top = 280, 110
    for i, (name, logo_url) in enumerate(((home_name, home_logo), (away_name, away_logo))):
        left = 80 if i == 0 else size - 80 - card
        draw.rounded_rectangle([left, top, left + card, top + card], radius=28, fill=(255, 255, 255))
        logo = _fetch_logo(logo_url) if logo_url else None
        if logo:
            logo = logo.copy()
            logo.thumbnail((card - 40, card - 40), Image.LANCZOS)
            if logo.width < card - 40:  # kleine bron-logo's opschalen
                scale = (card - 40) / max(logo.width, logo.height)
                logo = logo.resize((int(logo.width * scale), int(logo.height * scale)), Image.LANCZOS)
            img.paste(logo, (left + (card - logo.width) // 2, top + (card - logo.height) // 2), logo)
        else:
            initial = _club_short(name)[:1].upper() or "?"
            w = draw.textlength(initial, font=score_font)
            draw.text((left + (card - w) / 2, top + 60), initial, font=score_font, fill=NAVY)
        short = _club_short(name)
        w = draw.textlength(short, font=name_font)
        draw.text((left + (card - w) / 2, top + card + 20), short, font=name_font, fill=(255, 255, 255))

    w = draw.textlength(score, font=score_font)
    draw.text(((size - w) / 2, 500), score, font=score_font, fill=YELLOW)
    if date:
        w = draw.textlength(date, font=small)
        draw.text(((size - w) / 2, 660), date, font=small, fill=(154, 165, 192))
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()
