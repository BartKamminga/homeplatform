def test_login_success(client, admin_user):
    res = client.post("/api/auth/login", data={
        "username": "testadmin",
        "password": "AdminPass123",
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["username"] == "testadmin"


def test_login_wrong_password(client, admin_user):
    res = client.post("/api/auth/login", data={
        "username": "testadmin",
        "password": "wrongpassword",
    })
    assert res.status_code == 401


def test_login_unknown_user(client):
    res = client.post("/api/auth/login", data={
        "username": "doesnotexist",
        "password": "whatever",
    })
    assert res.status_code == 401


def test_me_authenticated(client, admin_token):
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert res.json()["username"] == "testadmin"


def test_me_unauthenticated(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_refresh_token(client, user_token):
    res = client.post("/api/auth/refresh", headers={"Authorization": f"Bearer {user_token}"})
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_logout(client, user_token):
    res = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {user_token}"})
    assert res.status_code == 200
