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

from fastapi import Request
from PIL import Image, ImageDraw, ImageFont

from core.settings import settings

SITE_NAME = "MO14 à Paris"
DEFAULT_TITLE = "MO14 à Paris"
DEFAULT_DESCRIPTION = "Volg Victoria MO14-1 op weg naar Parijs: wedstrijden, foto's, interviews en de actie."
DEFAULT_IMAGE_PATH = "/api/yearof-mo14/og-default.png"

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
    """Standaardplaatje 1200x630 (formaat dat WhatsApp/Facebook verwachten),
    in de huisstijl van de site. Gegenereerd i.p.v. een los bestand, zodat er
    geen asset-pipeline nodig is; 1x per proces opgebouwd."""
    img = Image.new("RGB", (1200, 630), NAVY)
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, 24, 630], fill=YELLOW)
    title_font = ImageFont.load_default(size=110)
    sub_font = ImageFont.load_default(size=46)
    # Het ingebouwde lettertype heeft geen "à": gewone "a" + zelf getekend accent.
    x, y = 90, 200
    draw.text((x, y), "MO14 a Paris", font=title_font, fill=(255, 255, 255))
    a_left = x + draw.textlength("MO14 ", font=title_font)
    a_width = draw.textlength("a", font=title_font)
    a_top = draw.textbbox((x, y), "a", font=title_font)[1]
    draw.line([(a_left + a_width * 0.3, a_top - 34), (a_left + a_width * 0.6, a_top - 8)], fill=(255, 255, 255), width=9)
    draw.text((94, 350), "Victoria MO14-1 · op weg naar Parijs", font=sub_font, fill=YELLOW)
    draw.text((94, 420), "Pinksterweekend 2027", font=sub_font, fill=(154, 165, 192))
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()
