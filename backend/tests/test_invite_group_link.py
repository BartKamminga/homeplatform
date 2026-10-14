"""Groepslink: een herbruikbare uitnodiging per groep met startpagina (item 1332)."""

from sqlmodel import select

from tests.test_auth_oidc import _finish, _signup_url, fake_idp  # noqa: F401  (fixture)


def _group(session, slug="fietsen"):
    from models.core import Group
    group = Group(name=slug.title(), slug=slug)
    session.add(group)
    session.commit()
    return group


def _create_link(client, admin_token, **body):
    res = client.post("/api/auth/invite", headers={"Authorization": f"Bearer {admin_token}"}, json=body)
    assert res.status_code == 200, res.text
    return res.json()["token"]


def test_admin_creates_group_link_without_being_member(client, session, admin_token):
    _group(session)
    token = _create_link(client, admin_token, group_slug="fietsen", reusable=True, next="/vbt/")
    info = client.get(f"/api/auth/invite/{token}").json()
    assert info["group_name"] == "Fietsen" and info["next"] == "/vbt/"


def test_group_link_rejects_bad_input(client, session, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    _group(session)
    assert client.post("/api/auth/invite", headers=headers, json={"reusable": True}).status_code == 422
    assert client.post("/api/auth/invite", headers=headers,
                       json={"group_slug": "fietsen", "next": "//evil.com"}).status_code == 422


def test_group_link_works_for_several_people(client, fake_idp, session, admin_token):
    from models.core import InviteToken
    _group(session)
    token = _create_link(client, admin_token, group_slug="fietsen", reusable=True, next="/vbt/")
    for i, email in enumerate(["een@gmail.com", "twee@outlook.com"]):
        fake_idp.update(sub=f"sub-{i}", email=email)
        path, fragment = _finish(client, fake_idp, _signup_url(client, token))
        assert path == "/admin/login" and fragment["next"] == ["/vbt/"]
        me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {fragment['oidc_token'][0]}"}).json()
        assert "fietsen" in me["groups"]
    session.expire_all()
    assert session.exec(select(InviteToken).where(InviteToken.token == token)).first().use_count == 2
    # Het wachtwoordpad blijft ook werken
    res = client.post(f"/api/auth/invite/{token}/accept", json={"username": "drie", "password": "geheim123"})
    assert res.status_code == 200


def test_single_use_invite_still_single_use(client, session, admin_token):
    token = _create_link(client, admin_token)
    assert client.post(f"/api/auth/invite/{token}/accept", json={"username": "a", "password": "geheim123"}).status_code == 200
    assert client.get(f"/api/auth/invite/{token}").status_code == 410


def test_existing_google_user_joins_group_via_link(client, fake_idp, session, admin_token):
    from models.core import UserIdentity
    _group(session)
    first = _create_link(client, admin_token)
    fake_idp.update(sub="bestaand", email="bestaand@gmail.com")
    _finish(client, fake_idp, _signup_url(client, first))

    token = _create_link(client, admin_token, group_slug="fietsen", reusable=True, next="/vbt/")
    path, fragment = _finish(client, fake_idp, _signup_url(client, token))
    assert path == "/admin/login" and fragment["next"] == ["/vbt/"] and "oidc_token" in fragment
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {fragment['oidc_token'][0]}"}).json()
    assert me["username"] == "bestaand" and "fietsen" in me["groups"]
    assert len(session.exec(select(UserIdentity)).all()) == 1
