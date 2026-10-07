"""Bezoekers-tray: klein icoon in de Windows system tray met de bezoekers van
het homeplatform, met de nadruk op MO14 a Paris (yearof-mo14).

Bronnen (prod-API, zelfde config als roadmap.ps1 in .roadmap.config.ps1):
- /api/yearof-mo14/link-overview  bezoeken per deelbare link (beheerders niet meegeteld)
- /api/yearof-mo14/visits/recent  laatste bezoeken: welke link en wie (ingelogd/onbekend)
- /api/admin/site-stats           pageviews per site (vereist admin-rechten)

Optioneel $HP_TRAY_API_KEY in .roadmap.config.ps1 voor een key met admin-rechten;
anders wordt $HP_API_KEY gebruikt.

Starten: .venv\\Scripts\\pythonw.exe tools\\visitor_tray\\visitor_tray.py
"""

import json
import re
import threading
import urllib.error
import urllib.request
import webbrowser
from datetime import datetime, timezone
from pathlib import Path

import pystray
from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path(__file__).resolve().parents[2]
CONFIG_FILE = REPO_ROOT / ".roadmap.config.ps1"
POLL_SECONDS = 60
MO14_URL = "https://webheaven.nl/yearof-mo14/"
ADMIN_URL = "https://webheaven.nl/admin/site-monitoring"
LINK_KINDS = ("site", "match", "player", "contribute", "profile")
KIND_LABELS = {"site": "Sitelink", "match": "Wedstrijd", "player": "Speelster", "contribute": "Invullink", "profile": "Profiel"}

WHO_LABELS = {"user": "ingelogd", "excluded": "beheer", "unknown": "onbekend"}

COLOR_IDLE = (120, 120, 130)
COLOR_ACTIVE = (30, 90, 200)
COLOR_NEW = (30, 160, 80)
COLOR_ERROR = (200, 50, 50)


def load_config() -> tuple[str, str]:
    text = CONFIG_FILE.read_text(encoding="utf-8-sig")
    values = dict(re.findall(r'^\s*\$(\w+)\s*=\s*"([^"]*)"', text, re.MULTILINE))
    return values["HP_API_BASE"].rstrip("/"), values.get("HP_TRAY_API_KEY") or values["HP_API_KEY"]


