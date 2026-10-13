"""Item 1204: karakteriseringstests verslagen - insturen via invullink,
direct schrijven met sort_order, verplaatsen, publiceren met fotos, linkjes,
tags en likes. Leggen het huidige gedrag vast als vangnet voor de refactor
(1205/1206). Home en archiveren staan in test_yearof_home_reports.py."""

from datetime import datetime, timedelta

from sqlmodel import select

from models.yearof import YearOfContributorLink, YearOfPhoto, YearOfPlayer, YearOfReport

API = "/api/yearof-mo14"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _invul(session, code="invul1", **kw):
    link = YearOfContributorLink(**{"id": code, "match_ref": "m1", "report_type": "wedstrijdverslag",
                                    "expires_at": datetime.utcnow() + timedelta(days=5), **kw})
    session.add(link)
    session.commit()
    return link


def _submit(client, code="invul1", title="Verslag", body="tekst"):
    return client.post(f"{API}/reports", json={"contributor_code": code, "title": title, "body": body,
                                               "author_name": "Mama"})


def _direct(client, token, **kw):
    body = {"match_ref": "m1", "report_type": "wedstrijdverslag", "title": "t", "body": "b", **kw}
    return client.post(f"{API}/reports/direct", json=body, headers=_auth(token)).json()


def _order(session, match_ref="m1"):
    session.expire_all()
    rows = session.exec(select(YearOfReport).where(YearOfReport.match_ref == match_ref)
                        .order_by(YearOfReport.sort_order)).all()
    return [r.title for r in rows]


# --- insturen via invullink -----------------------------------------------------

def test_submit_creates_concept_with_player_tag(client, session):
    player = YearOfPlayer(name="Anna")
    session.add(player)
    session.commit()
    _invul(session, report_type="interview", player_id=player.id)
    res = _submit(client)
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "concept"
    assert body["match_ref"] == "m1"
    assert body["report_type"] == "interview"
    assert body["interviewee_role"] == "speelster"
    assert body["contributor_code"] == "invul1"


def test_resubmit_updates_same_report_and_resets_to_concept(client, admin_token, session):
    _invul(session)
    first = _submit(client, title="Eerste").json()
    client.patch(f"{API}/reports/{first['id']}", json={"status": "published"}, headers=_auth(admin_token))
    second = _submit(client, code=" INVUL1 ", title="Tweede").json()
    assert second["id"] == first["id"]
    assert second["title"] == "Tweede"
    assert second["status"] == "concept"


def test_submit_rejects_expired_revoked_or_unknown(client, session):
    _invul(session, code="oud001", expires_at=datetime.utcnow() - timedelta(days=1))
    _invul(session, code="weg001", revoked_at=datetime.utcnow())
    for code in ("oud001", "weg001", "nooit1"):
        assert _submit(client, code=code).status_code == 403


# --- direct schrijven en volgorde -----------------------------------------------

def test_direct_sort_order_appends_and_inserts_between(client, admin_token, session):
    a = _direct(client, admin_token, title="A")
    b = _direct(client, admin_token, title="B")
    assert (a["sort_order"], b["sort_order"]) == (1000, 2000)
    mid = _direct(client, admin_token, title="A2", insert_after_id=a["id"])
    assert mid["sort_order"] == 1500
    last = _direct(client, admin_token, title="C", insert_after_id=b["id"])
    assert last["sort_order"] == 3000
    unknown = _direct(client, admin_token, title="D", insert_after_id="bestaat-niet")
    assert unknown["sort_order"] == 4000
    assert _order(session) == ["A", "A2", "B", "C", "D"]


def test_direct_without_match_gets_zero_and_published_at(client, admin_token):
    body = _direct(client, admin_token, match_ref=None, report_type="nieuws")
    assert body["sort_order"] == 0
    assert body["status"] == "published"
    assert body["published_at"] is not None


def test_direct_with_links_skips_empty_urls(client, admin_token):
    body = _direct(client, admin_token, links=[
        {"link_type": "instagram", "url": " https://insta/1 "},
        {"link_type": "video", "url": "  "},
    ])
    assert [(l["link_type"], l["url"]) for l in body["links"]] == [("instagram", "https://insta/1")]


def test_move_swaps_with_neighbour_and_ignores_edges(client, admin_token, session):
    _direct(client, admin_token, title="A")
    b = _direct(client, admin_token, title="B")
    url = f"{API}/reports/{b['id']}/move"
    assert client.post(url, json={"direction": "up"}, headers=_auth(admin_token)).json() == {"ok": True}
    assert _order(session) == ["B", "A"]
    client.post(url, json={"direction": "up"}, headers=_auth(admin_token))  # al bovenaan: niets
    assert _order(session) == ["B", "A"]
    # huidig gedrag: elke andere richting dan "up" telt als omlaag
    client.post(url, json={"direction": "zijwaarts"}, headers=_auth(admin_token))
    assert _order(session) == ["A", "B"]


