def _auth(tokens):
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def test_watchlist_requires_auth(client):
    assert client.get("/api/app/watchlist").status_code == 401


def test_empty_watchlist_is_empty_list(client, tokens):
    r = client.get("/api/app/watchlist", headers=_auth(tokens))
    assert r.status_code == 200
    assert r.json() == []


def test_add_and_list(client, tokens):
    r = client.post("/api/app/watchlist", headers=_auth(tokens),
                    json={"symbol": "AAPL", "name": "Apple Inc."})
    assert r.status_code == 201
    items = client.get("/api/app/watchlist", headers=_auth(tokens)).json()
    assert len(items) == 1
    assert items[0]["symbol"] == "AAPL"
    assert items[0]["name"] == "Apple Inc."


def test_add_same_symbol_twice_keeps_one(client, tokens):
    client.post("/api/app/watchlist", headers=_auth(tokens),
                json={"symbol": "AAPL", "name": "Apple Inc."})
    r = client.post("/api/app/watchlist", headers=_auth(tokens),
                    json={"symbol": "AAPL", "name": "Apple Inc."})
    assert r.status_code in (200, 201)
    assert len(client.get("/api/app/watchlist", headers=_auth(tokens)).json()) == 1


def test_symbol_is_normalized_to_uppercase(client, tokens):
    client.post("/api/app/watchlist", headers=_auth(tokens),
                json={"symbol": "msft", "name": "Microsoft"})
    items = client.get("/api/app/watchlist", headers=_auth(tokens)).json()
    assert items[0]["symbol"] == "MSFT"


def test_delete_removes_symbol(client, tokens):
    client.post("/api/app/watchlist", headers=_auth(tokens),
                json={"symbol": "AAPL", "name": "Apple Inc."})
    r = client.delete("/api/app/watchlist/AAPL", headers=_auth(tokens))
    assert r.status_code == 204
    assert client.get("/api/app/watchlist", headers=_auth(tokens)).json() == []


def test_delete_missing_symbol_is_204(client, tokens):
    r = client.delete("/api/app/watchlist/GHOST", headers=_auth(tokens))
    assert r.status_code == 204


def test_watchlists_are_isolated_between_users(client, tokens):
    from app.db import create_user
    client.post("/api/app/watchlist", headers=_auth(tokens),
                json={"symbol": "AAPL", "name": "Apple Inc."})
    create_user(email="other@test.io", password="other-pass-1", group_id="g-other")
    other = client.post("/api/app/auth/login",
                        json={"email": "other@test.io",
                              "password": "other-pass-1"}).json()
    assert client.get("/api/app/watchlist", headers=_auth(other)).json() == []
