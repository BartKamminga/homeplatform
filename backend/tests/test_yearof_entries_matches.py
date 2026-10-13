"""Item 1204: karakteriseringstests dagen/tijdlijn en wedstrijdpagina -
entries-CRUD, archiveren, definitief verwijderen met alles eronder, de
samengevoegde tijdlijn, doelpunten en de positie van het fotoblok. Zonder
hockeypoule in de testdatabase bevat de tijdlijn alleen de eigen dagen."""

from datetime import datetime, timedelta

from sqlmodel import select

from models.yearof import (
    YearOfContributorLink,
    YearOfCustomEntry,
    YearOfMatchGoal,
    YearOfMatchPhotoBlock,
    YearOfPhoto,
    YearOfPhotoPlayerTag,
    YearOfPlayer,
    YearOfReport,
    YearOfReportLink,
    YearOfReportPlayerTag,
    YearOfTeamLink,
)

API = "/api/yearof-mo14"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _entry(client, token, **kw):
    body = {"title": "Oefen", "date": "2026-10-01", **kw}
    return client.post(f"{API}/entries", json=body, headers=_auth(token)).json()


def _team_code(session):
    session.add(YearOfTeamLink(id="team01", expires_at=datetime.utcnow() + timedelta(days=5)))
    session.commit()
    return "team01"


# --- entries ------------------------------------------------------------------------

def test_entry_create_update_and_list_by_kind(client, admin_token):
    oefen = _entry(client, admin_token, date="2026-10-02")
    _entry(client, admin_token, kind="bijzonder", title="Teamuitje", date="2026-10-01")
    assert oefen["kind"] == "oefen"
    assert oefen["is_pinned"] is False
    updated = client.patch(f"{API}/entries/{oefen['id']}", json={"score_us": 3, "score_them": 1},
                           headers=_auth(admin_token)).json()
    assert (updated["score_us"], updated["title"]) == (3, "Oefen")
    all_rows = client.get(f"{API}/entries", headers=_auth(admin_token)).json()
    assert [e["title"] for e in all_rows] == ["Teamuitje", "Oefen"]  # op datum
    only = client.get(f"{API}/entries?kind=bijzonder", headers=_auth(admin_token)).json()
    assert [e["title"] for e in only] == ["Teamuitje"]


def test_entries_need_team_access(client):
    assert client.get(f"{API}/entries").status_code == 403


def test_archive_restore_and_visibility(client, admin_token, session):
    code = _team_code(session)
    entry = _entry(client, admin_token)
    client.post(f"{API}/entries/{entry['id']}/archive", headers=_auth(admin_token))
    assert client.get(f"{API}/entries?code={code}").json() == []
    assert len(client.get(f"{API}/entries", headers=_auth(admin_token)).json()) == 1
    client.post(f"{API}/entries/{entry['id']}/restore", headers=_auth(admin_token))
    assert len(client.get(f"{API}/entries?code={code}").json()) == 1


def test_delete_requires_archive_first(client, admin_token):
    entry = _entry(client, admin_token)
    assert client.delete(f"{API}/entries/{entry['id']}", headers=_auth(admin_token)).status_code == 400


def test_delete_removes_everything_under_the_day(client, admin_token, session):
    entry = _entry(client, admin_token)
    ref = f"custom:{entry['id']}"
    player = YearOfPlayer(name="Anna")
    other = YearOfReport(match_ref="m-anders", report_type="nieuws", title="blijft", body="b")
    photo = YearOfPhoto(match_ref=ref)
    report = YearOfReport(match_ref=ref, report_type="wedstrijdverslag", title="weg", body="b")
    session.add_all([player, other, photo, report])
    session.commit()
    session.add_all([
        YearOfPhotoPlayerTag(photo_id=photo.id, player_id=player.id),
        YearOfReportPlayerTag(report_id=report.id, player_id=player.id),
        YearOfReportLink(report_id=report.id, link_type="video", url="u"),
        YearOfContributorLink(id="invul1", match_ref=ref, expires_at=datetime.utcnow()),
        YearOfMatchGoal(match_ref=ref, player_id=player.id, goals=2),
        YearOfMatchPhotoBlock(match_ref=ref, sort_order=5),
    ])
    session.commit()
    client.post(f"{API}/entries/{entry['id']}/archive", headers=_auth(admin_token))
    assert client.delete(f"{API}/entries/{entry['id']}", headers=_auth(admin_token)).json() == {"ok": True}

    session.expire_all()
    for model in (YearOfCustomEntry, YearOfPhoto, YearOfPhotoPlayerTag, YearOfReportPlayerTag,
                  YearOfReportLink, YearOfContributorLink, YearOfMatchGoal, YearOfMatchPhotoBlock):
        assert session.exec(select(model)).all() == [], model.__name__
    assert [r.title for r in session.exec(select(YearOfReport)).all()] == ["blijft"]
    assert session.get(YearOfPlayer, player.id) is not None


