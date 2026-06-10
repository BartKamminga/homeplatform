import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from core.auth import hash_password
from core.database import get_session
from models.core import User, Group, UserGroup


@pytest.fixture(name="engine")
def engine_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(name="session")
def session_fixture(engine):
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(engine):
    def get_session_override():
        with Session(engine) as session:
            yield session

    from main import app
    app.dependency_overrides[get_session] = get_session_override
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture(name="admin_user")
def admin_user_fixture(session):
    admin_group = Group(name="Admins", slug="admins")
    session.add(admin_group)
    session.commit()
    session.refresh(admin_group)

    user = User(
        username="testadmin",
        email="admin@test.nl",
        password_hash=hash_password("AdminPass123"),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    session.add(UserGroup(user_id=user.id, group_id=admin_group.id))
    session.commit()
    return user


@pytest.fixture(name="regular_user")
def regular_user_fixture(session):
    user = User(
        username="testuser",
        email="user@test.nl",
        password_hash=hash_password("UserPass123"),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@pytest.fixture(name="admin_token")
def admin_token_fixture(client, admin_user):
    res = client.post("/api/auth/login", data={
        "username": "testadmin",
        "password": "AdminPass123",
    })
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture(name="user_token")
def user_token_fixture(client, regular_user):
    res = client.post("/api/auth/login", data={
        "username": "testuser",
        "password": "UserPass123",
    })
    assert res.status_code == 200
    return res.json()["access_token"]
