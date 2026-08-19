"""Ghost — headless Playwright-worker die de Vanger cmd-queue leegwerkt zonder
dat er een Chrome-extensie/browser open hoeft te staan.

Draait continu in zijn eigen container en blijft idle totdat de backend een
run aanvraagt via GET /api/hockey/vanger/ghost/should-run (gezet door de
"Start Ghost"-knop in Vanger-tab). Praat verder met dezelfde endpoints als de
Scout (de Chrome-extensie): /vanger/cmd-queue/next, /vanger/cmd-queue/{id}/result
en /vanger/heartbeat — beide clients bedienen dezelfde queue.

Login gebeurt met env-var credentials (niet met een opgenomen recipe die het
wachtwoord in plaintext zou bevatten).

Lokaal draaien (los van Docker):
    cd plugins/ghost
    python -m pip install -r requirements.txt
    python -m playwright install chromium
    python ghost.py --once
Env-vars komen dan uit de root .env (via python-dotenv) of uit al geëxporteerde
shell-variabelen. Zet GHOST_API_BASE op het adres waar de backend voor jou
bereikbaar is (bv. http://localhost:8000 lokaal, of de acc-URL op afstand).
--once doet één sessie (inloggen + queue leegwerken) en sluit daarna af, i.p.v.
de continue idle-poll-loop die de container gebruikt.
"""

import os
import re
import sys
import random
import time
import traceback

import requests
import sentry_sdk
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv()  # no-op als er geen .env gevonden wordt (bv. in de container)

API_BASE = os.environ["GHOST_API_BASE"].rstrip("/")
API_KEY  = os.environ["GHOST_API_KEY"]
EMAIL    = os.environ["HOCKEY_EMAIL"]
PASSWORD = os.environ["HOCKEY_PASSWORD"]

# Zelfde SENTRY_DSN/ENVIRONMENT als de rest van het platform (root .env) —
# geen apart secret nodig. Alleen crash-level fouten (login stuk, hoofdloop
# stukgelopen); routinematige cmd-fouten gaan naar het bestaande
# plugin-error-paneel (zelfde plek als de Scout-extensie al gebruikt).
if os.environ.get("SENTRY_DSN"):
    sentry_sdk.init(
        dsn=os.environ["SENTRY_DSN"],
        environment=os.environ.get("ENVIRONMENT", "production"),
    )
    sentry_sdk.set_tag("component", "ghost")

POLL_IDLE_SEC    = int(os.environ.get("GHOST_POLL_IDLE_SEC", "15"))
CMD_DELAY_MIN    = int(os.environ.get("GHOST_CMD_DELAY_MIN", "10"))
CMD_DELAY_MAX    = int(os.environ.get("GHOST_CMD_DELAY_MAX", "15"))
MAX_CMDS_PER_RUN = int(os.environ.get("GHOST_MAX_CMDS_PER_RUN", "200"))

HEADERS = {"Authorization": f"Bearer {API_KEY}"}
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)

# Zelfde regex-detectie als plugins/chrome/hockey-vanger/interceptor.js
POULE_RE       = re.compile(r"/poules/(\d+)/teams/(\d+)")
CLUB_DETAIL_RE = re.compile(r"/clubs/([A-Za-z0-9]+)(?:/|$)")
COMP_RE        = re.compile(r"/competitions/national/(\d+)")
TARGET_HOST    = "app.hockeyweerelt.nl"

# Zelfde hash-navigatie als plugins/chrome/hockey-vanger/popup.js executeCmd()
HASH_BY_CMD = {
    "get_poule":              lambda p: f"/team/{p['team_id']}|{p['poule_id']}/standings",
    "scan_club":              lambda p: f"/club/{p['external_id']}/field-teams",
    "get_clubs":              lambda p: "/search/clubs",
    "get_competition_detail": lambda p: f"/competitions/{p['comp_id']}",
    "get_competitions":       lambda p: "/search/competition",
}


