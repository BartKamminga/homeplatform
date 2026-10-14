"""MyHome-applier: voert goedgekeurde wijzigingen uit MyHome uit in Home Assistant en op de Hue-bridge (item 1320).

Draait in de HA Core-container via shell_command (zie myhome.yaml). Gebruik:
  python3 /config/myhome/myhome_apply.py <MyHome-huis-url> <hp_-key> [<HA long-lived token>]
    <MyHome-huis-url> = http(s)://<host>/api/myhome/homes/<home-id>
Zonder HA-token wordt de SUPERVISOR_TOKEN van de Core-container gebruikt via de Supervisor-proxy.

- rename_device: Hue-apparaat -> naam op de bridge (Hue-app klopt dan ook) en name_by_user in HA leeg;
                 overige apparaten -> name_by_user in de HA-device-registry.
- move_device:   area_id in de device-registry (ruimte wordt aangemaakt als die nog niet bestaat).
- rename_area:   naam van de HA-ruimte.
Elk resultaat gaat terug naar MyHome (applied/failed + toelichting).
"""
import asyncio
import json
import os
import ssl
import sys

import aiohttp


def hue_bridge():
    entries = json.load(open("/config/.storage/core.config_entries"))["data"]["entries"]
    hue = next(e for e in entries if e["domain"] == "hue")
    return hue["data"]["host"], hue["data"]["api_key"]


class HA:
    def __init__(self, session, token):
        self.session, self.token, self.n = session, token, 0

    async def __aenter__(self):
        url = "ws://127.0.0.1:8123/api/websocket" if self.token else "ws://supervisor/core/websocket"
        headers = {} if self.token else {"Authorization": f"Bearer {os.environ['SUPERVISOR_TOKEN']}"}
        self.ws = await self.session.ws_connect(url, headers=headers)
        await self.ws.receive_json()
        await self.ws.send_json({"type": "auth", "access_token": self.token or os.environ["SUPERVISOR_TOKEN"]})
        msg = await self.ws.receive_json()
        if msg.get("type") != "auth_ok":
            raise RuntimeError(f"HA auth failed: {msg}")
        return self

    async def __aexit__(self, *exc):
        await self.ws.close()

    async def call(self, msg):
        self.n += 1
        await self.ws.send_json({**msg, "id": self.n})
        while True:
            r = await self.ws.receive_json()
            if r.get("id") == self.n and r.get("type") == "result":
                if not r["success"]:
                    raise RuntimeError(r.get("error", {}).get("message", "unknown error"))
                return r.get("result")


async def area_id(ha, name, create=False):
    areas = await ha.call({"type": "config/area_registry/list"})
    for a in areas:
        if a["name"].lower() == (name or "").lower():
            return a["area_id"]
    if not create:
        raise RuntimeError(f"HA area not found: {name}")
    return (await ha.call({"type": "config/area_registry/create", "name": name}))["area_id"]


async def apply(job, ha, http):
    p = job["payload"]
    if job["kind"] == "rename_device":
        if p.get("hue_device_id"):
            host, key = hue_bridge()
            ctx = ssl.create_default_context()
            ctx.check_hostname, ctx.verify_mode = False, ssl.CERT_NONE
            async with http.put(f"https://{host}/clip/v2/resource/device/{p['hue_device_id']}",
                                headers={"hue-application-key": key}, ssl=ctx,
                                json={"metadata": {"name": p["to"]}}) as r:
                body = await r.json(content_type=None)
                if r.status >= 300 or body.get("errors"):
                    raise RuntimeError(f"Hue bridge: {r.status} {body.get('errors')}")
            await ha.call({"type": "config/device_registry/update", "device_id": p["ha_device_id"], "name_by_user": None})
            return f"renamed on the Hue bridge to {p['to']}"
        await ha.call({"type": "config/device_registry/update", "device_id": p["ha_device_id"], "name_by_user": p["to"]})
        return f"renamed in HA to {p['to']}"
    if job["kind"] == "move_device":
        aid = await area_id(ha, p["to"], create=True)
        await ha.call({"type": "config/device_registry/update", "device_id": p["ha_device_id"], "area_id": aid})
        return f"moved to HA area {p['to']}"
    if job["kind"] == "rename_area":
        aid = await area_id(ha, p["from"])
        await ha.call({"type": "config/area_registry/update", "area_id": aid, "name": p["to"]})
        return f"HA area renamed to {p['to']}"
    raise RuntimeError(f"unknown change {job['kind']}")


async def main():
    base, key = sys.argv[1].rstrip("/"), sys.argv[2]
    token = sys.argv[3] if len(sys.argv) > 3 else None
    auth = {"Authorization": f"Bearer {key}"}
    async with aiohttp.ClientSession() as http:
        async with http.get(f"{base}/push", params={"status": "pending"}, headers=auth) as r:
            r.raise_for_status()
            jobs = list(reversed(await r.json()))      # oudste eerst
        if not jobs:
            print(json.dumps({"applied": 0, "failed": 0}))
            return
        done = failed = 0
        async with HA(http, token) as ha:
            for job in jobs:
                try:
                    result, status = await apply(job, ha, http), "applied"
                    done += 1
                except Exception as e:      # per wijziging rapporteren, de rest gaat door
                    result, status = str(e)[:300], "failed"
                    failed += 1
                root = base.split("/homes/")[0]
                async with http.post(f"{root}/push/{job['id']}/result", headers=auth,
                                     json={"status": status, "result": result}) as r:
                    r.raise_for_status()
        print(json.dumps({"applied": done, "failed": failed}))


asyncio.run(main())