# --- tijdlijn -----------------------------------------------------------------------

def test_timeline_merges_custom_entries_with_status_and_flags(client, admin_token, session):
    played = _entry(client, admin_token, title="Gespeeld", date="2026-10-01", score_us=2, score_them=0)
    _entry(client, admin_token, title="Gepland", date="2026-10-08")
    archived = _entry(client, admin_token, title="Weg", date="2026-10-05")
    client.post(f"{API}/entries/{archived['id']}/archive", headers=_auth(admin_token))
    ref = f"custom:{played['id']}"
    session.add_all([
        YearOfPhoto(match_ref=ref, status="published"),
        YearOfReport(match_ref=ref, report_type="wedstrijdverslag", title="v", body="b", status="published"),
        YearOfReport(match_ref=ref, report_type="wedstrijd_beelden", title="f", body="b", status="concept"),
    ])
    session.commit()

    items = client.get(f"{API}/timeline", headers=_auth(admin_token)).json()
    assert [(i["title"], i["status"]) for i in items] == [("Gespeeld", "finished"), ("Gepland", "scheduled")]
    first = items[0]
    assert first["match_ref"] == ref
    assert (first["has_photos"], first["has_report"], first["has_footage"]) == (True, True, False)

    moderation = client.get(f"{API}/timeline/moderation", headers=_auth(admin_token)).json()
    assert [i["title"] for i in moderation] == ["Gespeeld", "Weg", "Gepland"]
    assert moderation[1]["is_archived"] is True


def test_timeline_item_lookup(client, admin_token):
    entry = _entry(client, admin_token)
    ref = f"custom:{entry['id']}"
    assert client.get(f"{API}/timeline/{ref}", headers=_auth(admin_token)).json()["title"] == "Oefen"
    assert client.get(f"{API}/timeline/custom:onbekend", headers=_auth(admin_token)).status_code == 404
    client.post(f"{API}/entries/{entry['id']}/archive", headers=_auth(admin_token))
    # huidig gedrag: gearchiveerd is ook voor de beheerder weg op /timeline/{ref}, wel via moderation
    assert client.get(f"{API}/timeline/{ref}", headers=_auth(admin_token)).status_code == 404
    assert client.get(f"{API}/timeline/moderation/{ref}", headers=_auth(admin_token)).status_code == 200


# --- doelpunten ----------------------------------------------------------------------

def test_goals_set_update_and_zero_removes(client, admin_token, session):
    player = YearOfPlayer(name="Anna")
    session.add(player)
    session.commit()
    url = f"{API}/matches/m1/goals/{player.id}"
    assert client.put(url, json={"goals": 2}, headers=_auth(admin_token)).json() == {"player_id": player.id, "goals": 2}
    client.put(url, json={"goals": 3}, headers=_auth(admin_token))
    assert client.get(f"{API}/matches/m1/goals", headers=_auth(admin_token)).json() == [
        {"player_id": player.id, "goals": 3}]
    assert client.put(url, json={"goals": 0}, headers=_auth(admin_token)).json()["goals"] == 0
    assert client.get(f"{API}/matches/m1/goals", headers=_auth(admin_token)).json() == []
    assert session.exec(select(YearOfMatchGoal)).all() == []


# --- positie fotoblok -------------------------------------------------------------------

def test_photo_block_default_position(client, admin_token, session):
    assert client.get(f"{API}/matches/m1/photo-block", headers=_auth(admin_token)).json() == {"sort_order": -500}
    session.add(YearOfReport(match_ref="m1", report_type="nieuws", title="a", body="b", sort_order=1000))
    session.commit()
    assert client.get(f"{API}/matches/m1/photo-block", headers=_auth(admin_token)).json() == {"sort_order": 500}


def test_photo_block_move_swaps_with_report(client, admin_token, session):
    first = YearOfReport(match_ref="m1", report_type="nieuws", title="a", body="b", sort_order=1000)
    second = YearOfReport(match_ref="m1", report_type="nieuws", title="b", body="b", sort_order=2000)
    session.add_all([first, second])
    session.commit()
    url = f"{API}/matches/m1/photo-block/move"
    assert client.post(url, json={"direction": "up"}, headers=_auth(admin_token)).json() == {"ok": True}
    assert session.get(YearOfMatchPhotoBlock, "m1") is None  # al bovenaan: geen rij aangemaakt
    client.post(url, json={"direction": "down"}, headers=_auth(admin_token))
    session.expire_all()
    assert session.get(YearOfMatchPhotoBlock, "m1").sort_order == 1000
    assert session.get(YearOfReport, first.id).sort_order == 500