def api_get(path):
    r = requests.get(f"{API_BASE}{path}", headers=HEADERS, timeout=15)
    r.raise_for_status()
    return r.json()


def api_post(path, body):
    r = requests.post(f"{API_BASE}{path}", headers=HEADERS, json=body, timeout=15)
    r.raise_for_status()
    return r.json()


def send_heartbeat(running, mode=None, task=None, done_count=0, queue_total=0):
    try:
        api_post("/api/hockey/vanger/heartbeat", {
            "running": running, "mode": mode, "task": task,
            "done_count": done_count, "queue_total": queue_total,
            "client": "ghost",
        })
    except Exception:
        pass


def report_plugin_error(message, context=None, session_id=None):
    """Zelfde in-app foutenpaneel als de Scout-extensie gebruikt (POST
    /api/hockey/plugin-error) — zichtbaar in de Vanger-tab, niet Bugsink."""
    try:
        api_post("/api/hockey/plugin-error", {
            "message": message, "context": context, "session_id": session_id,
        })
    except Exception:
        pass


def dismiss_consent(page):
    # Usercentrics-cookiebanner verschijnt bij elke fresh-session load opnieuw
    # en blokkeert clicks eronder — zie plugins/playwright/play.js voor de
    # eerder gevonden JS-variant van dezelfde fix.
    try:
        page.get_by_role("button", name="Accepteer alles").click(timeout=2500)
    except Exception:
        pass


def dom_shows_login_button(page):
    try:
        return "Inloggen" in page.inner_text("body")
    except Exception:
        return None


def login(page) -> bool:
    page.goto("https://www.hockey.nl/", wait_until="domcontentloaded", timeout=20000)
    page.wait_for_timeout(1500)
    dismiss_consent(page)

    with page.expect_navigation(wait_until="domcontentloaded", timeout=15000):
        page.get_by_text("Inloggen", exact=False).first.click(timeout=5000)
    dismiss_consent(page)

    page.locator('[name="email"]').first.fill(EMAIL, timeout=5000)
    with page.expect_navigation(wait_until="domcontentloaded", timeout=15000):
        page.get_by_text("Verder", exact=False).first.click(timeout=5000)
    dismiss_consent(page)

    page.locator('[name="password"]').first.fill(PASSWORD, timeout=5000)
    with page.expect_navigation(wait_until="domcontentloaded", timeout=15000):
        page.get_by_text("Inloggen", exact=False).first.click(timeout=5000)
    page.wait_for_timeout(1500)
    dismiss_consent(page)

    # Terugkeer na de OAuth-redirect kan nog een volledige reload triggeren,
    # die de cookiebanner opnieuw kan tonen.
    page.wait_for_timeout(1500)
    dismiss_consent(page)

    return dom_shows_login_button(page) is False


def capture_for_cmd(page, cmd_type):
    """Registreert een response-listener; gevuld door de listener zodra een
    matchende app.hockeyweerelt.nl-call voorbijkomt."""
    captured = {}

    def on_response(response):
        try:
            url = response.url
            if TARGET_HOST not in url:
                return
            if cmd_type == "get_poule" and POULE_RE.search(url):
                captured["data"] = response.json()
            elif cmd_type == "scan_club" and CLUB_DETAIL_RE.search(url):
                body = response.json()
                if body and body.get("data") and not isinstance(body["data"], list):
                    captured["data"] = body
            elif cmd_type == "get_competition_detail" and COMP_RE.search(url):
                captured["data"] = response.json()
            elif cmd_type in ("get_clubs", "get_competitions"):
                body = response.json()
                if isinstance(body, dict) and isinstance(body.get("data"), list) and body["data"]:
                    captured["data"] = body
        except Exception:
            pass

    page.on("response", on_response)
    return captured


