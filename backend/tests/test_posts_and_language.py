def _auth(tokens):
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def _seed_post(status="published", type_="reports", title="Weekly report",
               content_json=None, file_path=None):
    from app.db import get_conn
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO posts (title, type, status, content_plain, "
            "content_json, file_path, published_at) "
            "VALUES (?, ?, ?, 'text', ?, ?, datetime('now'))",
            (title, type_, status, content_json, file_path),
        )
        return cur.lastrowid


def test_posts_require_auth(client):
    assert client.get("/api/app/posts").status_code == 401


def test_posts_empty_list(client, tokens):
    r = client.get("/api/app/posts", headers=_auth(tokens))
    assert r.status_code == 200
    assert r.json() == {"posts": []}


def test_posts_only_published_newest_first(client, tokens):
    _seed_post(title="Old")
    _seed_post(status="draft", title="Draft post")
    _seed_post(title="New")
    r = client.get("/api/app/posts", headers=_auth(tokens))
    titles = [p["title"] for p in r.json()["posts"]]
    assert "Draft post" not in titles
    assert titles[0] == "New"


def test_posts_filter_by_type_and_limit(client, tokens):
    for i in range(3):
        _seed_post(type_="stock_ideas", title=f"Idea {i}")
    _seed_post(type_="reports", title="Report")
    r = client.get("/api/app/posts?type=stock_ideas&limit=2", headers=_auth(tokens))
    posts = r.json()["posts"]
    assert len(posts) == 2
    assert all(p["type"] == "stock_ideas" for p in posts)


def test_post_detail_returns_full_content(client, tokens):
    post_id = _seed_post(title="Full post",
                         content_json='{"blocks":[{"type":"paragraph"}]}',
                         file_path="/uploads/files/report.pdf")
    r = client.get(f"/api/app/posts/{post_id}", headers=_auth(tokens))
    assert r.status_code == 200
    body = r.json()
    assert body["title"] == "Full post"
    assert body["content_json"] == '{"blocks":[{"type":"paragraph"}]}'
    assert body["file_path"] == "/uploads/files/report.pdf"


def test_post_detail_draft_is_404(client, tokens):
    post_id = _seed_post(status="draft", title="Hidden")
    r = client.get(f"/api/app/posts/{post_id}", headers=_auth(tokens))
    assert r.status_code == 404


def test_post_detail_requires_auth(client):
    assert client.get("/api/app/posts/1").status_code == 401


def test_language_change_persists(client, tokens):
    r = client.post("/api/app/me/language", headers=_auth(tokens),
                    json={"language": "en"})
    assert r.status_code == 204
    me = client.get("/api/app/me", headers=_auth(tokens)).json()
    assert me["language"] == "en"


def test_language_rejects_unknown(client, tokens):
    r = client.post("/api/app/me/language", headers=_auth(tokens),
                    json={"language": "de"})
    assert r.status_code == 422
