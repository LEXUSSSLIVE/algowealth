from tests.conftest import TEST_EMAIL


def _requests_rows(client):
    from app.db import get_conn
    with get_conn() as conn:
        return conn.execute(
            "SELECT user_id, handled FROM password_reset_requests"
        ).fetchall()


def test_forgot_password_records_request_for_known_user(client, user):
    r = client.post("/api/app/auth/forgot-password", json={"email": TEST_EMAIL})
    assert r.status_code == 204
    rows = _requests_rows(client)
    assert len(rows) == 1
    assert rows[0]["handled"] == 0


def test_forgot_password_unknown_email_same_204_no_row(client, user):
    r = client.post("/api/app/auth/forgot-password",
                    json={"email": "ghost@test.io"})
    assert r.status_code == 204
    assert _requests_rows(client) == []


def test_forgot_password_needs_no_auth(client, user):
    r = client.post("/api/app/auth/forgot-password",
                    json={"email": TEST_EMAIL.upper()})
    assert r.status_code == 204
    assert len(_requests_rows(client)) == 1