def process_cmd(page, cmd):
    cmd_type = cmd["cmd_type"]
    params   = cmd["params"]
    hash_fn  = HASH_BY_CMD.get(cmd_type)
    if not hash_fn:
        return None, f"Onbekend cmd_type: {cmd_type}"
    if cmd_type == "get_poule" and not params.get("team_id"):
        return None, "team_id ontbreekt"

    captured = capture_for_cmd(page, cmd_type)
    target_hash = hash_fn(params)
    page.evaluate("h => { window.location.hash = h }", target_hash)
    page.wait_for_timeout(400)
    page.reload(wait_until="domcontentloaded", timeout=20000)
    dismiss_consent(page)

    delay = random.randint(CMD_DELAY_MIN, CMD_DELAY_MAX)
    page.wait_for_timeout(delay * 1000)

    if "data" in captured:
        return captured["data"], None
    return None, "geen data opgevangen (timeout of onbekende response-vorm)"


def run_once():
    """Eén sessie: inloggen, queue leegwerken tot leeg/limiet, afsluiten."""
    session_id = f"ghost_{int(time.time())}"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=USER_AGENT)
        page = context.new_page()

        send_heartbeat(True, mode="ghost_login", task="Inloggen op hockey.nl")
        try:
            logged_in = login(page)
        except Exception as exc:
            print(f"[GHOST] login-fout: {exc}", flush=True)
            traceback.print_exc()
            sentry_sdk.capture_exception(exc)
            report_plugin_error(f"Ghost login-fout: {exc}", context="ghost:login", session_id=session_id)
            logged_in = False
        else:
            if not logged_in:
                report_plugin_error("Ghost login mislukt (Inloggen-knop nog zichtbaar na loginflow)",
                                     context="ghost:login", session_id=session_id)

        if not logged_in:
            send_heartbeat(False, mode="ghost_login_failed", task="Login mislukt")
            browser.close()
            return

        done_count = 0
        while done_count < MAX_CMDS_PER_RUN:
            nxt = api_get("/api/hockey/vanger/cmd-queue/next")
            if nxt.get("done"):
                break

            cmd_id = nxt["id"]
            label = nxt["params"].get("label") or nxt["params"].get("external_id") or ""
            send_heartbeat(True, mode="ghost_run", task=f"{nxt['cmd_type']} · {label}", done_count=done_count)
            print(f"[GHOST] cmd {cmd_id}: {nxt['cmd_type']} · {label}", flush=True)

            try:
                data, error = process_cmd(page, nxt)
            except Exception as exc:
                data, error = None, f"{type(exc).__name__}: {exc}"
                sentry_sdk.capture_exception(exc)
                report_plugin_error(f"Ghost cmd {cmd_id} ({nxt['cmd_type']}) crashte: {exc}",
                                     context="ghost:cmd", session_id=session_id)

            try:
                if error:
                    api_post(f"/api/hockey/vanger/cmd-queue/{cmd_id}/result", {"error": error})
                    print(f"[GHOST] cmd {cmd_id} mislukt: {error}", flush=True)
                else:
                    api_post(f"/api/hockey/vanger/cmd-queue/{cmd_id}/result", {"raw": data})
                    print(f"[GHOST] cmd {cmd_id} klaar", flush=True)
            except Exception as exc:
                print(f"[GHOST] kon resultaat niet posten voor cmd {cmd_id}: {exc}", flush=True)

            done_count += 1

        send_heartbeat(False)
        browser.close()
        print(f"[GHOST] sessie klaar — {done_count} cmd(s) verwerkt.", flush=True)


def main():
    if "--once" in sys.argv:
        print("[GHOST] --once: één sessie starten zonder op een trigger te wachten...", flush=True)
        run_once()
        return

    print("[GHOST] gestart, wacht op trigger...", flush=True)
    while True:
        try:
            resp = api_get("/api/hockey/vanger/ghost/should-run")
            if resp.get("should_run"):
                print("[GHOST] trigger ontvangen, sessie starten...", flush=True)
                run_once()
        except Exception as exc:
            traceback.print_exc()
            sentry_sdk.capture_exception(exc)
        time.sleep(POLL_IDLE_SEC)


if __name__ == "__main__":
    main()
