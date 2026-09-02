"""Tests voor Mindbox Contacts (item 1052) - WIE de andere partij in een
mail/document is, many-to-many gekoppeld aan bestanden (een mail heeft vaak
meerdere deelnemers: afzender/to/cc)."""
import io

import pytest

import services.mindbox as svc


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def _isolate_upload_root(tmp_path, monkeypatch):
    monkeypatch.setattr(svc, "UPLOAD_ROOT", tmp_path)


def _upload(client, token, filename="test.msg", content=None):
    if content is None:
        content = f"inhoud van {filename}".encode()
    return client.post(
        "/api/mindbox/items",
        files={"file": (filename, io.BytesIO(content), "application/vnd.ms-outlook")},
        headers=_auth(token),
    )


def test_create_contact_and_find_it_by_email(client, user_token):
    res = client.post(
        "/api/mindbox/contacts", json={"email": "Anouschka.vanLeijden@nipv.nl", "display_name": "Anouschka"},
        headers=_auth(user_token),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "anouschka.vanleijden@nipv.nl"  # genormaliseerd naar lowercase

    listed = client.get("/api/mindbox/contacts", params={"email": "ANOUSCHKA.VANLEIJDEN@NIPV.NL"}, headers=_auth(user_token))
    assert len(listed.json()) == 1
    assert listed.json()[0]["id"] == data["id"]


def test_creating_a_contact_with_an_existing_email_reuses_it(client, user_token):
    first = client.post("/api/mindbox/contacts", json={"email": "paul@nipv.nl"}, headers=_auth(user_token)).json()
    second = client.post("/api/mindbox/contacts", json={"email": "paul@nipv.nl", "display_name": "Paul Duffels"}, headers=_auth(user_token)).json()
    assert second["id"] == first["id"]
    assert second["display_name"] == "Paul Duffels"  # alsnog gevuld, was leeg


def test_update_contact_notes_and_name(client, user_token):
    contact_id = client.post("/api/mindbox/contacts", json={"email": "brechtje@nipv.nl"}, headers=_auth(user_token)).json()["id"]
    updated = client.patch(
        f"/api/mindbox/contacts/{contact_id}", json={"display_name": "Brechtje Spreeuwers", "notes": "Communiceert kort en zakelijk"},
        headers=_auth(user_token),
    )
    assert updated.status_code == 200
    assert updated.json()["display_name"] == "Brechtje Spreeuwers"
    assert updated.json()["notes"] == "Communiceert kort en zakelijk"


def test_link_an_item_to_multiple_contacts(client, user_token):
    """Item 1052 (Bart): 'kan ik meerdere contacten aan een bestand
    koppelen?' - een mail heeft vaak meerdere deelnemers."""
    item_id = _upload(client, user_token).json()["id"]

    r1 = client.post(f"/api/mindbox/items/{item_id}/contact", json={"email": "sender@nipv.nl", "display_name": "Sender"}, headers=_auth(user_token))
    assert r1.status_code == 200
    assert len(r1.json()["contact_ids"]) == 1

    r2 = client.post(f"/api/mindbox/items/{item_id}/contact", json={"email": "cc1@nipv.nl"}, headers=_auth(user_token))
    r3 = client.post(f"/api/mindbox/items/{item_id}/contact", json={"email": "cc2@nipv.nl"}, headers=_auth(user_token))
    assert len(r3.json()["contact_ids"]) == 3

    item = client.get("/api/mindbox/items", headers=_auth(user_token)).json()[0]
    assert len(item["contact_ids"]) == 3


def test_linking_the_same_contact_twice_is_idempotent(client, user_token):
    item_id = _upload(client, user_token).json()["id"]
    client.post(f"/api/mindbox/items/{item_id}/contact", json={"email": "same@nipv.nl"}, headers=_auth(user_token))
    result = client.post(f"/api/mindbox/items/{item_id}/contact", json={"email": "same@nipv.nl"}, headers=_auth(user_token))
    assert len(result.json()["contact_ids"]) == 1


def test_unlink_one_contact_leaves_others_intact(client, user_token):
    item_id = _upload(client, user_token).json()["id"]
    client.post(f"/api/mindbox/items/{item_id}/contact", json={"email": "keep@nipv.nl"}, headers=_auth(user_token))
    client.post(f"/api/mindbox/items/{item_id}/contact", json={"email": "remove@nipv.nl"}, headers=_auth(user_token))
    contacts = client.get("/api/mindbox/contacts", params={"email": "remove@nipv.nl"}, headers=_auth(user_token)).json()
    remove_contact_id = contacts[0]["id"]

    unlinked = client.delete(f"/api/mindbox/items/{item_id}/contact/{remove_contact_id}", headers=_auth(user_token))
    assert unlinked.status_code == 200
    assert len(unlinked.json()["contact_ids"]) == 1
    assert remove_contact_id not in unlinked.json()["contact_ids"]


def test_deleting_a_contact_unlinks_it_from_items(client, user_token):
    item_id = _upload(client, user_token).json()["id"]
    contact = client.post(f"/api/mindbox/items/{item_id}/contact", json={"email": "temp@nipv.nl"}, headers=_auth(user_token)).json()
    contact_id = contact["contact_ids"][0]

    delete_res = client.delete(f"/api/mindbox/contacts/{contact_id}", headers=_auth(user_token))
    assert delete_res.status_code == 200

    item = client.get("/api/mindbox/items", headers=_auth(user_token)).json()[0]
    assert item["contact_ids"] == []


def test_deleting_an_item_removes_its_contact_links(client, user_token):
    item_id = _upload(client, user_token).json()["id"]
    client.post(f"/api/mindbox/items/{item_id}/contact", json={"email": "x@nipv.nl"}, headers=_auth(user_token))
    delete_res = client.delete(f"/api/mindbox/items/{item_id}", headers=_auth(user_token))
    assert delete_res.status_code == 200
    # Contact zelf blijft bestaan (herbruikbaar), alleen de koppeling is weg
    contacts = client.get("/api/mindbox/contacts", params={"email": "x@nipv.nl"}, headers=_auth(user_token)).json()
    assert len(contacts) == 1


def test_a_users_contacts_are_not_visible_to_another_user(client, user_token, admin_token):
    client.post("/api/mindbox/contacts", json={"email": "prive@nipv.nl"}, headers=_auth(user_token))
    listed_by_admin = client.get("/api/mindbox/contacts", headers=_auth(admin_token))
    assert listed_by_admin.json() == []


def test_linking_a_contact_to_another_users_item_is_rejected(client, user_token, admin_token):
    item_id = _upload(client, admin_token).json()["id"]
    res = client.post(f"/api/mindbox/items/{item_id}/contact", json={"email": "x@nipv.nl"}, headers=_auth(user_token))
    assert res.status_code == 403
