import pytest
from fastapi.testclient import TestClient

TEST_EMAIL = "alexey@test.io"
TEST_PASSWORD = "correct-horse-1"
TEST_GROUP = "g-test-1"


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("ALGOWEALTH_DB", str(tmp_path / "app.db"))
    monkeypatch.setenv("ALGOWEALTH_JWT_SECRET", "test-secret-0123456789abcdef0123456789abcdef")
    monkeypatch.setenv("ALGOWEALTH_UPLOADS", str(tmp_path / "uploads"))
    from app.main import create_app
    with TestClient(create_app()) as c:
        yield c


@pytest.fixture()
def user(client):
    from app.db import create_user
    create_user(email=TEST_EMAIL, password=TEST_PASSWORD,
                group_id=TEST_GROUP, role="admin", language="ru")
    return {"email": TEST_EMAIL, "password": TEST_PASSWORD, "group_id": TEST_GROUP}


@pytest.fixture()
def tokens(client, user):
    r = client.post("/api/app/auth/login",
                    json={"email": user["email"], "password": user["password"]})
    assert r.status_code == 200
    return r.json()
