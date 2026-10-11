"""Item 1271: inloggen met Google/Microsoft (OIDC) en RS256-tokens.
De provider wordt nagebootst: discovery/jwks uit een dict, id_token
ondertekend met een test-sleutel - geen netwerk."""

import base64
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlparse

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jose import jwk, jwt

import core.auth as core_auth
from core.settings import settings
from routers import auth_oidc

ISSUER = "https://idp.test"
MS_ISSUER = "https://login.microsoftonline.com/{tenantid}/v2.0"


def _pem() -> str:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                             serialization.NoEncryption()).decode()


IDP_KEY = _pem()


@pytest.fixture(autouse=True)
def fake_idp(monkeypatch):
    monkeypatch.setattr(settings, "OIDC_GOOGLE_CLIENT_ID", "google-client")
    monkeypatch.setattr(settings, "OIDC_GOOGLE_CLIENT_SECRET", "s")
    monkeypatch.setattr(settings, "OIDC_MICROSOFT_CLIENT_ID", "ms-client")
    monkeypatch.setattr(settings, "OIDC_MICROSOFT_CLIENT_SECRET", "s")
    monkeypatch.setattr(settings, "OIDC_REDIRECT_BASE", "http://testserver")
    public = jwk.construct(IDP_KEY, "RS256").public_key().to_dict()
    public["kid"] = "idp"
    docs = {
        auth_oidc.PROVIDERS["google"]["discovery"]: {
            "issuer": ISSUER, "authorization_endpoint": f"{ISSUER}/auth",
            "token_endpoint": f"{ISSUER}/token", "jwks_uri": f"{ISSUER}/jwks"},
        auth_oidc.PROVIDERS["microsoft"]["discovery"]: {
            "issuer": MS_ISSUER, "authorization_endpoint": f"{ISSUER}/auth",
            "token_endpoint": f"{ISSUER}/token", "jwks_uri": f"{ISSUER}/jwks"},
        f"{ISSUER}/jwks": {"keys": [public]},
    }
    monkeypatch.setattr(auth_oidc, "_fetch_json", lambda url: docs[url])
    claims = {"sub": "google-123", "email": "bart@example.com"}
    monkeypatch.setattr(auth_oidc, "_exchange_code", lambda provider, code, verifier: {"id_token": claims["_token"]})
    return claims


def _id_token(claims: dict, nonce: str, aud="google-client", iss=ISSUER) -> str:
    body = {"aud": aud, "iss": iss, "nonce": nonce, "exp": datetime.utcnow() + timedelta(minutes=5),
            **{k: v for k, v in claims.items() if not k.startswith("_")}}
    return jwt.encode(body, IDP_KEY, algorithm="RS256", headers={"kid": "idp"})


def _nonce_from_cookie(client) -> str:
    cookie = client.cookies.get(auth_oidc.STATE_COOKIE)
    return jwt.get_unverified_claims(cookie)["nonce"]


def _finish(client, fake_idp, url: str, **token_overrides):
    state = parse_qs(urlparse(url).query)["state"][0]
    fake_idp["_token"] = _id_token(fake_idp, _nonce_from_cookie(client), **token_overrides)
    provider = "microsoft" if "ms-client" in url else "google"
    res = client.get(f"/api/auth/oidc/{provider}/callback?code=c&state={state}", follow_redirects=False)
    assert res.status_code == 302
    location = res.headers["location"]
    return urlparse(location).path, parse_qs(urlparse(location).fragment)


