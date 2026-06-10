def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_list_tasks_empty(client, user_token):
    res = client.get("/api/dontforget/tasks", headers=_auth(user_token))
    assert res.status_code == 200
    assert res.json() == []


def test_create_task(client, user_token):
    res = client.post("/api/dontforget/tasks", json={"title": "Boodschappen doen"},
                      headers=_auth(user_token))
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Boodschappen doen"
    assert data["done"] is False


def test_create_task_empty_title(client, user_token):
    res = client.post("/api/dontforget/tasks", json={"title": "   "},
                      headers=_auth(user_token))
    assert res.status_code == 422


def test_create_task_title_too_long(client, user_token):
    res = client.post("/api/dontforget/tasks", json={"title": "x" * 201},
                      headers=_auth(user_token))
    assert res.status_code == 422


def test_complete_task(client, user_token):
    create = client.post("/api/dontforget/tasks", json={"title": "Afvinken"},
                         headers=_auth(user_token))
    task_id = create.json()["id"]

    res = client.post(f"/api/dontforget/tasks/{task_id}/complete", headers=_auth(user_token))
    assert res.status_code == 200
    assert res.json()["done"] is True


def test_delete_task(client, user_token):
    create = client.post("/api/dontforget/tasks", json={"title": "Verwijderen"},
                         headers=_auth(user_token))
    task_id = create.json()["id"]

    res = client.delete(f"/api/dontforget/tasks/{task_id}", headers=_auth(user_token))
    assert res.status_code == 200

    # Taak moet weg zijn (soft delete)
    tasks = client.get("/api/dontforget/tasks", headers=_auth(user_token)).json()
    assert not any(t["id"] == task_id for t in tasks)


def test_tasks_require_auth(client):
    res = client.get("/api/dontforget/tasks")
    assert res.status_code == 401


def test_cannot_delete_other_users_task(client, user_token, admin_token):
    create = client.post("/api/dontforget/tasks", json={"title": "Van user"},
                         headers=_auth(user_token))
    task_id = create.json()["id"]

    res = client.delete(f"/api/dontforget/tasks/{task_id}", headers=_auth(admin_token))
    assert res.status_code == 403
