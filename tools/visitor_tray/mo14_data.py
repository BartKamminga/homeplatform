"""Data-laag van de bezoekers-tray: config lezen, prod-API aanroepen en de
MO14-bezoekcijfers samenvatten (los van de pystray-UI)."""

import json
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
CONFIG_FILE = REPO_ROOT / ".roadmap.config.ps1"
POLL_SECONDS = 60
LINK_KINDS = ("site", "match", "player", "contribute", "profile")
KIND_LABELS = {"site": "Sitelink", "match": "Wedstrijd", "player": "Speelster", "contribute": "Invullink", "profile": "Profiel"}

WHO_LABELS = {"user": "ingelogd", "excluded": "beheer", "unknown": "onbekend"}



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
