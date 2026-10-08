"""Item 1241: Home 'In de kijker' = berichten van eigen paginas met Toon op Home."""

API = "/api/yearof-mo14"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _report(client, token, match_ref, featured, status="published", title="x"):
    r = client.post(f"{API}/reports/direct", json={
        "match_ref": match_ref, "report_type": "nieuws", "title": title, "body": "b", "status": status,
    }, headers=_auth(token)).json()
    if featured:
        client.patch(f"{API}/reports/{r['id']}", json={"featured": True}, headers=_auth(token))
    return r


def test_home_reports_only_featured_from_pages(client, admin_token):
    _report(client, admin_token, "page:spotlight", True, title="op home")
    _report(client, admin_token, "page:pinksterweekend", False, title="niet op home")
    _report(client, admin_token, "knhb:1", True, title="wedstrijd")
    _report(client, admin_token, "page:spotlight", True, status="concept", title="concept")
    titles = [r["title"] for r in client.get(f"{API}/reports/home", headers=_auth(admin_token)).json()]
    assert titles == ["op home"]
