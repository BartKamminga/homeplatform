"""Items 1229-1232: Competitie-tab config + featureflag (alleen platformbeheerder)."""

from core.auth import hash_password
from models.core import User

API = "/api/yearof-mo14"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_competition_flag_only_platform_admin(client, admin_token, session):
    cfg = client.get(f"{API}/competition").json()
    assert cfg["public"] is False and cfg["poule_id"] == 551 and cfg["tournament_id"]

    # Platformbeheerder (groep admins) ziet de flag en mag hem omzetten
    assert client.get(f"{API}/me", headers=_auth(admin_token)).json()["is_platform_admin"] is True
    res = client.put(f"{API}/competition/public", json={"public": True}, headers=_auth(admin_token))
    assert res.status_code == 200
    assert client.get(f"{API}/competition").json()["public"] is True

    # Topklasse staat apart (item 1239)
    assert client.get(f"{API}/competition").json()["topklasse_public"] is False
    res = client.put(f"{API}/competition/public", json={"public": True, "page": "topklasse"}, headers=_auth(admin_token))
    assert res.status_code == 200
    cfg = client.get(f"{API}/competition").json()
    assert cfg["topklasse_public"] is True and cfg["public"] is True
    assert client.put(f"{API}/competition/public", json={"public": True, "page": "onzin"}, headers=_auth(admin_token)).status_code == 422

    # Andere ingelogde gebruiker (bv. teambeheerder) niet
    session.add(User(username="laura", email="laura@test.nl", password_hash=hash_password("Pass12345")))
    session.commit()
    token = client.post("/api/auth/login", data={"username": "laura", "password": "Pass12345"}).json()["access_token"]
    assert client.get(f"{API}/me", headers=_auth(token)).json()["is_platform_admin"] is False
    assert client.put(f"{API}/competition/public", json={"public": False}, headers=_auth(token)).status_code == 403
    assert client.put(f"{API}/competition/public", json={"public": False}).status_code == 401
    assert client.get(f"{API}/competition").json()["public"] is True


def test_page_blocks_concept_only_platform_admin(client, admin_token, session):
    assert client.get(f"{API}/blocks").json() == {"concept": []}

    res = client.put(f"{API}/blocks/competition.chances", json={"live": False}, headers=_auth(admin_token))
    assert res.status_code == 200
    assert client.get(f"{API}/blocks").json() == {"concept": ["competition.chances"]}

    # Onbekend blok, niet ingelogd en geen platformbeheerder: geweigerd
    assert client.put(f"{API}/blocks/bestaat.niet", json={"live": False}, headers=_auth(admin_token)).status_code == 404
    assert client.put(f"{API}/blocks/competition.chances", json={"live": True}).status_code == 401
    session.add(User(username="laura", email="laura@test.nl", password_hash=hash_password("Pass12345")))
    session.commit()
    token = client.post("/api/auth/login", data={"username": "laura", "password": "Pass12345"}).json()["access_token"]
    assert client.put(f"{API}/blocks/competition.chances", json={"live": True}, headers=_auth(token)).status_code == 403

    client.put(f"{API}/blocks/competition.chances", json={"live": True}, headers=_auth(admin_token))
    assert client.get(f"{API}/blocks").json() == {"concept": []}


def test_match_photo_block_concept(client, admin_token):
    res = client.put(f"{API}/blocks/photos:knhb:12345", json={"live": False}, headers=_auth(admin_token))
    assert res.status_code == 200
    assert "photos:knhb:12345" in client.get(f"{API}/blocks").json()["concept"]
    assert client.put(f"{API}/blocks/photos:onzin", json={"live": False}, headers=_auth(admin_token)).status_code == 404


def test_custom_pages_max_three(client, admin_token):
    pages = client.get(f"{API}/custom-pages").json()
    assert [p["id"] for p in pages] == ["pinksterweekend"]  # standaard: Parijs weekend
    assert client.post(f"{API}/custom-pages", json={"label": "Toernooi"}).status_code == 401
    t = client.post(f"{API}/custom-pages", json={"label": "Toernooi", "title": "Het toernooi"}, headers=_auth(admin_token)).json()
    assert t["id"].startswith("toernooi-")
    client.post(f"{API}/custom-pages", json={"label": "Derde"}, headers=_auth(admin_token))
    assert client.post(f"{API}/custom-pages", json={"label": "Vierde"}, headers=_auth(admin_token)).status_code == 400
    res = client.put(f"{API}/custom-pages/{t['id']}", json={"label": "Toernooi", "title": "Nieuw"}, headers=_auth(admin_token))
    assert res.json()["title"] == "Nieuw"
    assert client.put(f"{API}/blocks/page.{t['id']}", json={"live": False}, headers=_auth(admin_token)).status_code == 200
    assert client.delete(f"{API}/custom-pages/{t['id']}", headers=_auth(admin_token)).status_code == 200
    assert len(client.get(f"{API}/custom-pages").json()) == 2
