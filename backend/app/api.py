import sqlite3
from typing import Literal

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from . import db, notify, security

router = APIRouter(prefix="/api/app")

INVALID_CREDENTIALS = "Invalid email or password"
NOT_AUTHENTICATED = "Not authenticated"

bearer = HTTPBearer(auto_error=False)


def current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> sqlite3.Row:
    if cred is None:
        raise HTTPException(status_code=401, detail=NOT_AUTHENTICATED)
    try:
        payload = security.decode_token(cred.credentials, "access")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail=NOT_AUTHENTICATED)
    user = db.get_user_by_id(int(payload["sub"]))
    if user is None or user["token_version"] != payload["tv"]:
        raise HTTPException(status_code=401, detail=NOT_AUTHENTICATED)
    return user


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8)


class WatchlistAddRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=12)
    name: str = ""


class LanguageRequest(BaseModel):
    language: Literal["ru", "en"]


class DeleteAccountRequest(BaseModel):
    password: str


def _user_public(user) -> dict:
    return {"email": user["email"], "group_id": user["group_id"],
            "role": user["role"], "language": user["language"]}


def _token_pair(user) -> dict:
    return {
        "access_token": security.make_access_token(user["id"], user["token_version"]),
        "refresh_token": security.make_refresh_token(user["id"], user["token_version"]),
        "token_type": "bearer",
    }


@router.get("/health")
def health():
    return {"status": "ok"}


@router.post("/auth/login")
def login(body: LoginRequest):
    user = db.get_user_by_email(body.email)
    if user is None or not security.verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail=INVALID_CREDENTIALS)
    return {**_token_pair(user), "user": _user_public(user)}


@router.post("/auth/refresh")
def refresh(body: RefreshRequest):
    try:
        payload = security.decode_token(body.refresh_token, "refresh")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail=NOT_AUTHENTICATED)
    user = db.get_user_by_id(int(payload["sub"]))
    if user is None or user["token_version"] != payload["tv"]:
        raise HTTPException(status_code=401, detail=NOT_AUTHENTICATED)
    return _token_pair(user)


class ForgotPasswordRequest(BaseModel):
    email: str


@router.post("/auth/forgot-password", status_code=204)
def forgot_password(body: ForgotPasswordRequest):
    """Always responds 204 — never disclose whether the email exists (SPEC §5.3)."""
    user = db.get_user_by_email(body.email)
    if user is not None:
        db.add_password_reset_request(user["id"])
        notify.send_tg(f"AlgoWealth: user {user['email']} requested a password reset.\n"
                       f"Admin panel: /admin/resets")


@router.post("/auth/change-password", status_code=204)
def change_password(body: ChangePasswordRequest,
                    user: sqlite3.Row = Depends(current_user)):
    if not security.verify_password(body.old_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    db.set_password(user["id"], body.new_password)


@router.get("/me")
def me(user: sqlite3.Row = Depends(current_user)):
    return _user_public(user)


@router.post("/me/language", status_code=204)
def change_language(body: LanguageRequest,
                    user: sqlite3.Row = Depends(current_user)):
    db.set_language(user["id"], body.language)


@router.post("/me/delete", status_code=204)
def delete_account(body: DeleteAccountRequest,
                   user: sqlite3.Row = Depends(current_user)):
    """App Store requirement. fin_stats rows are left orphaned (purged via the admin panel)."""
    if not security.verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid password")
    db.delete_user(user["email"])


@router.get("/posts")
def posts(type: str | None = None, limit: int = 20,
          user: sqlite3.Row = Depends(current_user)):
    return {"posts": [dict(row) for row in db.list_posts(type, min(limit, 50))]}


@router.get("/posts/{post_id}")
def post_detail(post_id: int, user: sqlite3.Row = Depends(current_user)):
    row = db.get_published_post(post_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return dict(row)


@router.get("/watchlist")
def watchlist(user: sqlite3.Row = Depends(current_user)):
    return [dict(row) for row in db.list_watchlist(user["id"])]


@router.post("/watchlist", status_code=201)
def watchlist_add(body: WatchlistAddRequest,
                  user: sqlite3.Row = Depends(current_user)):
    db.add_watchlist(user["id"], body.symbol.strip().upper(), body.name.strip())
    return {"status": "ok"}


@router.delete("/watchlist/{symbol}", status_code=204)
def watchlist_remove(symbol: str, user: sqlite3.Row = Depends(current_user)):
    db.remove_watchlist(user["id"], symbol.strip().upper())
