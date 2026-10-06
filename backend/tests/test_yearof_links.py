"""Items 1185/1186/1193: spelersvelden, wedstrijd-/spelerslinks met eigen scope
en vervaldatum, en bezoektelling per link."""

from datetime import datetime, timedelta

from sqlmodel import select

from models.yearof import YearOfPhoto, YearOfPhotoPlayerTag, YearOfPlayer, YearOfPlayerSpotlight, YearOfShortLink

API = "/api/yearof-mo14"


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _team_code(client, token):
    res = client.post(f"{API}/team-links", headers=_auth(token))
    assert res.status_code == 200
    return res.json()["id"]


def _player(session, **extra):
    player = YearOfPlayer(name="Fleur", nickname="Fleurtje", shirt_number=7, bio="Hoi", **extra)
    session.add(player)
    session.commit()
    session.refresh(player)
    return player


def _short_link(client, token, **body):
    res = client.post(f"{API}/short-links", json=body, headers=_auth(token))
    assert res.status_code == 200
    return res.json()


def test_match_link_is_scoped_to_one_match(client, admin_token):
    team = _team_code(client, admin_token)
    link = _short_link(client, admin_token, match_ref="m1")
    assert link["link_type"] == "match" and link["expires_at"]

    res = client.get(f"/l/{link['id']}")
    assert f"/yearof-mo14/?entry=m1&amp;link={link['id']}" in res.text
    assert team not in res.text

    assert client.get(f"{API}/photos?match_ref=m1&code={link['id']}").status_code == 200
    assert client.get(f"{API}/reports?match_ref=m1&code={link['id']}").status_code == 200
    assert client.get(f"{API}/photos?match_ref=m2&code={link['id']}").status_code == 403
    assert client.get(f"{API}/photos?code={link['id']}").status_code == 403
    assert client.get(f"{API}/players?code={link['id']}").status_code == 403
    assert client.get(f"{API}/players?code={team}").status_code == 200

    res = client.get(f"{API}/short-links/{link['id']}/validate")
    assert res.json() == {"valid": True, "link_type": "match", "match_ref": "m1"}


def test_player_link_only_exposes_whitelisted_fields(client, admin_token, session):
    player = _player(session, parents="Jan & Petra", buddy="Sanne", coaches="Kim")
    link = _short_link(client, admin_token, player_id=player.id)

    res = client.get(f"/l/{link['id']}")
    assert f"/yearof-mo14/?speler={link['id']}" in res.text

    data = client.get(f"{API}/player-links/{link['id']}").json()
    assert data["name"] == "Fleur" and data["bio"] == "Hoi"
    assert (data["parents"], data["buddy"], data["coaches"]) == ("Jan & Petra", "Sanne", "Kim")
    assert not {"archived_at", "created_at"} & set(data)

    # Een spelerslink is geen toegang tot de rest van de site
    assert client.get(f"{API}/photos?player_id={player.id}&code={link['id']}").status_code == 403


def test_admin_only_player_fields_not_in_profile_link(client, admin_token, session):
    player = _player(session)
    res = client.patch(f"{API}/players/{player.id}", json={"parents": "Jan & Petra", "buddy": "Sanne"},
                       headers=_auth(admin_token))
    assert res.json()["parents"] == "Jan & Petra"

    profile = client.post(f"{API}/profile-links?player_id={player.id}", headers=_auth(admin_token)).json()
    ctx = client.get(f"{API}/profile-links/{profile['id']}").json()
    assert ctx["name"] == "Fleur"
    assert "parents" not in ctx and "buddy" not in ctx


def test_short_link_reused_while_valid_and_expires(client, admin_token, session):
    player = _player(session)
    first = _short_link(client, admin_token, player_id=player.id)
    assert _short_link(client, admin_token, player_id=player.id)["id"] == first["id"]

    link = session.get(YearOfShortLink, first["id"])
    link.expires_at = datetime.utcnow() - timedelta(minutes=1)
    session.add(link)
    session.commit()

    assert client.get(f"{API}/short-links/{first['id']}/validate").json() == {"valid": False}
    assert client.get(f"{API}/player-links/{first['id']}").status_code == 403
    assert _short_link(client, admin_token, player_id=player.id)["id"] != first["id"]


