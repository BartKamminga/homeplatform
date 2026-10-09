"""Item 1252 (sponsornaam van competitienamen afhalen) en item 1253
(teamcategorie uit de teamcode i.p.v. het begin van de volledige naam)."""

from sqlmodel import select

from models.hockey_discovery import HockeyCompetition, HockeyPoule, HockeyTeam
from models.settings import AppSetting
from routers.hockey_capture import PouleCaptureIn, TeamInPoule
from services.hockey_poule_capture_core import _derive_category, apply_poule_capture
from services.hockey_vanger_ingest import _call_competition_detail
from services.hockey_vanger_settings import get_target_season, strip_competition_sponsor


def _body(poule_id, team_id, team_name, **kw):
    defaults = dict(
        poule_id=poule_id, poule_name="Poule A", competition_name="HelloFresh Meisjes O18 3e klasse",
        class_name="3e klasse", district="", hockey_type="VE", season="2026-2027",
        teams_in_poule=[TeamInPoule(id=team_id, name=team_name, short_name=team_name,
                                     federation_reference_id="HH11XX0")],
    )
    defaults.update(kw)
    return PouleCaptureIn(**defaults)


def test_strip_competition_sponsor_removes_known_prefixes_only(session):
    assert strip_competition_sponsor(session, "HelloFresh Meisjes O18 3e klasse") == "Meisjes O18 3e klasse"
    assert strip_competition_sponsor(session, "hellofresh Jongens O16 3e klasse") == "Jongens O16 3e klasse"
    assert strip_competition_sponsor(session, "Staatsloterij Hoofdklasse Dames") == "Hoofdklasse Dames"
    assert strip_competition_sponsor(session, "Meisjes O14 Voorcompetitie") == "Meisjes O14 Voorcompetitie"
    assert strip_competition_sponsor(session, "HelloFreshness Cup") == "HelloFreshness Cup"
    assert strip_competition_sponsor(session, "") == ""


def test_strip_competition_sponsor_uses_the_configured_list(session):
    session.add(AppSetting(key="competition_sponsor_prefixes", value="Rabobank, HelloFresh"))
    session.commit()
    assert strip_competition_sponsor(session, "Rabobank Jongens O12 Voorcompetitie") == "Jongens O12 Voorcompetitie"
    assert strip_competition_sponsor(session, "Staatsloterij Hoofdklasse Dames") == "Staatsloterij Hoofdklasse Dames"


def test_apply_poule_capture_stores_the_competition_without_sponsor(session):
    apply_poule_capture(session, _body(poule_id=9001, team_id=9001, team_name="HIC MO18-1"), get_target_season(session))
    session.commit()

    comp = session.exec(select(HockeyCompetition)).one()
    assert comp.name == "Meisjes O18 3e klasse"
    assert comp.external_id == "Meisjes O18 3e klasse|3e klasse||2026-2027"


def test_apply_poule_capture_keeps_a_renamed_competition_and_its_poule(session):
    # Na de migratie staat de rij al zonder sponsor; een nieuwe scan in de
    # sponsorvorm moet die rij terugvinden i.p.v. een nieuwe aan te maken.
    comp = HockeyCompetition(
        external_id="Meisjes O18 3e klasse|3e klasse||2026-2027", name="Meisjes O18 3e klasse",
        class_name="3e klasse", hockey_type="VE", season="2026-2027",
    )
    session.add(comp)
    session.commit()
    session.refresh(comp)
    session.add(HockeyPoule(poule_id=9002, name="Poule A", competition_id=comp.id, season="2026-2027"))
    session.commit()

    apply_poule_capture(session, _body(poule_id=9002, team_id=9002, team_name="HIC MO18-2"), get_target_season(session))
    session.commit()

    assert [c.id for c in session.exec(select(HockeyCompetition)).all()] == [comp.id]
    poule = session.exec(select(HockeyPoule).where(HockeyPoule.poule_id == 9002)).one()
    assert poule.competition_id == comp.id


def test_call_competition_detail_strips_the_sponsor_without_an_existing_landelijk_row(session):
    raw = {"data": {"data": {
        "id": "abcdefgh", "name": "HelloFresh Jongens O18 3e klasse",
        "poules": [{
            "id": 9003, "name": "Poule A",
            "competition": {"id": 9003, "name": "Jongens O18 Voorcompetitie", "class_name": "3e klasse"},
            "standings": [],
            "matches": [{"id": 1, "date": "2026-09-06T12:00:00+02:00", "status": "final",
                         "home": {"id": 10, "name": "A"}, "away": {"id": 11, "name": "B"},
                         "score": {"home": 1, "away": 0}}],
        }],
    }}}

    _call_competition_detail(raw, session, params={"label": "?"})

    names = [c.name for c in session.exec(select(HockeyCompetition)).all()]
    assert names == ["Jongens O18 3e klasse"]


def test_derive_category_looks_at_the_team_code_not_the_club_name():
    assert _derive_category("HIC MO18-1") == "Junioren"
    assert _derive_category("Den Bosch JO16-2") == "Junioren"
    assert _derive_category("Kampong zJO12-1") == "Junioren"
    assert _derive_category("MO14-3") == "Junioren"
    assert _derive_category("Kampong H1") == "Senioren"
    assert _derive_category("HDM D2") == "Senioren"
    assert _derive_category("Hurley Heren 3") == "Senioren"
    assert _derive_category("HIC") == ""
    assert _derive_category("") == ""


def test_apply_poule_capture_marks_a_youth_team_of_an_h_club_as_junioren(session):
    apply_poule_capture(session, _body(poule_id=9004, team_id=9004, team_name="HIC MO18-1"), get_target_season(session))
    session.commit()

    team = session.exec(select(HockeyTeam).where(HockeyTeam.team_id == 9004)).one()
    assert team.category_group_name == "Junioren"
