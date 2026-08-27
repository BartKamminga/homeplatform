"""Tests voor item 887 (bug-report-widget): schrijft lokaal op prod, stuurt
door op acc/dev zodra PROD_API_BASE/PROD_API_KEY geconfigureerd zijn."""

from unittest.mock import AsyncMock, patch

from sqlmodel import select

from models.core import RoadmapItem


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_creates_roadmap_item_locally_when_not_forwarding(client, admin_token, session):
    # Standaard-settings hebben geen PROD_API_BASE/KEY - dus lokaal opslaan,
    # ongeacht ENVIRONMENT.
    res = client.post(
        "/api/bug-reports",
        headers=_auth(admin_token),
        data={"description": "Knop doet niets", "site": "hockey-inside", "notes": "URL: https://x"},
    )
    assert res.status_code == 200
    assert res.json()["ok"] is True

    item = session.exec(select(RoadmapItem).where(RoadmapItem.title == "Knop doet niets")).first()
    assert item is not None
    assert item.site == "hockey-inside"
    assert item.status == "idea"
    assert item.images is None


def test_forwards_to_prod_when_configured_and_not_production(client, admin_token, session):
    fake_response = AsyncMock()
    fake_response.status_code = 200
    fake_response.json = lambda: {"url": "/api/uploads/roadmap/x/y.png"}

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=fake_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with (
        patch("routers.bug_reports.settings") as mock_settings,
        patch("routers.bug_reports.httpx.AsyncClient", return_value=mock_client),
    ):
        mock_settings.ENVIRONMENT = "acceptatie"
        mock_settings.PROD_API_BASE = "https://prod.example"
        mock_settings.PROD_API_KEY = "secret-key"

        res = client.post(
            "/api/bug-reports",
            headers=_auth(admin_token),
            data={"description": "Test op acc", "site": "admin", "notes": "URL: https://acc"},
        )

    assert res.status_code == 200
    assert res.json()["ok"] is True

    # Niet lokaal opgeslagen - alleen doorgestuurd.
    item = session.exec(select(RoadmapItem).where(RoadmapItem.title == "Test op acc")).first()
    assert item is None

    roadmap_call = mock_client.post.call_args_list[0]
    assert roadmap_call.args[0] == "/api/roadmap"
    assert roadmap_call.kwargs["headers"]["Authorization"] == "Bearer secret-key"
    assert roadmap_call.kwargs["json"]["site"] == "admin"


def test_requires_auth(client):
    res = client.post("/api/bug-reports", data={"description": "x"})
    assert res.status_code == 401
