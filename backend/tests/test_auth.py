from tests.conftest import TEST_EMAIL, TEST_GROUP, TEST_PASSWORD


def test_health_returns_ok(client):
    r = client.get("/api/app/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_login_returns_tokens_and_user(client, user):
    r = client.post("/api/app/auth/login",
                    json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["token_type"] == "bearer"
    assert body["user"] == {"email": TEST_EMAIL, "group_id": TEST_GROUP,
                            "role": "admin", "language": "ru"}


def test_login_wrong_password_is_401(client, user):
    r = client.post("/api/app/auth/login",
                    json={"email": TEST_EMAIL, "password": "wrong-password"})
    assert r.status_code == 401


def test_login_unknown_email_same_error_as_wrong_password(client, user):
    wrong_pw = client.post("/api/app/auth/login",
                           json={"email": TEST_EMAIL, "password": "wrong-password"})
    unknown = client.post("/api/app/auth/login",
                          json={"email": "nobody@test.io", "password": "whatever-1"})
    assert unknown.status_code == 401
    assert unknown.json() == wrong_pw.json()


def test_login_email_is_case_insensitive(client, user):
    r = client.post("/api/app/auth/login",
                    json={"email": TEST_EMAIL.upper(), "password": TEST_PASSWORD})
    assert r.status_code == 200
