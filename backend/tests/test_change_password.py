from tests.conftest import TEST_EMAIL, TEST_PASSWORD

NEW_PASSWORD = "brand-new-pass-2"


def _change(client, access_token, old, new):
    return client.post("/api/app/auth/change-password",
                       headers={"Authorization": f"Bearer {access_token}"},
                       json={"old_password": old, "new_password": new})


def test_change_password_requires_auth(client, user):
    r = client.post("/api/app/auth/change-password",
                    json={"old_password": TEST_PASSWORD, "new_password": NEW_PASSWORD})
    assert r.status_code == 401


def test_change_password_switches_login(client, tokens):
    r = _change(client, tokens["access_token"], TEST_PASSWORD, NEW_PASSWORD)
    assert r.status_code == 204
    old = client.post("/api/app/auth/login",
                      json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    assert old.status_code == 401
    new = client.post("/api/app/auth/login",
                      json={"email": TEST_EMAIL, "password": NEW_PASSWORD})
    assert new.status_code == 200


def test_change_password_wrong_old_is_400(client, tokens):
    r = _change(client, tokens["access_token"], "wrong-old-pass", NEW_PASSWORD)
    assert r.status_code == 400


def test_change_password_revokes_old_refresh_tokens(client, tokens):
    assert _change(client, tokens["access_token"], TEST_PASSWORD,
                   NEW_PASSWORD).status_code == 204
    r = client.post("/api/app/auth/refresh",
                    json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 401


def test_change_password_too_short_is_422(client, tokens):
    r = _change(client, tokens["access_token"], TEST_PASSWORD, "short")
    assert r.status_code == 422
