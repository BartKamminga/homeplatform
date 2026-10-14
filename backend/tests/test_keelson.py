"""Keelson (item 1340): catalog consistency, HomePlatform seed, systems, elements, links and checks."""
from models.changelog import ChangelogEntry
from models.core import RoadmapItem
from services.keelson import seed_keelson
from services.keelson_catalog import DIMENSION_KEYS, KIND_BY_KEY, check_templates
from services.keelson_catalog_relations import RELATIONS
from services.keelson_seed_data import PLATFORM_ELEMENTS, SYSTEMS


def _h(token):
    return {"Authorization": f"Bearer {token}"}


def test_catalog_is_consistent():
    assert all(k["dimension"] in DIMENSION_KEYS for k in KIND_BY_KEY.values())
    assert all(r["from"] in KIND_BY_KEY and r["to"] in KIND_BY_KEY for r in RELATIONS)
    assert all(kind in KIND_BY_KEY for _, kind, *_ in PLATFORM_ELEMENTS)
    keys = [t["key"] for t in check_templates()]
    assert len(keys) == len(set(keys))
    assert {"people", "finance"} <= DIMENSION_KEYS


def test_seed_is_idempotent_and_keeps_edits(client, admin_token, session):
    seed_keelson(session)
    systems = client.get("/api/keelson/systems", headers=_h(admin_token)).json()
    assert len(systems) == len(SYSTEMS)
    assert systems[0]["key"] == "platform"
    platform = client.get(f"/api/keelson/systems/{systems[0]['id']}", headers=_h(admin_token)).json()
    assert platform["element_count"] == len(PLATFORM_ELEMENTS)
    assert platform["checks_done"] > 0 and platform["checks_total"] == len(check_templates())

    host = next(e for e in platform["elements"] if e["key"] == "host-g5")
    client.patch(f"/api/keelson/elements/{host['id']}", json={"name": "g5 (prod)"}, headers=_h(admin_token))
    seed_keelson(session)
    again = client.get(f"/api/keelson/systems/{systems[0]['id']}", headers=_h(admin_token)).json()
    assert again["element_count"] == len(PLATFORM_ELEMENTS)
    assert next(e for e in again["elements"] if e["key"] == "host-g5")["name"] == "g5 (prod)"
    assert len(again["links"]) == len(platform["links"])


def test_live_figures_come_from_roadmap_and_changelog(client, admin_token, session):
    seed_keelson(session)
    session.add(RoadmapItem(title="A", site="myhome", status="done"))
    session.add(RoadmapItem(title="B", site="myhome", status="idea"))
    session.add(ChangelogEntry(version="6.0.1", site="myhome", title="Fix"))
    session.commit()
    myhome = next(s for s in client.get("/api/keelson/systems", headers=_h(admin_token)).json() if s["key"] == "myhome")
    data = client.get(f"/api/keelson/systems/{myhome['id']}", headers=_h(admin_token)).json()
    assert data["live"]["roadmap"] == {"total": 2, "open": 1, "by_status": {"done": 1, "idea": 1}}
    assert data["live"]["releases"][0]["version"] == "6.0.1"
    # the product is tied to the shared platform
    assert any(l["verb"] == "is part of" for l in data["links"])


def test_create_system_element_link_and_check(client, admin_token):
    res = client.post("/api/keelson/systems", json={"name": "Lodestar Billing"}, headers=_h(admin_token))
    assert res.status_code == 201
    system = res.json()
    assert system["key"] == "lodestar-billing"
    assert system["checks_total"] == len(check_templates()) and system["element_count"] == 1
    assert client.post("/api/keelson/systems", json={"name": "Lodestar Billing"}, headers=_h(admin_token)).status_code == 409

    url = f"/api/keelson/systems/{system['id']}/elements"
    assert client.post(url, json={"kind": "Nope", "name": "x"}, headers=_h(admin_token)).status_code == 422
    budget = client.post(url, json={"kind": "Budget", "name": "2027 budget", "status": "partial"}, headers=_h(admin_token)).json()
    assert budget["dimension"] == "finance"
    product = system["elements"][0]
    link = client.post("/api/keelson/links", json={"from_id": budget["id"], "to_id": product["id"], "verb": "funds"},
                       headers=_h(admin_token))
    assert link.status_code == 201
    assert client.post("/api/keelson/links", json={"from_id": budget["id"], "to_id": product["id"], "verb": "funds"},
                       headers=_h(admin_token)).status_code == 409

    check = system["checks"][0]
    done = client.patch(f"/api/keelson/checks/{check['id']}", json={"done": True}, headers=_h(admin_token)).json()
    assert done["done"] and done["done_at"]

    assert client.delete(f"/api/keelson/elements/{budget['id']}", headers=_h(admin_token)).status_code == 204
    after = client.get(f"/api/keelson/systems/{system['id']}", headers=_h(admin_token)).json()
    assert after["links"] == [] and after["checks_done"] == 1


def test_keelson_is_admin_only(client, user_token):
    assert client.get("/api/keelson/systems", headers=_h(user_token)).status_code == 403
    assert client.get("/api/keelson/catalog", headers=_h(user_token)).status_code == 403


def test_seed_restricts_site_to_admins(session, admin_user):
    from sqlmodel import select
    from models.core import Group, Site, SiteAccess
    site = Site(name="Keelson", slug="keelson", module="keelson")
    session.add(site)
    session.commit()
    seed_keelson(session)
    seed_keelson(session)
    access = session.exec(select(SiteAccess).where(SiteAccess.site_id == site.id)).all()
    admins = session.exec(select(Group).where(Group.slug == "admins")).first()
    assert [a.group_id for a in access] == [admins.id]
