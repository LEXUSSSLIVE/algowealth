import pytest


class FakeProvider:
    def __init__(self):
        self.quote_calls = []
        self.search_calls = []
        self.chart_calls = []
        self.stats_calls = []
        self.fail = False
        self.stats_empty = False

    def fetch_quotes(self, symbols):
        self.quote_calls.append(list(symbols))
        if self.fail:
            raise RuntimeError("yahoo down")
        return [{"symbol": s, "name": f"{s} Inc.", "price": 100.0,
                 "change": 1.5, "change_percent": 1.52, "currency": "USD"}
                for s in symbols]

    def fetch_search(self, q):
        self.search_calls.append(q)
        if self.fail:
            raise RuntimeError("yahoo down")
        return [{"symbol": "AAPL", "shortname": "Apple Inc.",
                 "exchange": "NMS", "type": "EQUITY"}]

    def fetch_chart(self, symbol, range_, interval):
        self.chart_calls.append((symbol, range_, interval))
        if self.fail:
            raise RuntimeError("yahoo down")
        return {"symbol": symbol, "timestamps": [1, 2, 3],
                "prices": [10.0, 11.0, 12.0], "currency": "USD"}

    def fetch_stats(self, symbol):
        self.stats_calls.append(symbol)
        if self.fail:
            raise RuntimeError("yahoo down")
        if self.stats_empty:
            return {"symbol": symbol, "pe": None, "eps": None, "book_value": None}
        return {"symbol": symbol, "market_cap": 3_000_000_000_000, "pe": 25.92,
                "forward_pe": 24.1, "eps": 7.54, "book_value": 25.61,
                "price_to_book": 7.6, "dividend_yield_pct": 0.44, "beta": 1.24,
                "high_52w": 237.23, "low_52w": 164.08, "profit_margin_pct": 24.3,
                "roe_pct": 147.25, "revenue": 391_000_000_000}


@pytest.fixture()
def provider(client):
    from app import quotes
    fake = FakeProvider()
    client.app.dependency_overrides[quotes.get_provider] = lambda: fake
    yield fake
    client.app.dependency_overrides.pop(quotes.get_provider, None)


def _auth(tokens):
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def test_quotes_require_auth(client):
    assert client.get("/api/app/quotes?symbols=AAPL").status_code == 401


def test_quotes_fetch_and_shape(client, tokens, provider):
    r = client.get("/api/app/quotes?symbols=AAPL,MSFT", headers=_auth(tokens))
    assert r.status_code == 200
    body = r.json()
    assert body["stale"] is False
    assert [q["symbol"] for q in body["quotes"]] == ["AAPL", "MSFT"]
    assert provider.quote_calls == [["AAPL", "MSFT"]]


def test_quotes_within_ttl_hit_cache(client, tokens, provider):
    client.get("/api/app/quotes?symbols=AAPL", headers=_auth(tokens))
    r = client.get("/api/app/quotes?symbols=AAPL", headers=_auth(tokens))
    assert r.status_code == 200
    assert provider.quote_calls == [["AAPL"]]


def test_quotes_after_ttl_refetch(client, tokens, provider, monkeypatch):
    from app import quotes
    client.get("/api/app/quotes?symbols=AAPL", headers=_auth(tokens))
    real_now = quotes._now()
    monkeypatch.setattr(quotes, "_now", lambda: real_now + 999)
    client.get("/api/app/quotes?symbols=AAPL", headers=_auth(tokens))
    assert provider.quote_calls == [["AAPL"], ["AAPL"]]


def test_quotes_partial_cache_fetches_only_missing(client, tokens, provider):
    client.get("/api/app/quotes?symbols=AAPL", headers=_auth(tokens))
    r = client.get("/api/app/quotes?symbols=AAPL,MSFT", headers=_auth(tokens))
    assert r.status_code == 200
    assert [q["symbol"] for q in r.json()["quotes"]] == ["AAPL", "MSFT"]
    assert provider.quote_calls == [["AAPL"], ["MSFT"]]


def test_quotes_provider_error_with_cache_is_stale(client, tokens, provider, monkeypatch):
    from app import quotes
    client.get("/api/app/quotes?symbols=AAPL", headers=_auth(tokens))
    real_now = quotes._now()
    monkeypatch.setattr(quotes, "_now", lambda: real_now + 999)
    provider.fail = True
    r = client.get("/api/app/quotes?symbols=AAPL", headers=_auth(tokens))
    assert r.status_code == 200
    assert r.json()["stale"] is True
    assert r.json()["quotes"][0]["symbol"] == "AAPL"


def test_quotes_provider_error_without_cache_is_502(client, tokens, provider):
    provider.fail = True
    r = client.get("/api/app/quotes?symbols=AAPL", headers=_auth(tokens))
    assert r.status_code == 502


def test_quotes_symbols_normalized_and_required(client, tokens, provider):
    r = client.get("/api/app/quotes?symbols= aapl , msft ", headers=_auth(tokens))
    assert [q["symbol"] for q in r.json()["quotes"]] == ["AAPL", "MSFT"]
    assert client.get("/api/app/quotes?symbols=", headers=_auth(tokens)).status_code == 422


def test_search_caches_by_query(client, tokens, provider):
    r1 = client.get("/api/app/search?q=app", headers=_auth(tokens))
    r2 = client.get("/api/app/search?q=app", headers=_auth(tokens))
    assert r1.status_code == r2.status_code == 200
    assert r1.json()["results"][0]["symbol"] == "AAPL"
    assert provider.search_calls == ["app"]


def test_chart_happy_path_and_cache(client, tokens, provider):
    r1 = client.get("/api/app/chart?symbol=AAPL&range=1d&interval=5m",
                    headers=_auth(tokens))
    r2 = client.get("/api/app/chart?symbol=AAPL&range=1d&interval=5m",
                    headers=_auth(tokens))
    assert r1.status_code == r2.status_code == 200
    assert r1.json()["chart"]["prices"] == [10.0, 11.0, 12.0]
    assert provider.chart_calls == [("AAPL", "1d", "5m")]


def test_chart_rejects_bad_range_or_interval(client, tokens, provider):
    bad1 = client.get("/api/app/chart?symbol=AAPL&range=99y&interval=5m",
                      headers=_auth(tokens))
    bad2 = client.get("/api/app/chart?symbol=AAPL&range=1d&interval=7s",
                      headers=_auth(tokens))
    assert bad1.status_code == 422
    assert bad2.status_code == 422
    assert provider.chart_calls == []


def test_stats_require_auth(client):
    assert client.get("/api/app/stats?symbol=AAPL").status_code == 401


def test_stats_happy_path_and_cache(client, tokens, provider):
    r1 = client.get("/api/app/stats?symbol=aapl", headers=_auth(tokens))
    r2 = client.get("/api/app/stats?symbol=AAPL", headers=_auth(tokens))
    assert r1.status_code == r2.status_code == 200
    body = r1.json()["stats"]
    assert body["symbol"] == "AAPL"
    assert body["pe"] == 25.92
    assert body["market_cap"] == 3_000_000_000_000
    assert body["dividend_yield_pct"] == 0.44
    assert provider.stats_calls == ["AAPL"]


def test_stats_index_returns_nulls(client, tokens, provider):
    provider.stats_empty = True
    r = client.get("/api/app/stats?symbol=^DJI", headers=_auth(tokens))
    assert r.status_code == 200
    body = r.json()["stats"]
    assert body["pe"] is None and body["eps"] is None
    assert body["book_value"] is None
