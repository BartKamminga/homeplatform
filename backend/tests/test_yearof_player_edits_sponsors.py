"""Item 1204: karakteriseringstests profielwijzigingen (insturen, toepassen,
afwijzen) en actie/sponsors (instellingen, CRUD, volgorde). Leggen het
huidige gedrag vast als vangnet voor de refactor (1205/1206)."""

from sqlmodel import select

from models.yearof import YearOfPlayer, YearOfProfileLink, YearOfSponsor

API = "/api/yearof-mo14"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _player_with_link(session):
    player = YearOfPlayer(name="Anna Jansen", nickname="Anna", position="aanval")
    session.add(player)
    session.commit()
    session.add(YearOfProfileLink(id="prof01", player_id=player.id))
    session.commit()
    return player


def _submit(client, code="prof01", **fields):
    return client.post(f"{API}/player-edits", json={"profile_link_code": code, **fields})


# --- profielwijzigingen -------------------------------------------------------------

def test_submit_is_concept_and_leaves_player_unchanged(client, admin_token, session):
    player = _player_with_link(session)
    res = _submit(client, code=" PROF01 ", nickname="Annie", bio="Hoi")
    assert res.status_code == 201
    assert res.json()["status"] == "concept"
    assert res.json()["player_id"] == player.id
    session.expire_all()
    assert session.get(YearOfPlayer, player.id).nickname == "Anna"
    assert _submit(client, code="nooit1").status_code == 403


def test_moderation_lists_only_concepts_newest_first(client, admin_token, session):
    _player_with_link(session)
    first = _submit(client, nickname="Een").json()
    second = _submit(client, nickname="Twee").json()
    client.delete(f"{API}/player-edits/{first['id']}", headers=_auth(admin_token))
    rows = client.get(f"{API}/player-edits/moderation", headers=_auth(admin_token)).json()
    assert [r["id"] for r in rows] == [second["id"]]
    assert client.get(f"{API}/player-edits/moderation").status_code == 401


def test_apply_copies_only_filled_fields_once(client, admin_token, session):
    player = _player_with_link(session)
    edit = _submit(client, nickname="Annie").json()
    res = client.post(f"{API}/player-edits/{edit['id']}/apply", headers=_auth(admin_token))
    assert res.status_code == 200
    assert (res.json()["nickname"], res.json()["position"]) == ("Annie", "aanval")
    again = client.post(f"{API}/player-edits/{edit['id']}/apply", headers=_auth(admin_token))
    assert again.status_code == 409
    session.expire_all()
    assert session.get(YearOfPlayer, player.id).nickname == "Annie"


def test_reject_marks_rejected(client, admin_token, session):
    _player_with_link(session)
    edit = _submit(client, nickname="Annie").json()
    assert client.delete(f"{API}/player-edits/{edit['id']}", headers=_auth(admin_token)).json() == {"ok": True}
    assert client.post(f"{API}/player-edits/{edit['id']}/apply", headers=_auth(admin_token)).status_code == 409
    # huidig gedrag: afwijzen controleert de status niet - een toegepaste wijziging wordt alsnog 'rejected'
    applied = _submit(client, nickname="Nog een").json()
    client.post(f"{API}/player-edits/{applied['id']}/apply", headers=_auth(admin_token))
    assert client.delete(f"{API}/player-edits/{applied['id']}", headers=_auth(admin_token)).status_code == 200


# --- actie ------------------------------------------------------------------------------

def test_action_settings_default_and_update(client, admin_token):
    first = client.get(f"{API}/action").json()  # publiek, maakt de standaardrij aan
    assert first["id"] == "default"
    updated = client.patch(f"{API}/action", json={"goal_amount": 5000, "raised_amount": 1200},
                           headers=_auth(admin_token)).json()
    assert (updated["goal_amount"], updated["raised_amount"]) == (5000, 1200)
    assert client.get(f"{API}/action").json()["raised_amount"] == 1200
    assert client.patch(f"{API}/action", json={"goal_amount": 1}).status_code == 401


# --- sponsors --------------------------------------------------------------------------

def _sponsor(client, token, name):
    return client.post(f"{API}/sponsors", json={"name": name}, headers=_auth(token)).json()


def _names(client):
    return [s["name"] for s in client.get(f"{API}/sponsors").json()]


def test_sponsors_create_in_order_and_update(client, admin_token):
    a = _sponsor(client, admin_token, "Bakker")
    b = _sponsor(client, admin_token, "Slager")
    assert (a["sort_order"], b["sort_order"]) == (0, 1)
    updated = client.patch(f"{API}/sponsors/{a['id']}", json={"website_url": "https://bakker.nl"},
                           headers=_auth(admin_token)).json()
    assert (updated["name"], updated["website_url"]) == ("Bakker", "https://bakker.nl")
    assert _names(client) == ["Bakker", "Slager"]  # publiek, zonder code


def test_sponsor_move_and_edges(client, admin_token):
    _sponsor(client, admin_token, "A")
    b = _sponsor(client, admin_token, "B")
    url = f"{API}/sponsors/{b['id']}/move"
    client.post(url, json={"direction": "up"}, headers=_auth(admin_token))
    assert _names(client) == ["B", "A"]
    client.post(url, json={"direction": "up"}, headers=_auth(admin_token))
    assert _names(client) == ["B", "A"]
    assert client.post(f"{API}/sponsors/onbekend/move", json={"direction": "up"},
                       headers=_auth(admin_token)).status_code == 404


def test_sponsor_delete_is_hard_delete(client, admin_token, session):
    a = _sponsor(client, admin_token, "A")
    assert client.delete(f"{API}/sponsors/{a['id']}", headers=_auth(admin_token)).json() == {"ok": True}
    # huidig gedrag: echt weg (archiveren volgt in 1214)
    assert session.exec(select(YearOfSponsor)).all() == []


def test_sponsor_logo_rejects_wrong_type(client, admin_token):
    a = _sponsor(client, admin_token, "A")
    res = client.post(f"{API}/sponsors/{a['id']}/logo", headers=_auth(admin_token),
                      files={"file": ("logo.gif", b"x", "image/gif")})
    assert res.status_code == 400
