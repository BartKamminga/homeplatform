"""Tests voor item 1190: machine-info per host, peer-token en backup-overzicht per dag."""
from datetime import date

from routers import infra_overview
from services import host_info


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ── backup_days ──────────────────────────────────────────────────────────────

def test_backup_days_marks_local_and_nas_per_day():
    local = {"2026-10-06": 313.0, "2026-10-04": 300.1}
    nas = {"files": ["prod-homeplatform-2026-10-06.sqlite", "prod-homeplatform-2026-10-05.sqlite",
                     "acc-homeplatform-2026-10-04.sqlite"]}
    days = host_info.backup_days(local, nas, "prod", date(2026, 10, 6), days=3)

    assert [d["date"] for d in days] == ["2026-10-06", "2026-10-05", "2026-10-04"]
    assert days[0] == {"date": "2026-10-06", "local": True, "local_mb": 313.0, "nas": True}
    assert days[1]["local"] is False and days[1]["nas"] is True
    # acc-bestand telt niet mee voor prod
    assert days[2]["local"] is True and days[2]["nas"] is False


def test_backup_days_nas_unknown_without_index():
    days = host_info.backup_days({}, None, "acc", date(2026, 10, 6), days=2)
    assert all(d["nas"] is None for d in days)
    assert all(d["local"] is False for d in days)


# ── peer-endpoint ────────────────────────────────────────────────────────────

def test_peer_host_rejects_missing_or_wrong_token(client, monkeypatch):
    monkeypatch.setattr(host_info.settings, "INFRA_PEER_TOKEN", "s3cret")
    assert client.get("/api/infra/host").status_code == 401
    assert client.get("/api/infra/host", headers={"X-Infra-Peer-Token": "nope"}).status_code == 401


def test_peer_host_disabled_when_no_token_configured(client, monkeypatch):
    monkeypatch.setattr(host_info.settings, "INFRA_PEER_TOKEN", "")
    assert client.get("/api/infra/host", headers={"X-Infra-Peer-Token": ""}).status_code == 401


def test_peer_host_returns_summary_with_valid_token(client, monkeypatch):
    monkeypatch.setattr(host_info.settings, "INFRA_PEER_TOKEN", "s3cret")
    monkeypatch.setattr(host_info, "summary", lambda: {"hostname": "g5", "role": "production"})
    res = client.get("/api/infra/host", headers={"X-Infra-Peer-Token": "s3cret"})
    assert res.status_code == 200
    assert res.json() == {"hostname": "g5", "role": "production"}


# ── overview ─────────────────────────────────────────────────────────────────

def test_overview_requires_admin(client, user_token):
    assert client.get("/api/admin/infra/overview").status_code == 401
    assert client.get("/api/admin/infra/overview", headers=_auth(user_token)).status_code == 403


def test_overview_combines_self_peer_and_pipeline(client, admin_token, monkeypatch):
    monkeypatch.setattr(host_info, "summary", lambda: {"hostname": "g5", "role": "production"})
    monkeypatch.setattr(infra_overview, "_fetch_peer", lambda: {"available": False, "error": "offline"})
    monkeypatch.setattr(infra_overview, "_pipeline_runs", lambda: [])
    res = client.get("/api/admin/infra/overview", headers=_auth(admin_token))
    assert res.status_code == 200
    body = res.json()
    assert body["self"] == {"available": True, "hostname": "g5", "role": "production"}
    assert body["peer"]["available"] is False
    assert body["pipeline"] == []
    assert body["links"]["acc_admin"].endswith(":8081/admin/infrastructure")


# ── acc-toegang (item 1191) ──────────────────────────────────────────────────

def test_summary_includes_acc_access_status(tmp_path, monkeypatch):
    (tmp_path / "acc_access.json").write_text(
        '{"status":"ok","home_ips":["217.62.160.125"],"extra_ips":[],"checked_at":"2026-10-14T10:00:00Z"}')
    monkeypatch.setattr(host_info, "DB_DIR", str(tmp_path))
    monkeypatch.setattr(host_info, "containers", lambda: None)
    monkeypatch.setattr(host_info, "hardware", lambda: None)
    assert host_info.summary()["acc_access"]["home_ips"] == ["217.62.160.125"]


def test_summary_includes_crontab(tmp_path, monkeypatch):
    (tmp_path / "crontab.json").write_text(
        '{"checked_at":"2026-10-14T10:00:00Z","jobs":[{"schedule":"*/5 * * * *",'
        '"command":"/home/bart/acc-home-ip.sh >> /home/bart/acc-home-ip.log 2>&1",'
        '"log":"/home/bart/acc-home-ip.log","log_mtime":null}]}')
    monkeypatch.setattr(host_info, "DB_DIR", str(tmp_path))
    monkeypatch.setattr(host_info, "containers", lambda: None)
    monkeypatch.setattr(host_info, "hardware", lambda: None)
    assert host_info.summary()["cron"]["jobs"][0]["schedule"] == "*/5 * * * *"


def test_summary_acc_access_none_without_status_file(tmp_path, monkeypatch):
    monkeypatch.setattr(host_info, "DB_DIR", str(tmp_path))
    monkeypatch.setattr(host_info, "containers", lambda: None)
    monkeypatch.setattr(host_info, "hardware", lambda: None)
    assert host_info.summary()["acc_access"] is None
