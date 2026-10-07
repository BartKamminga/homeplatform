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

import logging
import os
import sys
import threading
import urllib.error
import webbrowser
from datetime import datetime
from pathlib import Path

import pystray
from PIL import Image, ImageDraw, ImageFont

from mo14_data import KIND_LABELS, POLL_SECONDS, api_get, describe_visit, load_config, local_time, summarize_mo14

REPO_ROOT = Path(__file__).resolve().parents[2]
# pythonw heeft geen console: fouten gaan anders stil verloren.
LOG_FILE = Path(os.environ.get("LOCALAPPDATA", REPO_ROOT)) / "hp-visitor-tray.log"
MO14_URL = "https://webheaven.nl/yearof-mo14/"
ADMIN_URL = "https://webheaven.nl/admin/site-monitoring"
COLOR_IDLE = (120, 120, 130)
COLOR_ACTIVE = (30, 90, 200)
COLOR_NEW = (30, 160, 80)
COLOR_ERROR = (200, 50, 50)


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
        self.icon = pystray.Icon("hp-visitors", self._render_icon("â€¦", COLOR_IDLE), "HomePlatform bezoekers",
                                 menu=pystray.Menu(self._menu_items))

    # â”€â”€ data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            try:
                self.refresh()
            except Exception as exc:  # noqa: BLE001 - poll-thread mag nooit stoppen
                logging.exception("refresh mislukt")
                self.error = f"intern: {exc}"[:80]
                try:
                    self._update_view()
                except Exception:  # noqa: BLE001
                    logging.exception("update_view mislukt")
            self._wake.wait(POLL_SECONDS)
            self._wake.clear()

    # â”€â”€ weergave â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    # â”€â”€ acties â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def _mark_seen(self):
        self.new_since_open = 0
        self._update_view()

    def _toggle_notify(self):
        self.notify_enabled = not self.notify_enabled
        self.icon.update_menu()

    def _quit(self):
        logging.info("afgesloten via menu")
        self._stop.set()
        self._wake.set()
        self.icon.stop()

    def run(self):
        def setup(icon):
            icon.visible = True
            threading.Thread(target=self._poll_loop, daemon=True).start()
        self.icon.run(setup)


if __name__ == "__main__":
    logging.basicConfig(filename=LOG_FILE, level=logging.INFO, encoding="utf-8",
                        format="%(asctime)s %(levelname)s %(threadName)s %(message)s")
    sys.excepthook = lambda *exc: logging.critical("onverwachte fout", exc_info=exc)
    threading.excepthook = lambda a: logging.critical("fout in thread %s", a.thread, exc_info=(a.exc_type, a.exc_value, a.exc_traceback))
    logging.info("gestart (pid %s)", os.getpid())
    try:
        VisitorTray().run()
    finally:
        logging.info("gestopt")
