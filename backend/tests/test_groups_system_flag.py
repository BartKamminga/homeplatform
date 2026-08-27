"""Tests voor item 168: Group-lijst geeft nu is_system mee (afgeleid van de
bestaande PROTECTED_GROUPS-constante, geen nieuwe DB-kolom) zodat de admin-UI
systeemgroepen (admins/members/guest) duidelijk als vergrendeld kan tonen."""

from models.core import Group
from routers.groups import list_groups, delete_group
from fastapi import HTTPException
import pytest


def test_list_groups_marks_protected_slugs_as_system(session):
    session.add(Group(name="Admins", slug="admins"))
    session.add(Group(name="Members", slug="members"))
    session.add(Group(name="Fietsers", slug="fietsers"))
    session.commit()

    result = list_groups(session=session, _=None)

    by_slug = {g.slug: g for g in result}
    assert by_slug["admins"].is_system is True
    assert by_slug["members"].is_system is True
    assert by_slug["fietsers"].is_system is False


def test_delete_group_still_blocked_for_a_protected_slug(session):
    group = Group(name="Admins", slug="admins")
    session.add(group)
    session.commit()
    session.refresh(group)

    with pytest.raises(HTTPException) as exc:
        delete_group(group_id=group.id, session=session, admin=None)
    assert exc.value.status_code == 400
