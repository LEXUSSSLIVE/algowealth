import pytest
from fastapi.testclient import TestClient

from tests.conftest import TEST_EMAIL, TEST_GROUP, TEST_PASSWORD


def test_me_without_token_is_401(client):
    r = client.get("/api/app/me")
    assert r.status_code == 401


def test_me_with_access_token_returns_user(client, tokens):
    r = client.get("/api/app/me",
                   headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert r.status_code == 200
    assert r.json() == {"email": TEST_EMAIL, "group_id": TEST_GROUP,
                        "role": "admin", "language": "ru"}


def test_me_with_garbage_token_is_401(client, user):
    r = client.get("/api/app/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert r.status_code == 401


def test_me_with_refresh_token_is_401(client, tokens):
    r = client.get("/api/app/me",
                   headers={"Authorization": f"Bearer {tokens['refresh_token']}"})
    assert r.status_code == 401


def test_refresh_returns_working_pair(client, tokens):
    r = client.post("/api/app/auth/refresh",
                    json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    me = client.get("/api/app/me",
                    headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200


def test_refresh_with_access_token_is_401(client, tokens):
    r = client.post("/api/app/auth/refresh",
                    json={"refresh_token": tokens["access_token"]})
    assert r.status_code == 401


def test_expired_access_token_is_401(tmp_path, monkeypatch):
    monkeypatch.setenv("ALGOWEALTH_DB", str(tmp_path / "app.db"))
    monkeypatch.setenv("ALGOWEALTH_JWT_SECRET",
                       "test-secret-0123456789abcdef0123456789abcdef")
    monkeypatch.setenv("ALGOWEALTH_ACCESS_TTL_MIN", "0")
    monkeypatch.setenv("ALGOWEALTH_UPLOADS", str(tmp_path / "uploads"))
    from app.main import create_app
    from app.db import create_user
    with TestClient(create_app()) as client:
        create_user(email=TEST_EMAIL, password=TEST_PASSWORD, group_id=TEST_GROUP)
        tokens = client.post("/api/app/auth/login",
                             json={"email": TEST_EMAIL,
                                   "password": TEST_PASSWORD}).json()
        r = client.get("/api/app/me",
                       headers={"Authorization": f"Bearer {tokens['access_token']}"})
        assert r.status_code == 401


def test_short_jwt_secret_is_rejected(monkeypatch):
    monkeypatch.setenv("ALGOWEALTH_JWT_SECRET", "short")
    from app.config import get_settings
    with pytest.raises(RuntimeError):
        get_settings()