def test_move_without_match_ref_is_400(client, admin_token):
    report = _direct(client, admin_token, match_ref=None)
    res = client.post(f"{API}/reports/{report['id']}/move", json={"direction": "up"}, headers=_auth(admin_token))
    assert res.status_code == 400


# --- lijsten ----------------------------------------------------------------------

def test_public_list_hides_concepts_moderation_shows_all(client, admin_token):
    _direct(client, admin_token, title="Live")
    _direct(client, admin_token, title="Concept", status="concept")
    public = client.get(f"{API}/reports?match_ref=m1", headers=_auth(admin_token)).json()
    moderation = client.get(f"{API}/reports/moderation", headers=_auth(admin_token)).json()
    assert [r["title"] for r in public] == ["Live"]
    assert "contributor_code" not in public[0]
    assert sorted(r["title"] for r in moderation) == ["Concept", "Live"]
    assert "contributor_code" in moderation[0]


def test_public_list_filters_report_type(client, admin_token):
    _direct(client, admin_token, title="Verslag")
    _direct(client, admin_token, title="Beelden", report_type="wedstrijd_beelden")
    rows = client.get(f"{API}/reports?report_type=wedstrijd_beelden", headers=_auth(admin_token)).json()
    assert [r["title"] for r in rows] == ["Beelden"]


# --- publiceren neemt fotos mee ----------------------------------------------------

def test_publishing_report_publishes_its_photos_once(client, admin_token, session):
    report = _direct(client, admin_token, status="concept")
    loose = YearOfPhoto(match_ref="m1", report_id=report["id"], status="concept")
    archived = YearOfPhoto(match_ref="m1", report_id=report["id"], status="concept", archived_at=datetime.utcnow())
    session.add_all([loose, archived])
    session.commit()
    body = client.patch(f"{API}/reports/{report['id']}", json={"status": "published"}, headers=_auth(admin_token)).json()
    assert body["published_at"] is not None
    session.expire_all()
    assert session.get(YearOfPhoto, loose.id).status == "published"
    assert session.get(YearOfPhoto, archived.id).status == "concept"
    # huidig gedrag: terug naar concept neemt de fotos NIET mee terug
    client.patch(f"{API}/reports/{report['id']}", json={"status": "concept"}, headers=_auth(admin_token))
    session.expire_all()
    assert session.get(YearOfPhoto, loose.id).status == "published"


# --- linkjes, tags, likes ----------------------------------------------------------

def test_report_links_add_update_delete(client, admin_token):
    report = _direct(client, admin_token)
    base = f"{API}/reports/{report['id']}/links"
    first = client.post(base, json={"link_type": "instagram", "url": "u1"}, headers=_auth(admin_token)).json()
    second = client.post(base, json={"link_type": "video", "url": "u2"}, headers=_auth(admin_token)).json()
    assert (first["sort_order"], second["sort_order"]) == (0, 1)
    updated = client.patch(f"{API}/reports/links/{first['id']}", json={"note": "Kijk"}, headers=_auth(admin_token)).json()
    assert (updated["url"], updated["note"]) == ("u1", "Kijk")
    assert client.delete(f"{API}/reports/links/{second['id']}", headers=_auth(admin_token)).json() == {"ok": True}
    rows = client.get(f"{API}/reports/moderation", headers=_auth(admin_token)).json()
    assert [l["url"] for l in rows[0]["links"]] == ["u1"]


def test_report_tags_and_likes(client, admin_token, session):
    player = YearOfPlayer(name="Anna")
    session.add(player)
    session.commit()
    report = _direct(client, admin_token)
    tag_url = f"{API}/reports/{report['id']}/tags/{player.id}"
    first = client.post(tag_url, headers=_auth(admin_token)).json()
    assert client.post(tag_url, headers=_auth(admin_token)).json()["id"] == first["id"]
    rows = client.get(f"{API}/reports?match_ref=m1", headers=_auth(admin_token)).json()
    assert rows[0]["player_ids"] == [player.id]
    assert client.delete(tag_url, headers=_auth(admin_token)).json() == {"ok": True}

    like_url = f"{API}/reports/{report['id']}/like"
    assert client.post(like_url, headers=_auth(admin_token)).json() == {"like_count": 1}
    assert client.delete(like_url, headers=_auth(admin_token)).json() == {"like_count": 0}
    assert client.delete(like_url, headers=_auth(admin_token)).json() == {"like_count": 0}
