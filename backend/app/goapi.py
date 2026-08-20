import os

import httpx


def get_go_client() -> httpx.AsyncClient:
    """Client for the Go finance_track_server. The X-API-Key lives only here, server-side."""
    api_key = os.environ.get("ALGOWEALTH_GO_API_KEY", "")
    if not api_key:
        raise RuntimeError("ALGOWEALTH_GO_API_KEY is not set")
    base = os.environ.get("ALGOWEALTH_GO_API", "http://host.docker.internal:8088")
    return httpx.AsyncClient(base_url=base, headers={"X-API-Key": api_key},
                             timeout=15.0)
