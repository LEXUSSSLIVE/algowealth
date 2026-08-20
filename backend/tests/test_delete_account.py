from tests.conftest import TEST_EMAIL, TEST_PASSWORD


def _auth(tokens):
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def test_delete_account_requires_auth(client, user):
    r = client.post("/api/app/me/delete", json={"password": TEST_PASSWORD})
    assert r.status_code == 401


def test_delete_account_wrong_password_400(client, tokens):
    r = client.post("/api/app/me/delete", headers=_auth(tokens),
                    json={"password": "wrong-pass-1"})
    assert r.status_code == 400


def test_delete_account_removes_user_and_watchlist(client, tokens):
    client.post("/api/app/watchlist", headers=_auth(tokens),
                json={"symbol": "AAPL", "name": "Apple"})
    r = client.post("/api/app/me/delete", headers=_auth(tokens),
                    json={"password": TEST_PASSWORD})
    assert r.status_code == 204
    login = client.post("/api/app/auth/login",
                        json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    assert login.status_code == 401
    from app.db import get_conn
    with get_conn() as conn:
        assert conn.execute("SELECT COUNT(*) FROM watchlist").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
