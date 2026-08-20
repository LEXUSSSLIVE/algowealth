import httpx
import pytest

from tests.conftest import TEST_EMAIL, TEST_PASSWORD


@pytest.fixture()
def admin_client(client, user):
    """Client with an admin cookie (TEST_EMAIL is created with role=admin)."""
    r = client.post("/admin/login",
                    data={"email": TEST_EMAIL, "password": TEST_PASSWORD},
                    follow_redirects=False)
    assert r.status_code == 303
    assert "aw_admin" in r.cookies
    client.cookies.update(r.cookies)
    return client


def test_admin_without_cookie_redirects_to_login(client):
    r = client.get("/admin/upload", follow_redirects=False)
    assert r.status_code == 303
    assert r.headers["location"] == "/admin/login"


def test_admin_login_page_renders(client):
    r = client.get("/admin/login")
    assert r.status_code == 200
    assert "email" in r.text


def test_non_admin_cannot_login_to_admin(client, user):
    from app.db import create_user
    create_user(email="user@test.io", password="user-pass-1", group_id="g-x")
    r = client.post("/admin/login",
                    data={"email": "user@test.io", "password": "user-pass-1"},
                    follow_redirects=False)
    assert r.status_code in (303, 200)
    assert "aw_admin" not in r.cookies


def test_admin_upload_page_renders_with_users(admin_client):
    r = admin_client.get("/admin/upload")
    assert r.status_code == 200
    assert TEST_EMAIL in r.text


def test_admin_csv_upload_proxies_to_go(admin_client, monkeypatch):
    monkeypatch.setenv("ALGOWEALTH_GO_API_KEY", "go-secret")
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["date"] = request.url.params.get("date")
        return httpx.Response(200, json={"rows": 16})

    from app import goapi
    admin_client.app.dependency_overrides[goapi.get_go_client] = lambda: httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="http://go-test")
    r = admin_client.post(
        "/admin/upload",
        data={"user_email": TEST_EMAIL, "date": "2026-08-07"},
        files={"file": ("snap.csv", b"a;b\n1;2\n", "text/csv")},
        follow_redirects=False)
    admin_client.app.dependency_overrides.pop(goapi.get_go_client, None)
    assert r.status_code == 303
    assert seen["path"].endswith("/csv-upload")
    assert seen["date"] == "2026-08-07"


def test_admin_creates_user_and_shows_password_once(admin_client):
    r = admin_client.post("/admin/users/create",
                          data={"email": "new@test.io", "group_id": "g-new",
                                "language": "ru"},
                          follow_redirects=True)
    assert r.status_code == 200
    from app.db import get_user_by_email
    u = get_user_by_email("new@test.io")
    assert u is not None
    assert u["group_id"] == "g-new"


def test_admin_resets_password(admin_client, client):
    r = admin_client.post("/admin/users/reset",
                          data={"email": TEST_EMAIL}, follow_redirects=True)
    assert r.status_code == 200
    old = client.post("/api/app/auth/login",
                      json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    assert old.status_code == 401


def test_admin_deletes_user(admin_client):
    from app.db import create_user, get_user_by_email
    create_user(email="bye@test.io", password="bye-pass-11", group_id="g-bye")
    admin_client.post("/admin/users/delete", data={"email": "bye@test.io"},
                      follow_redirects=True)
    assert get_user_by_email("bye@test.io") is None


def test_admin_purges_orphan_fin_stats(admin_client, tmp_path, monkeypatch):
    import sqlite3
    godb = tmp_path / "godb.db"
    conn = sqlite3.connect(godb)
    conn.execute("CREATE TABLE fin_stats (id INTEGER PRIMARY KEY, group_id TEXT, total_value_usd REAL)")
    conn.execute("INSERT INTO fin_stats (group_id, total_value_usd) VALUES ('g-test-1', 1)")
    conn.execute("INSERT INTO fin_stats (group_id, total_value_usd) VALUES ('g-orphan', 2)")
    conn.commit(); conn.close()
    monkeypatch.setenv("ALGOWEALTH_GOAPI_DB", str(godb))
    r = admin_client.post("/admin/users/purge", follow_redirects=True)
    assert r.status_code == 200
    conn = sqlite3.connect(godb)
    groups = [x[0] for x in conn.execute("SELECT DISTINCT group_id FROM fin_stats")]
    assert groups == ["g-test-1"]


def test_admin_post_create_publish_delete(admin_client):
    r = admin_client.post("/admin/posts/save",
                          data={"title": "Test post", "type": "reports",
                                "action": "publish",
                                "content_json": '{"blocks":[{"type":"paragraph","data":{"text":"Hello"}}]}'},
                          follow_redirects=True)
    assert r.status_code == 200
    from app.db import list_posts
    posts = list_posts(None, 10)
    assert len(posts) == 1
    assert posts[0]["title"] == "Test post"
    pid = posts[0]["id"]
    admin_client.post("/admin/posts/delete", data={"post_id": str(pid)},
                      follow_redirects=True)
    assert list_posts(None, 10) == []


def test_forgot_password_sends_tg(client, user, monkeypatch):
    monkeypatch.setenv("ALGOWEALTH_TG_TOKEN", "tok")
    monkeypatch.setenv("ALGOWEALTH_TG_CHAT", "42")
    sent = {}

    def fake_post(url, data=None, timeout=None):
        sent["url"] = url
        sent["data"] = data
        return httpx.Response(200, json={"ok": True})

    monkeypatch.setattr(httpx, "post", fake_post)
    r = client.post("/api/app/auth/forgot-password", json={"email": TEST_EMAIL})
    assert r.status_code == 204
    assert "tok" in sent["url"]
    assert TEST_EMAIL in sent["data"]["text"]


def test_admin_resets_page_lists_requests(admin_client, client):
    client.post("/api/app/auth/forgot-password", json={"email": TEST_EMAIL})
    r = admin_client.get("/admin/resets")
    assert r.status_code == 200
    assert TEST_EMAIL in r.text