def test_revoked_match_link_loses_access(client, admin_token):
    link = _short_link(client, admin_token, match_ref="m1")
    assert client.post(f"{API}/short-links/{link['id']}/revoke", headers=_auth(admin_token)).status_code == 200
    assert client.get(f"{API}/photos?match_ref=m1&code={link['id']}").status_code == 403


def test_legacy_match_link_follows_team_code(client, admin_token, session):
    team = _team_code(client, admin_token)
    session.add(YearOfShortLink(id="legacy", team_code=team, match_ref="m1", link_type="match"))
    session.commit()

    res = client.get("/l/legacy")
    assert team not in res.text
    assert client.get(f"{API}/photos?match_ref=m1&code=legacy").status_code == 200

    _team_code(client, admin_token)  # nieuwe sitelink trekt de oude teamcode in
    assert client.get(f"{API}/photos?match_ref=m1&code=legacy").status_code == 403


def test_visits_counted_per_link_and_admin_skipped(client, admin_token, session):
    player = _player(session)
    link = _short_link(client, admin_token, player_id=player.id)

    for visitor in ("a", "a", "b"):
        res = client.post(f"{API}/visits", json={"kind": "player", "code": link["id"], "visitor_id": visitor})
        assert res.json() == {"counted": True}
    res = client.post(f"{API}/visits", json={"kind": "player", "code": link["id"], "visitor_id": "c"},
                      headers=_auth(admin_token))
    assert res.json() == {"counted": False}
    res = client.post(f"{API}/visits", json={"kind": "player", "code": link["id"], "visitor_id": "d", "excluded": True})
    assert res.json() == {"counted": False}

    overview = client.get(f"{API}/link-overview", headers=_auth(admin_token)).json()
    row = next(r for r in overview["player"] if r["code"] == link["id"])
    assert (row["opens"], row["unique"], row["admin_opens"], row["label"]) == (3, 2, 2, "Fleurtje")
    assert row["player_id"] == player.id  # filter voor het blok per speelster
    assert overview["totals"]["player"] == {"opens": 3, "unique": 2, "admin_opens": 2}
    assert overview["totals"]["all"]["opens"] == 3
    assert (row["days"][0]["opens"], row["days"][0]["admin_opens"]) == (3, 2)


def test_overview_rows_carry_match_and_contribute_status(client, admin_token, session):
    player = _player(session)
    _short_link(client, admin_token, match_ref="m1")
    res = client.post(f"{API}/contributor-links", headers=_auth(admin_token),
                      json={"match_ref": "m1", "player_id": player.id, "report_type": "interview", "expires_days": 14})
    assert res.status_code == 200

    overview = client.get(f"{API}/link-overview", headers=_auth(admin_token)).json()
    assert overview["match"][0]["match_ref"] == "m1"
    contribute = overview["contribute"][0]
    assert (contribute["match_ref"], contribute["player_id"], contribute["report_status"]) == ("m1", player.id, None)
    assert "opened_at" in contribute and "revoked_at" in contribute


def test_profile_link_visits_counted(client, admin_token, session):
    player = _player(session)
    profile = client.post(f"{API}/profile-links?player_id={player.id}", headers=_auth(admin_token)).json()
    res = client.post(f"{API}/visits", json={"kind": "profile", "code": profile["id"], "visitor_id": "a"})
    assert res.json() == {"counted": True}

    overview = client.get(f"{API}/link-overview", headers=_auth(admin_token)).json()
    row = overview["profile"][0]
    assert (row["code"], row["player_id"], row["opens"], row["status"]) == (profile["id"], player.id, 1, "active")


def test_visit_for_unknown_link_rejected(client):
    res = client.post(f"{API}/visits", json={"kind": "match", "code": "nope", "visitor_id": "a"})
    assert res.status_code == 400