def api_get(base: str, key: str, path: str):
    req = urllib.request.Request(base + path, headers={"Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def local_time(iso: str) -> str:
    """visited_at is naive UTC; toon in lokale tijd."""
    dt = datetime.fromisoformat(iso).replace(tzinfo=timezone.utc).astimezone()
    if dt.date() == datetime.now().date():
        return dt.strftime("%H:%M")
    return dt.strftime("%d-%m %H:%M")


def describe_visit(v: dict) -> str:
    """Bijv. 'onbekend (nieuw) - Wedstrijd: HDM - MO14-1'."""
    if v["who"] == "user":
        who = v["username"] or "ingelogd"
    else:
        who = f"{WHO_LABELS[v['who']]} {v['visitor']}" + (" (nieuw)" if v["new_visitor"] else "")
    label = KIND_LABELS.get(v["kind"], v["kind"]) + ("" if v["kind"] == "site" else f": {v['label']}")
    return f"{who} - {label}"


def summarize_mo14(overview: dict) -> dict:
    """Vandaag-cijfers (UTC-dag, zoals de backend telt) en per-link opens voor de diff."""
    today = datetime.now(timezone.utc).date().isoformat()
    links, today_opens, today_unique_sum = [], 0, 0
    last = None
    for kind in LINK_KINDS:
        for row in overview.get(kind, []):
            day = next((d for d in row["days"] if d["date"] == today), None)
            opens_today = day["opens"] if day else 0
            today_opens += opens_today
            today_unique_sum += day["unique"] if day else 0
            label = f"{KIND_LABELS[kind]}: {row['label']}"
            links.append({"key": (kind, row["code"]), "label": label, "opens": row["opens"],
                          "unique": row["unique"], "today": opens_today})
            if row["last_visit"] and (last is None or row["last_visit"] > last[0]):
                last = (row["last_visit"], label)
    return {
        "totals": overview["totals"]["all"],
        "by_kind": {k: overview["totals"][k] for k in LINK_KINDS},
        "today_opens": today_opens,
        # Som per link: een apparaat dat 2 links opent telt 2x - de backend geeft
        # geen ontdubbeld vandaag-totaal, dus dit is een bovengrens.
        "today_unique_max": today_unique_sum,
        "links": links,
        "last": last,
    }


class VisitorTray:
    def __init__(self):
        self.base, self.key = load_config()
        self.mo14: dict | None = None
        self.sites: dict | None = None
        self.sites_error: str | None = None
        self.recent: list | None = None
        self.recent_error: str | None = None
        self._last_seen_visit: str | None = None
        self.error: str | None = None
        self.updated_at: datetime | None = None
        self.new_since_open = 0
        self.notify_enabled = True
        self._prev_opens: dict | None = None
        self._stop = threading.Event()
        self._wake = threading.Event()
        self.icon = pystray.Icon("hp-visitors", self._render_icon("…", COLOR_IDLE), "HomePlatform bezoekers",
                                 menu=pystray.Menu(self._menu_items))

    # ── data ────────────────────────────────────────────────────────────────

    def refresh(self):
        try:
            mo14 = summarize_mo14(api_get(self.base, self.key, "/yearof-mo14/link-overview"))
            self.error = None
        except (urllib.error.URLError, OSError, ValueError, KeyError) as exc:
            self.error = str(getattr(exc, "reason", exc))[:80]
            self._update_view()
            return

        try:
            self.sites = api_get(self.base, self.key, "/admin/site-stats")["sites"]
            self.sites_error = None
        except urllib.error.HTTPError as exc:
            self.sites, self.sites_error = None, "geen admin-rechten" if exc.code == 403 else f"HTTP {exc.code}"
        except (urllib.error.URLError, OSError, ValueError) as exc:
            self.sites, self.sites_error = None, str(exc)[:60]

        try:
            self.recent = api_get(self.base, self.key, "/yearof-mo14/visits/recent?limit=40")
            self.recent_error = None
        except urllib.error.HTTPError as exc:
            self.recent, self.recent_error = None, "nog niet gedeployed" if exc.code in (404, 405) else f"HTTP {exc.code}"
        except (urllib.error.URLError, OSError, ValueError) as exc:
            self.recent, self.recent_error = None, str(exc)[:60]

        current = {link["key"]: link["opens"] for link in mo14["links"]}
        if self.recent is not None:
            self._notify_recent()
        elif self._prev_opens is not None:
            new = [(link["label"], current[link["key"]] - self._prev_opens.get(link["key"], 0))
                   for link in mo14["links"] if current[link["key"]] > self._prev_opens.get(link["key"], 0)]
            if new:
                self.new_since_open += sum(n for _, n in new)
                if self.notify_enabled:
                    lines = [f"{n}x {label}" for label, n in sorted(new, key=lambda x: -x[1])[:4]]
                    self.icon.notify("\n".join(lines), f"MO14: {sum(n for _, n in new)} nieuw bezoek")
        self._prev_opens = current
        self.mo14 = mo14
        self.updated_at = datetime.now()
        self._update_view()

    def _notify_recent(self):
        """Melding per nieuw bezoek met wie en via welke link; beheer-bezoeken niet."""
        newest = self.recent[0]["visited_at"] if self.recent else None
        if self._last_seen_visit is not None:
            new = [v for v in self.recent if v["visited_at"] > self._last_seen_visit and v["who"] != "excluded"]
            if new:
                self.new_since_open += len(new)
                if self.notify_enabled:
                    lines = [describe_visit(v)[:60] for v in new[:4]] + ([f"... en {len(new) - 4} meer"] if len(new) > 4 else [])
                    self.icon.notify("\n".join(lines), f"MO14: {len(new)} nieuw bezoek")
        if newest and (self._last_seen_visit is None or newest > self._last_seen_visit):
            self._last_seen_visit = newest

    def _poll_loop(self):
        while not self._stop.is_set():
            self.refresh()
            self._wake.wait(POLL_SECONDS)
            self._wake.clear()

    # ── weergave ────────────────────────────────────────────────────────────

    @staticmethod
    def _render_icon(text: str, color) -> Image.Image:
        img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        draw.ellipse((2, 2, 62, 62), fill=color)
        try:
            font = ImageFont.truetype("arialbd.ttf", 34 if len(text) <= 2 else 24)
        except OSError:
            font = ImageFont.load_default()
        draw.text((32, 33), text, fill="white", font=font, anchor="mm")
        return img

    def _update_view(self):
        if self.error:
            self.icon.icon = self._render_icon("!", COLOR_ERROR)
            self.icon.title = f"HomePlatform bezoekers - fout: {self.error}"
        elif self.mo14:
            count = self.mo14["today_opens"]
            color = COLOR_NEW if self.new_since_open else (COLOR_ACTIVE if count else COLOR_IDLE)
            self.icon.icon = self._render_icon(str(count) if count < 100 else "99+", color)
            t = self.mo14["totals"]
            self.icon.title = (f"MO14 a Paris - vandaag {count} opens\n"
                               f"Totaal {t['opens']} opens / {t['unique']} uniek")[:127]
        self.icon.update_menu()

    def _menu_items(self):
        Item, Menu = pystray.MenuItem, pystray.Menu
        items = []
        if self.error:
            items.append(Item(f"Fout: {self.error}", None, enabled=False))
        if self.mo14:
            m, t = self.mo14, self.mo14["totals"]
            items += [
                Item("MO14 a Paris", lambda: webbrowser.open(MO14_URL), default=True),
                Item(f"   Vandaag: {m['today_opens']} opens (max {m['today_unique_max']} uniek)", None, enabled=False),
                Item(f"   Totaal: {t['opens']} opens, {t['unique']} uniek  (+{t['admin_opens']} beheer)", None, enabled=False),
            ]
            if m["last"]:
                items.append(Item(f"   Laatste: {local_time(m['last'][0])} - {m['last'][1]}"[:90], None, enabled=False))
            if self.new_since_open:
                items.append(Item(f"   {self.new_since_open} nieuw sinds bekeken - markeer gelezen", self._mark_seen))
            items.append(Item("   Laatste bezoeken", Menu(*self._recent_items())))
            items.append(Item("   Per soort", Menu(*[
                Item(f"{KIND_LABELS[k]}: {v['opens']} opens, {v['unique']} uniek", None, enabled=False)
                for k, v in m["by_kind"].items() if v["opens"] or v["admin_opens"]
            ])))
            top_today = sorted((link for link in m["links"] if link["today"]), key=lambda x: -x["today"])[:10]
            top_all = sorted((link for link in m["links"] if link["opens"]), key=lambda x: -x["opens"])[:10]
            items.append(Item("   Top links vandaag", Menu(*(
                [Item(f"{link['today']}x  {link['label']}"[:80], None, enabled=False) for link in top_today]
                or [Item("nog geen bezoeken vandaag", None, enabled=False)]))))
            items.append(Item("   Top links totaal", Menu(*(
                [Item(f"{link['opens']}x ({link['unique']} uniek)  {link['label']}"[:80], None, enabled=False)
                 for link in top_all] or [Item("nog geen bezoeken", None, enabled=False)]))))
        items.append(Menu.SEPARATOR)
        items.append(Item("Platform vandaag", Menu(*self._site_items())))
        items.append(Menu.SEPARATOR)
        updated = self.updated_at.strftime("%H:%M:%S") if self.updated_at else "-"
        items += [
            Item(f"Ververs nu (laatst {updated})", lambda: self._wake.set()),
            Item("Meldingen", self._toggle_notify, checked=lambda _: self.notify_enabled),
            Item("Afsluiten", self._quit),
        ]
        return items

    def _recent_items(self):
        Item = pystray.MenuItem
        if self.recent_error:
            return [Item(f"Niet beschikbaar: {self.recent_error}", None, enabled=False)]
        if not self.recent:
            return [Item("Nog geen bezoeken", None, enabled=False)]
        return [Item(f"{local_time(v['visited_at'])}  {describe_visit(v)}"[:90], None, enabled=False)
                for v in self.recent[:25]]

    def _site_items(self):
        Item = pystray.MenuItem
        if self.sites_error:
            return [Item(f"Niet beschikbaar: {self.sites_error}", None, enabled=False)]
        if not self.sites:
            return [Item("Geen data", None, enabled=False)]
        rows = sorted(self.sites.items(), key=lambda kv: -kv[1]["today"]["page_views"])
        return [
            Item(f"{site}: {s['today']['page_views']} views, {s['today']['unique_visitors']} uniek"
                 f"  (7d: {s['week']['page_views']}/{s['week']['unique_visitors']})", None, enabled=False)
            for site, s in rows
        ] + [pystray.Menu.SEPARATOR, Item("Open site-monitoring", lambda: webbrowser.open(ADMIN_URL))]

    # ── acties ──────────────────────────────────────────────────────────────

    def _mark_seen(self):
        self.new_since_open = 0
        self._update_view()

    def _toggle_notify(self):
        self.notify_enabled = not self.notify_enabled
        self.icon.update_menu()

    def _quit(self):
        self._stop.set()
        self._wake.set()
        self.icon.stop()

    def run(self):
        def setup(icon):
            icon.visible = True
            threading.Thread(target=self._poll_loop, daemon=True).start()
        self.icon.run(setup)


if __name__ == "__main__":
    VisitorTray().run()
