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

    # Andere ingelogde gebruiker (bv. teambeheerder) niet
    session.add(User(username="laura", email="laura@test.nl", password_hash=hash_password("Pass12345")))
    session.commit()
    token = client.post("/api/auth/login", data={"username": "laura", "password": "Pass12345"}).json()["access_token"]
    assert client.get(f"{API}/me", headers=_auth(token)).json()["is_platform_admin"] is False
    assert client.put(f"{API}/competition/public", json={"public": False}, headers=_auth(token)).status_code == 403
    assert client.put(f"{API}/competition/public", json={"public": False}).status_code == 401
    assert client.get(f"{API}/competition").json()["public"] is True
