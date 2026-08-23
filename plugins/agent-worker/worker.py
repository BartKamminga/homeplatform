"""Agent worker — generieke poll-loop, gedeeld door alle smart agents (hockey

scan-agent nu, straks fiets/poulebord). Eén proces, één container, geen
losse worker per functie: elke cyclus vraagt de worker homeplatform welke
agents er bestaan en welke daarvan aanstaan, en verwerkt ze om de beurt.

Per agent: context ophalen -> laten analyseren -> het complete resultaat in
1x terugposten (zelfde patroon als Ghost/Vanger: de worker/LLM roept zelf
geen losse endpoints aan, de backend verwerkt het resultaat). Alle
agent-specifieke logica (welke data relevant is, wat cmds betekenen) zit in
de backend (/agents/{key}/context en /agents/{key}/result), niet hier.

Testmodus: zonder ANTHROPIC_API_KEY (of met TEST_MODE=1) wordt Anthropic
niet aangeroepen — er gaat een vast testbericht terug, zodat de hele
plumbing (context ophalen, resultaat posten, taken afhandelen, archief/log)
te verifiëren is vóórdat er een echte API-key is.

Lokaal draaien (los van Docker), zelfde stijl als plugins/ghost/ghost.py:
    cd plugins/agent-worker
    python -m pip install -r requirements.txt
    python worker.py --once
"""

import json
import os
import sys
import time
import traceback
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

load_dotenv()  # no-op als er geen .env gevonden wordt (bv. in de container)

API_BASE   = os.environ["AGENT_API_BASE"].rstrip("/")
API_KEY    = os.environ["AGENT_API_KEY"]
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
TEST_MODE  = os.environ.get("TEST_MODE", "").lower() in ("1", "true", "yes") or not ANTHROPIC_API_KEY

POLL_IDLE_SEC = int(os.environ.get("WORKER_POLL_IDLE_SEC", "300"))

HEADERS = {"Authorization": f"Bearer {API_KEY}"}


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def api_get(path, params=None):
    r = requests.get(f"{API_BASE}{path}", headers=HEADERS, params=params, timeout=20)
    r.raise_for_status()
    return r.json()


def api_post(path, body):
    r = requests.post(f"{API_BASE}{path}", headers=HEADERS, json=body, timeout=20)
    r.raise_for_status()
    return r.json()


def send_heartbeat(agent_key, running, task=None, state=None):
    try:
        api_post(f"/api/agent-control/agents/{agent_key}/heartbeat", {
            "running": running, "task": task, "state": state,
        })
    except Exception as exc:
        print(f"[WORKER] heartbeat mislukt voor {agent_key}: {exc}", flush=True)


def build_test_response(context):
    """Vast, deterministisch testbericht — geen Anthropic-call. Bewijst dat de
    hele ronde (context -> analyse -> resultaat -> archief) werkt."""
    n_tasks = len(context.get("pending_tasks", []))
    knowledge_len = len(context.get("knowledge") or "")
    reasoning = (
        f"TESTMODUS (geen Anthropic-call): context ontvangen met "
        f"{knowledge_len} tekens eerdere kennis en {n_tasks} openstaande taak/taken. "
        f"agent_state: {json.dumps(context.get('agent_state', {}), ensure_ascii=False)}."
    )
    notes = (
        f"Laatste testrun op {_now_iso()}. Dit is nog geen echte analyse — "
        f"zodra ANTHROPIC_API_KEY is ingesteld voert de worker een echte "
        f"Messages API-call uit i.p.v. dit vaste bericht."
    )
    return {
        "reasoning": reasoning,
        "notes": notes,
        "notification": "Testrun voltooid — plumbing werkt, nog geen echte analyse.",
        "cmds": [],
    }


def call_claude(agent_key, context):
    """Echte analyse via de gewone Anthropic Messages API (geen Managed Agents -
    zie roadmap-item 888). Verwacht een JSON-object terug conform hetzelfde
    schema als build_test_response()."""
    import anthropic

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    system_prompt = (
        f"Je bent de HomePlatform smart agent '{agent_key}'. Je krijgt de "
        "huidige context (eerder opgebouwde kennis, openstaande ad-hoc taken, "
        "en een agent-specifieke stand van zaken). Bepaal welke actie nodig is "
        "en antwoord ALLEEN met een JSON-object met de velden: "
        "reasoning (str), notes (str, je bijgewerkte kennis), "
        "notification (str of null), cmds (lijst van {cmd_type, params})."
    )
    message = client.messages.create(
        model="claude-sonnet-5",
        max_tokens=2000,
        system=system_prompt,
        messages=[{"role": "user", "content": json.dumps(context, ensure_ascii=False)}],
    )
    text = "".join(block.text for block in message.content if block.type == "text")
    return json.loads(text)


def process_agent(agent_key):
    send_heartbeat(agent_key, True, task="Context ophalen")
    context = api_get(f"/api/agent-control/agents/{agent_key}/context")
    print(f"[WORKER] {agent_key}: context opgehaald: {json.dumps(context, ensure_ascii=False)[:300]}", flush=True)

    send_heartbeat(agent_key, True, task="Analyseren" + (" (testmodus)" if TEST_MODE else ""))
    try:
        result = build_test_response(context) if TEST_MODE else call_claude(agent_key, context)
    except Exception as exc:
        traceback.print_exc()
        send_heartbeat(agent_key, False, state=f"analyse mislukt: {exc}")
        return

    send_heartbeat(agent_key, True, task="Resultaat versturen")
    posted = api_post(f"/api/agent-control/agents/{agent_key}/result", result)
    print(f"[WORKER] {agent_key}: resultaat gepost: {json.dumps(posted, ensure_ascii=False)}", flush=True)

    for task in context.get("pending_tasks", []):
        try:
            api_post(f"/api/agent-control/tasks/{task['id']}/result", {"result": "Verwerkt in deze run."})
        except Exception as exc:
            print(f"[WORKER] {agent_key}: kon taak {task['id']} niet afronden: {exc}", flush=True)

    send_heartbeat(agent_key, False, state="klaar")


def run_once():
    agents = api_get("/api/agent-control/agents")
    enabled = [a["agent_key"] for a in agents if a.get("enabled", True)]
    if not enabled:
        print("[WORKER] geen ingeschakelde agents, niets te doen", flush=True)
        return
    for agent_key in enabled:
        try:
            process_agent(agent_key)
        except Exception as exc:
            traceback.print_exc()
            send_heartbeat(agent_key, False, state=f"fout: {exc}")


def main():
    if "--once" in sys.argv:
        print(f"[WORKER] --once: enkele ronde langs alle ingeschakelde agents (test_mode={TEST_MODE})", flush=True)
        run_once()
        return

    print(f"[WORKER] gestart (test_mode={TEST_MODE}), poll elke {POLL_IDLE_SEC}s", flush=True)
    while True:
        try:
            run_once()
        except Exception as exc:
            traceback.print_exc()
            print(f"[WORKER] ronde mislukt, probeer over {POLL_IDLE_SEC}s opnieuw: {exc}", flush=True)
        time.sleep(POLL_IDLE_SEC)


if __name__ == "__main__":
    main()
