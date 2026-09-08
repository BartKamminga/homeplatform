"""Tests voor Mindbox Deadlines (item 1117) - agent-gecureerde, chronologische
lijst van belangrijke datums, optioneel gekoppeld aan een case."""


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_create_and_list_deadlines_sorted_by_date(client, user_token):
    client.post("/api/mindbox/deadlines", json={"date": "2026-10-05", "title": "Go/no-go"}, headers=_auth(user_token))
    client.post("/api/mindbox/deadlines", json={"date": "2026-09-14", "title": "Kick-off"}, headers=_auth(user_token))

    listed = client.get("/api/mindbox/deadlines", headers=_auth(user_token)).json()
    assert [d["title"] for d in listed] == ["Kick-off", "Go/no-go"]


def test_create_deadline_with_case_and_description(client, user_token):
    case_id = client.post("/api/mindbox/cases", json={"name": "Herstelplan"}, headers=_auth(user_token)).json()["id"]
    res = client.post(
        "/api/mindbox/deadlines",
        json={"date": "2026-09-28", "title": "Vervolgafspraak", "description": "Bedrijfsarts, 10:00", "case_id": case_id},
        headers=_auth(user_token),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["case_id"] == case_id
    assert data["description"] == "Bedrijfsarts, 10:00"


def test_create_deadline_with_unknown_case_is_rejected(client, user_token):
    res = client.post(
        "/api/mindbox/deadlines", json={"date": "2026-09-28", "title": "X", "case_id": "does-not-exist"},
        headers=_auth(user_token),
    )
    assert res.status_code == 404


def test_update_deadline_fields_and_clear_case(client, user_token):
    case_id = client.post("/api/mindbox/cases", json={"name": "Trila APB"}, headers=_auth(user_token)).json()["id"]
    deadline_id = client.post(
        "/api/mindbox/deadlines", json={"date": "2026-09-14", "title": "Kick-off", "case_id": case_id},
        headers=_auth(user_token),
    ).json()["id"]

    updated = client.patch(
        f"/api/mindbox/deadlines/{deadline_id}", json={"title": "Kick-off weekoverleg", "clear_case": True},
        headers=_auth(user_token),
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Kick-off weekoverleg"
    assert updated.json()["case_id"] is None


def test_delete_deadline(client, user_token):
    deadline_id = client.post(
        "/api/mindbox/deadlines", json={"date": "2026-09-14", "title": "X"}, headers=_auth(user_token),
    ).json()["id"]
    res = client.delete(f"/api/mindbox/deadlines/{deadline_id}", headers=_auth(user_token))
    assert res.status_code == 200
    assert client.get("/api/mindbox/deadlines", headers=_auth(user_token)).json() == []


def test_a_users_deadlines_are_not_visible_to_another_user(client, user_token, admin_token):
    client.post("/api/mindbox/deadlines", json={"date": "2026-09-14", "title": "Prive"}, headers=_auth(user_token))
    listed_by_admin = client.get("/api/mindbox/deadlines", headers=_auth(admin_token))
    assert listed_by_admin.json() == []


def test_deleting_another_users_deadline_is_rejected(client, user_token, admin_token):
    deadline_id = client.post(
        "/api/mindbox/deadlines", json={"date": "2026-09-14", "title": "X"}, headers=_auth(user_token),
    ).json()["id"]
    res = client.delete(f"/api/mindbox/deadlines/{deadline_id}", headers=_auth(admin_token))
    assert res.status_code == 403
