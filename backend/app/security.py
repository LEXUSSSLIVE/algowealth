import datetime as dt

import bcrypt
import jwt

from .config import get_settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))


def _make_token(user_id: int, token_version: int, token_type: str,
                lifetime: dt.timedelta) -> str:
    s = get_settings()
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "tv": token_version,
        "iat": now,
        "exp": now + lifetime,
    }
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256")


def make_access_token(user_id: int, token_version: int) -> str:
    s = get_settings()
    return _make_token(user_id, token_version, "access",
                       dt.timedelta(minutes=s.access_ttl_min))


def make_refresh_token(user_id: int, token_version: int) -> str:
    s = get_settings()
    return _make_token(user_id, token_version, "refresh",
                       dt.timedelta(days=s.refresh_ttl_days))


def make_admin_token(user_id: int, token_version: int) -> str:
    return _make_token(user_id, token_version, "admin", dt.timedelta(hours=12))


def decode_token(token: str, expected_type: str) -> dict:
    """Returns the payload; raises jwt.InvalidTokenError on any problem."""
    payload = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("wrong token type")
    return payload
