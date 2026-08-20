import json
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, HTTPException

from . import db
from .api import current_user

router = APIRouter(prefix="/api/app")

TTL_QUOTES = 120
TTL_SEARCH = 86400
TTL_CHART = 900
TTL_STATS = 86400
MAX_SYMBOLS = 50

RANGES = {"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"}
INTERVALS = {"1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h", "1d", "5d", "1wk", "1mo"}

QUOTES_UNAVAILABLE = "Quotes are temporarily unavailable"


def _now() -> float:
    return time.time()


class YahooProvider:
    """Production source: yfinance."""

    def fetch_quotes(self, symbols: list[str]) -> list[dict]:
        import yfinance as yf

        def one(sym: str) -> dict | None:
            try:
                info = yf.Ticker(sym).fast_info
                price = info["last_price"]
                prev = info["previous_close"]
                if price is None or prev is None:
                    return None
                change = price - prev
                return {
                    "symbol": sym,
                    "name": "",
                    "price": round(float(price), 4),
                    "change": round(float(change), 4),
                    "change_percent": round(float(change / prev * 100), 2) if prev else 0.0,
                    "currency": info.get("currency") or "USD",
                    "exchange": info.get("exchange") or "",
                }
            except Exception:
                return None

        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(one, symbols))
        quotes = [q for q in results if q is not None]
        if not quotes:
            raise RuntimeError("yahoo: no quotes fetched")
        return quotes

    def fetch_search(self, q: str) -> list[dict]:
        import yfinance as yf
        found = yf.Search(q, max_results=10).quotes
        return [{
            "symbol": item.get("symbol", ""),
            "shortname": item.get("shortname") or item.get("longname") or "",
            "exchange": item.get("exchange", ""),
            "type": item.get("quoteType", ""),
        } for item in found if item.get("symbol")]

    def fetch_chart(self, symbol: str, range_: str, interval: str) -> dict:
        import yfinance as yf
        hist = yf.Ticker(symbol).history(period=range_, interval=interval)
        if hist.empty:
            raise RuntimeError(f"yahoo: empty chart for {symbol}")
        return {
            "symbol": symbol,
            "timestamps": [int(ts.timestamp()) for ts in hist.index],
            "prices": [round(float(p), 4) for p in hist["Close"]],
        }

    def fetch_stats(self, symbol: str) -> dict:
        """Fundamentals for Market Stats. Indices (^DJI) have no fields → None."""
        import yfinance as yf
        info = yf.Ticker(symbol).info or {}

        def num(key: str, digits: int = 2) -> float | None:
            v = info.get(key)
            return round(float(v), digits) if isinstance(v, (int, float)) else None

        def frac_pct(key: str) -> float | None:
            """Ratio fields (0.2762 = 27.62%) → always × 100."""
            v = info.get(key)
            return round(float(v) * 100, 2) if isinstance(v, (int, float)) else None

        return {
            "symbol": symbol,
            "market_cap": num("marketCap", 0),
            "pe": num("trailingPE"),
            "forward_pe": num("forwardPE"),
            "eps": num("trailingEps"),
            "book_value": num("bookValue"),
            "price_to_book": num("priceToBook"),
            # dividendYield in current yfinance is already a percentage (0.34 = 0.34%)
            "dividend_yield_pct": num("dividendYield"),
            "beta": num("beta"),
            "high_52w": num("fiftyTwoWeekHigh"),
            "low_52w": num("fiftyTwoWeekLow"),
            "profit_margin_pct": frac_pct("profitMargins"),
            "roe_pct": frac_pct("returnOnEquity"),
            "revenue": num("totalRevenue", 0),
        }


_provider = YahooProvider()


def get_provider():
    return _provider


def _cache_fresh(key: str, ttl: int) -> dict | None:
    hit = db.cache_get(key)
    if hit and _now() - hit[1] < ttl:
        return json.loads(hit[0])
    return None


def _cache_any(key: str) -> dict | None:
    hit = db.cache_get(key)
    return json.loads(hit[0]) if hit else None


def _cached_fetch(key: str, ttl: int, fetch):
    """Returns (payload, stale). Fresh cache → no Yahoo round-trip;
    a Yahoo error with any (even expired) cache → cache + stale=true."""
    fresh = _cache_fresh(key, ttl)
    if fresh is not None:
        return fresh, False
    try:
        payload = fetch()
    except Exception:
        old = _cache_any(key)
        if old is not None:
            return old, True
        raise HTTPException(status_code=502, detail=QUOTES_UNAVAILABLE)
    db.cache_put(key, json.dumps(payload), _now())
    return payload, False


@router.get("/quotes")
def quotes(symbols: str, user: sqlite3.Row = Depends(current_user),
           provider=Depends(get_provider)):
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not syms:
        raise HTTPException(status_code=422, detail="No tickers provided")
    syms = list(dict.fromkeys(syms))[:MAX_SYMBOLS]

    by_symbol: dict[str, dict] = {}
    to_fetch = []
    for sym in syms:
        cached = _cache_fresh(f"q:{sym}", TTL_QUOTES)
        if cached is not None:
            by_symbol[sym] = cached
        else:
            to_fetch.append(sym)

    stale = False
    if to_fetch:
        try:
            fetched = provider.fetch_quotes(to_fetch)
            now = _now()
            for q in fetched:
                by_symbol[q["symbol"]] = q
                db.cache_put(f"q:{q['symbol']}", json.dumps(q), now)
        except Exception:
            for sym in to_fetch:
                old = _cache_any(f"q:{sym}")
                if old is not None:
                    by_symbol[sym] = old
            stale = True

    result = [by_symbol[s] for s in syms if s in by_symbol]
    if not result:
        raise HTTPException(status_code=502, detail=QUOTES_UNAVAILABLE)
    return {"quotes": result, "stale": stale}


@router.get("/search")
def search(q: str, user: sqlite3.Row = Depends(current_user),
           provider=Depends(get_provider)):
    q = q.strip()
    if not q:
        raise HTTPException(status_code=422, detail="Empty query")
    payload, stale = _cached_fetch(f"s:{q.lower()}", TTL_SEARCH,
                                   lambda: provider.fetch_search(q))
    return {"results": payload, "stale": stale}


@router.get("/stats")
def stats(symbol: str, user: sqlite3.Row = Depends(current_user),
          provider=Depends(get_provider)):
    sym = symbol.strip().upper()
    if not sym:
        raise HTTPException(status_code=422, detail="No ticker provided")
    payload, stale = _cached_fetch(f"st:{sym}", TTL_STATS,
                                   lambda: provider.fetch_stats(sym))
    return {"stats": payload, "stale": stale}


@router.get("/chart")
def chart(symbol: str, range: str = "1d", interval: str = "5m",
          user: sqlite3.Row = Depends(current_user),
          provider=Depends(get_provider)):
    sym = symbol.strip().upper()
    if not sym:
        raise HTTPException(status_code=422, detail="No ticker provided")
    if range not in RANGES:
        raise HTTPException(status_code=422, detail=f"range must be one of {sorted(RANGES)}")
    if interval not in INTERVALS:
        raise HTTPException(status_code=422, detail=f"interval must be one of {sorted(INTERVALS)}")
    payload, stale = _cached_fetch(
        f"c:{sym}:{range}:{interval}", TTL_CHART,
        lambda: provider.fetch_chart(sym, range, interval))
    return {"chart": payload, "stale": stale}
