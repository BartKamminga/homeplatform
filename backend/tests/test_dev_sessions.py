"""Item 1134: git-toegang en interactief/headless zijn losse assen - de
concurrency-limiet (max 1 git-sessie tegelijk) mag geen lichte/headless
sessies blokkeren en andersom. docker_api wordt gemockt zodat deze tests geen
echte Docker-daemon nodig hebben (zelfde patroon als test_mindbox.py's
monkeypatch op services)."""
import routers.dev_sessions as dev_sessions_router


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _fake_docker_api(method, path, params=None, json_body=None, parse_json=True):
    if path == "/containers/create":
        return {"Id": "fake-container-id"}
    return {}


def _create(client, admin_token, **body):
    return client.post("/api/agent-control/dev-sessions", json=body, headers=_auth(admin_token))


def test_git_concurrency_limit_does_not_block_a_non_git_session(client, admin_token, monkeypatch):
    monkeypatch.setattr(dev_sessions_router, "docker_api", _fake_docker_api)

    git_res = _create(client, admin_token, use_case="dev")
    assert git_res.status_code == 201
    assert git_res.json()["git_enabled"] is True

    # Een 2e git-sessie mag niet, want max 1 (settings.DEV_SESSION_MAX_CONCURRENT_GIT)
    second_git = _create(client, admin_token, use_case="dev")
    assert second_git.status_code == 409

    # Een niet-git sessie (mindbox) mag wel, telt op een aparte teller
    mindbox_res = _create(client, admin_token, use_case="mindbox")
    assert mindbox_res.status_code == 201
    assert mindbox_res.json()["git_enabled"] is False
    assert mindbox_res.json()["interactive"] is True


def test_use_case_defaults_git_and_interactive(client, admin_token, monkeypatch):
    monkeypatch.setattr(dev_sessions_router, "docker_api", _fake_docker_api)

    res = _create(client, admin_token, use_case="fiets")
    assert res.status_code == 201
    body = res.json()
    assert body["git_enabled"] is False
    assert body["interactive"] is False
    assert body["use_case"] == "fiets"


def test_explicit_overrides_win_over_use_case_defaults(client, admin_token, monkeypatch):
    monkeypatch.setattr(dev_sessions_router, "docker_api", _fake_docker_api)

    # mindbox default is interactive=True - hier expliciet overschreven naar headless
    res = _create(client, admin_token, use_case="mindbox", interactive=False)
    assert res.status_code == 201
    assert res.json()["interactive"] is False
    assert res.json()["git_enabled"] is False  # git_enabled niet overschreven, blijft profiel-default


def test_unknown_use_case_is_rejected(client, admin_token, monkeypatch):
    monkeypatch.setattr(dev_sessions_router, "docker_api", _fake_docker_api)

    res = _create(client, admin_token, use_case="not_a_real_use_case")
    assert res.status_code == 400


def test_free_session_without_use_case_defaults_to_git_and_interactive(client, admin_token, monkeypatch):
    """Backwards-compatibel: een sessie zonder use_case gedraagt zich zoals
    vóór item 1134 (git_enabled=True, interactive=True)."""
    monkeypatch.setattr(dev_sessions_router, "docker_api", _fake_docker_api)

    res = _create(client, admin_token)
    assert res.status_code == 201
    assert res.json()["git_enabled"] is True
    assert res.json()["interactive"] is True
    assert res.json()["use_case"] is None