def test_short_link_preview_tags(client, admin_token, session):
    player = _player(session, photo_url="/api/yearof-mo14/profile-photos/x.jpg")
    link = _short_link(client, admin_token, player_id=player.id)

    html = client.get(f"/l/{link['id']}").text
    assert '<meta property="og:title" content="Fleurtje · MO14 à Paris">' in html
    assert "/api/yearof-mo14/profile-photos/x.jpg" in html
    assert "Link geldig t/m" in html
    assert "og:image" in html and "http" in html.split('og:image" content="')[1][:8]

    # Verlopen link: geen naam of foto in de preview
    row = session.get(YearOfShortLink, link["id"])
    row.expires_at = datetime.utcnow() - timedelta(minutes=1)
    session.add(row)
    session.commit()
    html = client.get(f"/l/{link['id']}").text
    assert "Fleurtje" not in html and "profile-photos" not in html
    assert "Deze link is verlopen" in html
    assert "/api/yearof-mo14/og-default.png" in html

    res = client.get(f"{API}/og-default.png")
    assert res.status_code == 200 and res.headers["content-type"] == "image/png"


def _photo(session, player, status="published", media_type="photo", favorite=False):
    photo = YearOfPhoto(match_ref="m1", status=status, media_type=media_type)
    session.add(photo)
    session.commit()
    session.refresh(photo)
    session.add(YearOfPhotoPlayerTag(photo_id=photo.id, player_id=player.id, favorite=favorite))
    session.commit()
    return photo


def test_favorites_max_six_photos_only(client, admin_token, session):
    player = _player(session)
    photos = [_photo(session, player) for _ in range(7)]
    video = _photo(session, player, media_type="video")

    for p in photos[:6]:
        res = client.put(f"{API}/players/{player.id}/favorites/{p.id}", json={"favorite": True}, headers=_auth(admin_token))
        assert res.status_code == 200
    res = client.put(f"{API}/players/{player.id}/favorites/{photos[6].id}", json={"favorite": True}, headers=_auth(admin_token))
    assert res.status_code == 400
    res = client.put(f"{API}/players/{player.id}/favorites/{video.id}", json={"favorite": True}, headers=_auth(admin_token))
    assert res.status_code == 400
    # Zonder login niet aan te passen
    assert client.put(f"{API}/players/{player.id}/favorites/{photos[0].id}", json={"favorite": False}).status_code == 401

    rows = client.get(f"{API}/players/{player.id}/photos/moderation", headers=_auth(admin_token)).json()
    assert sum(r["favorite"] for r in rows) == 6 and all(r["media_type"] == "photo" for r in rows)


def test_player_link_shows_only_published_favorites(client, admin_token, session):
    player = _player(session)
    fav = _photo(session, player, favorite=True)
    _photo(session, player, favorite=True, status="concept")
    _photo(session, player)  # geen favoriet
    link = _short_link(client, admin_token, player_id=player.id)

    data = client.get(f"{API}/player-links/{link['id']}").json()
    assert [p["id"] for p in data["favorite_photos"]] == [fav.id]
    assert set(data["favorite_photos"][0]) == {"id", "media_type", "caption", "created_at", "published_at"}

    team = _team_code(client, admin_token)
    res = client.get(f"{API}/players/{player.id}/favorites?code={team}")
    assert [p["id"] for p in res.json()] == [fav.id]
    assert client.get(f"{API}/players/{player.id}/favorites?code={link['id']}").status_code == 403


def test_player_spotlight_max_one(client, admin_token, session):
    jip = _player(session)
    fleur = YearOfPlayer(name="Fleur B", shirt_number=9, bio="Bio Fleur")
    session.add(fleur)
    session.commit()
    team = _team_code(client, admin_token)

    assert client.get(f"{API}/player-spotlight?code={team}").json() is None
    client.put(f"{API}/player-spotlight", json={"player_id": jip.id}, headers=_auth(admin_token))
    client.put(f"{API}/player-spotlight", json={"player_id": fleur.id}, headers=_auth(admin_token))

    current = client.get(f"{API}/player-spotlight?code={team}").json()
    assert current["player"]["name"] == "Fleur B" and current["player"]["bio"] == "Bio Fleur"
    assert "parents" not in current["player"]
    active = session.exec(select(YearOfPlayerSpotlight).where(YearOfPlayerSpotlight.ended_at.is_(None))).all()
    assert len(active) == 1

    # Alleen met teamcode en alleen de beheerder kan kiezen
    assert client.get(f"{API}/player-spotlight").status_code == 403
    assert client.put(f"{API}/player-spotlight", json={"player_id": jip.id}).status_code == 401

    client.put(f"{API}/player-spotlight", json={"player_id": None}, headers=_auth(admin_token))
    assert client.get(f"{API}/player-spotlight?code={team}").json() is None