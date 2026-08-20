import json

import httpx
import pytest

from tests.conftest import TEST_GROUP

BALANCE_FIXTURE = {"balance": 12345.67, "history": [{"date": "2024-12-15", "value": 12345.67}]}


@pytest.fixture()
def go_calls(client):
    """Replaces the Go API with a mock; records every request that reaches it."""
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if request.url.path.endswith("/balance"):
            return httpx.Response(200, json=BALANCE_FIXTURE)
        return httpx.Response(200, json={"ok": True, "path": request.url.path})

    from app import goapi
    from app.main import create_app
    app = client.app
    app.dependency_overrides[goapi.get_go_client] = lambda: httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="http://go-test")
    yield calls
    app.dependency_overrides.pop(goapi.get_go_client, None)


def _auth(tokens):
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def test_portfolio_requires_auth(client):
    r = client.get("/api/app/portfolio/balance")
    assert r.status_code == 401


def test_balance_proxies_with_user_group(client, tokens, go_calls, monkeypatch):
    monkeypatch.setenv("ALGOWEALTH_GO_API_KEY", "go-secret")
    r = client.get("/api/app/portfolio/balance?days=30", headers=_auth(tokens))
    assert r.status_code == 200
    assert r.json() == BALANCE_FIXTURE
    assert len(go_calls) == 1
    req = go_calls[0]
    assert req.url.path == f"/api/{TEST_GROUP}/balance"
    assert req.url.params["days"] == "30"


def test_go_client_sends_api_key_from_env(monkeypatch):
    monkeypatch.setenv("ALGOWEALTH_GO_API_KEY", "go-secret")
    from app import goapi
    c = goapi.get_go_client()
    assert c.headers["X-API-Key"] == "go-secret"


def test_go_client_without_key_raises(monkeypatch):
    monkeypatch.delenv("ALGOWEALTH_GO_API_KEY", raising=False)
    from app import goapi
    with pytest.raises(RuntimeError):
        goapi.get_go_client()


def test_multi_bank_params_forwarded(client, tokens, go_calls, monkeypatch):
    # The Go API reads bank=/type= (singular) — see filtersFromRequest
    monkeypatch.setenv("ALGOWEALTH_GO_API_KEY", "go-secret")
    r = client.get("/api/app/portfolio/balance?days=7&bank=A&bank=B&type=Cash",
                   headers=_auth(tokens))
    assert r.status_code == 200
    assert go_calls[0].url.params.get_list("bank") == ["A", "B"]
    assert go_calls[0].url.params.get_list("type") == ["Cash"]


def test_non_whitelisted_param_is_dropped(client, tokens, go_calls, monkeypatch):
    monkeypatch.setenv("ALGOWEALTH_GO_API_KEY", "go-secret")
    client.get("/api/app/portfolio/balance?days=7&groupID=hacker&evil=1",
               headers=_auth(tokens))
    assert "groupID" not in go_calls[0].url.params
    assert "evil" not in go_calls[0].url.params


def test_unknown_subpath_is_404(client, tokens, go_calls):
    r = client.get("/api/app/portfolio/secret-stuff", headers=_auth(tokens))
    assert r.status_code == 404
    assert go_calls == []


def test_go_network_error_is_502(client, tokens, monkeypatch):
    monkeypatch.setenv("ALGOWEALTH_GO_API_KEY", "go-secret")

    def handler(request):
        raise httpx.ConnectError("boom")

    from app import goapi
    client.app.dependency_overrides[goapi.get_go_client] = lambda: httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="http://go-test")
    r = client.get("/api/app/portfolio/balance", headers=_auth(tokens))
    client.app.dependency_overrides.pop(goapi.get_go_client, None)
    assert r.status_code == 502


def test_csv_upload_non_admin_is_403(client, go_calls, monkeypatch):
    monkeypatch.setenv("ALGOWEALTH_GO_API_KEY", "go-secret")
    from app.db import create_user
    create_user(email="plain@test.io", password="plain-pass-1", group_id="g-plain")
    tokens = client.post("/api/app/auth/login",
                         json={"email": "plain@test.io",
                               "password": "plain-pass-1"}).json()
    r = client.post("/api/app/portfolio/csv-upload?user_email=plain@test.io",
                    headers=_auth(tokens),
                    files={"file": ("s.csv", b"a;b\n", "text/csv")})
    assert r.status_code == 403
    assert go_calls == []


def test_csv_upload_admin_targets_chosen_user(client, tokens, go_calls, monkeypatch):
    monkeypatch.setenv("ALGOWEALTH_GO_API_KEY", "go-secret")
    from app.db import create_user
    create_user(email="target@test.io", password="target-pass-1", group_id="g-target")
    r = client.post(
        "/api/app/portfolio/csv-upload?user_email=target@test.io&date=2026-08-07",
        headers=_auth(tokens),
        files={"file": ("s.csv", b"a;b\n", "text/csv")})
    assert r.status_code == 200
    req = go_calls[0]
    assert req.url.path == "/api/g-target/csv-upload"
    assert req.url.params["date"] == "2026-08-07"
    assert b"a;b" in req.read()


def test_csv_upload_unknown_target_is_404(client, tokens, go_calls, monkeypatch):
    monkeypatch.setenv("ALGOWEALTH_GO_API_KEY", "go-secret")
    r = client.post("/api/app/portfolio/csv-upload?user_email=ghost@test.io",
                    headers=_auth(tokens),
                    files={"file": ("s.csv", b"a;b\n", "text/csv")})
    assert r.status_code == 404
    assert go_calls == []
