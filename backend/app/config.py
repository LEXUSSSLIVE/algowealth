import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    db_path: str
    jwt_secret: str
    access_ttl_min: int = 15
    refresh_ttl_days: int = 60


def get_settings() -> Settings:
    secret = os.environ.get("ALGOWEALTH_JWT_SECRET")
    if not secret:
        raise RuntimeError("ALGOWEALTH_JWT_SECRET is not set")
    if len(secret.encode("utf-8")) < 32:
        raise RuntimeError("ALGOWEALTH_JWT_SECRET must be at least 32 bytes (RFC 7518)")
    return Settings(
        db_path=os.environ.get("ALGOWEALTH_DB", "/data/app.db"),
        jwt_secret=secret,
        access_ttl_min=int(os.environ.get("ALGOWEALTH_ACCESS_TTL_MIN", "15")),
        refresh_ttl_days=int(os.environ.get("ALGOWEALTH_REFRESH_TTL_DAYS", "60")),
    )