def _link(client, token, provider="google"):
    res = client.post(f"/api/auth/oidc/{provider}/link", json={}, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    return res.json()["url"]


def _login_url(client, provider="google"):
    res = client.get(f"/api/auth/oidc/{provider}/login?next=/account/", follow_redirects=False)
    assert res.status_code == 302
    return res.headers["location"]


def test_providers_only_when_configured(client, monkeypatch):
    assert {p["id"] for p in client.get("/api/auth/oidc/providers").json()} == {"google", "microsoft"}
    monkeypatch.setattr(settings, "OIDC_MICROSOFT_CLIENT_SECRET", "")
    assert [p["id"] for p in client.get("/api/auth/oidc/providers").json()] == ["google"]
    assert client.get("/api/auth/oidc/microsoft/login", follow_redirects=False).status_code == 404


def test_login_redirect_uses_pkce_and_state(client):
    query = parse_qs(urlparse(_login_url(client)).query)
    assert query["code_challenge_method"] == ["S256"]
    assert query["redirect_uri"] == ["http://testserver/api/auth/oidc/google/callback"]
    assert query["state"][0] and client.cookies.get(auth_oidc.STATE_COOKIE)


def test_unlinked_account_cannot_log_in(client, fake_idp):
    path, fragment = _finish(client, fake_idp, _login_url(client))
    assert path == "/admin/login" and "not linked yet" in fragment["oidc_error"][0]


def test_link_then_login(client, fake_idp, admin_token, admin_user):
    path, fragment = _finish(client, fake_idp, _link(client, admin_token))
    assert path == "/account/profile" and fragment["oidc_linked"] == ["google"]

    path, fragment = _finish(client, fake_idp, _login_url(client))
    assert path == "/admin/login" and fragment["next"] == ["/account/"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {fragment['oidc_token'][0]}"})
    assert me.json()["id"] == admin_user.id

    rows = client.get("/api/auth/identities", headers={"Authorization": f"Bearer {admin_token}"}).json()
    assert [(r["provider"], r["email"]) for r in rows] == [("google", "bart@example.com")]
    assert client.delete(f"/api/auth/identities/{rows[0]['id']}",
                         headers={"Authorization": f"Bearer {admin_token}"}).status_code == 204


def test_rejects_wrong_state_nonce_audience_and_issuer(client, fake_idp, admin_token):
    url = _link(client, admin_token)
    res = client.get("/api/auth/oidc/google/callback?code=c&state=verkeerd", follow_redirects=False)
    assert "oidc_error" in res.headers["location"]

    for overrides in ({"aud": "andere-app"}, {"iss": "https://nep.test"}):
        url = _link(client, admin_token)
        _, fragment = _finish(client, fake_idp, url, **overrides)
        assert "oidc_error" in fragment

    url = _link(client, admin_token)
    state = parse_qs(urlparse(url).query)["state"][0]
    fake_idp["_token"] = _id_token(fake_idp, "andere-nonce")
    res = client.get(f"/api/auth/oidc/google/callback?code=c&state={state}", follow_redirects=False)
    assert "oidc_error" in res.headers["location"]


def test_microsoft_issuer_per_tenant(client, fake_idp, admin_token):
    fake_idp["tid"] = "9188040d-6c67-4c5b-b112-36a304b66dad"
    url = _link(client, admin_token, "microsoft")
    _, fragment = _finish(client, fake_idp, url, aud="ms-client",
                          iss="https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0")
    assert fragment["oidc_linked"] == ["microsoft"]


def test_identity_of_other_user_cannot_be_linked(client, fake_idp, admin_token, session):
    from models.core import User, UserIdentity
    other = User(username="ander", email="ander@x", password_hash="x")
    session.add(other)
    session.commit()
    session.add(UserIdentity(user_id=other.id, provider="google", subject="google-123"))
    session.commit()
    _, fragment = _finish(client, fake_idp, _link(client, admin_token))
    assert "another user" in fragment["oidc_error"][0]


def test_open_redirect_blocked(client):
    client.get("/api/auth/oidc/google/login?next=//evil.test", follow_redirects=False)
    cookie = client.cookies.get(auth_oidc.STATE_COOKIE)
    assert jwt.get_unverified_claims(cookie)["next"] == "/admin/dashboard"


def test_rs256_tokens_and_hs256_transition(client, admin_user, monkeypatch):
    old_hs256 = core_auth.create_access_token({"sub": admin_user.id})
    monkeypatch.setattr(settings, "JWT_PRIVATE_KEY_B64", base64.b64encode(_pem().encode()).decode())
    core_auth._rsa_keys.cache_clear()
    try:
        token = core_auth.create_access_token({"sub": admin_user.id})
        assert jwt.get_unverified_header(token)["alg"] == "RS256"
        assert jwt.get_unverified_header(token)["kid"] == settings.JWT_KEY_ID
        for t in (token, old_hs256):
            assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {t}"}).status_code == 200
        keys = client.get("/.well-known/jwks.json").json()["keys"]
        assert keys[0]["kid"] == settings.JWT_KEY_ID and "d" not in keys[0]
    finally:
        monkeypatch.undo()
        core_auth._rsa_keys.cache_clear()
