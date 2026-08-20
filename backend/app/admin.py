import json
import os
import secrets as pysecrets
import sqlite3
import uuid

import httpx
import jwt
from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates

from . import db, goapi, security

router = APIRouter(prefix="/admin")
templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))

COOKIE = "aw_admin"


class AdminRedirect(Exception):
    pass


def current_admin(request: Request) -> sqlite3.Row:
    token = request.cookies.get(COOKIE)
    if not token:
        raise AdminRedirect()
    try:
        payload = security.decode_token(token, "admin")
    except jwt.InvalidTokenError:
        raise AdminRedirect()
    user = db.get_user_by_id(int(payload["sub"]))
    if user is None or user["role"] != "admin" or user["token_version"] != payload["tv"]:
        raise AdminRedirect()
    return user


def _page(request: Request, name: str, **ctx):
    return templates.TemplateResponse(request, f"admin/{name}", ctx)


def _gen_password() -> str:
    return pysecrets.token_urlsafe(12)


@router.get("")
def admin_root(admin: sqlite3.Row = Depends(current_admin)):
    return RedirectResponse("/admin/upload", status_code=303)


@router.get("/login")
def login_page(request: Request, err: int = 0):
    return _page(request, "login.html", err=err)


@router.post("/login")
def login_submit(request: Request, email: str = Form(...), password: str = Form(...)):
    user = db.get_user_by_email(email)
    if (user is None or user["role"] != "admin"
            or not security.verify_password(password, user["password_hash"])):
        return RedirectResponse("/admin/login?err=1", status_code=303)
    resp = RedirectResponse("/admin/upload", status_code=303)
    resp.set_cookie(COOKIE, security.make_admin_token(user["id"], user["token_version"]),
                    httponly=True, samesite="lax", max_age=12 * 3600, path="/admin")
    return resp


@router.get("/logout")
def logout():
    resp = RedirectResponse("/admin/login", status_code=303)
    resp.delete_cookie(COOKIE, path="/admin")
    return resp


# ── Upload CSV ────────────────────────────────────────────────────────────────

@router.get("/upload")
def upload_page(request: Request, msg: str = "",
                admin: sqlite3.Row = Depends(current_admin)):
    return _page(request, "upload.html", active="upload", msg=msg,
                 users=db.list_users())


@router.post("/upload")
async def upload_submit(request: Request,
                        user_email: str = Form(...),
                        date: str = Form(""),
                        file: UploadFile = File(...),
                        admin: sqlite3.Row = Depends(current_admin),
                        client: httpx.AsyncClient = Depends(goapi.get_go_client)):
    target = db.get_user_by_email(user_email)
    if target is None:
        return RedirectResponse("/admin/upload?msg=No+such+user", status_code=303)
    content = await file.read()
    params = {"date": date} if date else {}
    async with client:
        try:
            r = await client.post(
                f"/api/{target['group_id']}/csv-upload", params=params,
                files={"csvfile": (file.filename or "data.csv", content, "text/csv")})
            body = r.text[:200]
            msg = f"Go API {r.status_code}: {body}"
        except httpx.HTTPError as e:
            msg = f"Network error: {e}"
    return RedirectResponse(f"/admin/upload?msg={httpx.QueryParams({'m': msg})['m']}",
                            status_code=303)


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users")
def users_page(request: Request, msg: str = "",
               admin: sqlite3.Row = Depends(current_admin)):
    return _page(request, "users.html", active="users", msg=msg,
                 users=db.list_users(), new_password=None, password_for=None)


@router.post("/users/create")
def users_create(request: Request, email: str = Form(...), group_id: str = Form(...),
                 language: str = Form("ru"),
                 admin: sqlite3.Row = Depends(current_admin)):
    password = _gen_password()
    db.create_user(email=email, password=password, group_id=group_id.strip(),
                   language=language)
    return _page(request, "users.html", active="users", msg="User created",
                 users=db.list_users(), new_password=password, password_for=email)


@router.post("/users/reset")
def users_reset(request: Request, email: str = Form(...),
                admin: sqlite3.Row = Depends(current_admin)):
    user = db.get_user_by_email(email)
    if user is None:
        return _page(request, "users.html", active="users", msg="No such user",
                     users=db.list_users(), new_password=None, password_for=None)
    password = _gen_password()
    db.set_password(user["id"], password)
    return _page(request, "users.html", active="users", msg="Password reset",
                 users=db.list_users(), new_password=password, password_for=email)


@router.post("/users/delete")
def users_delete(request: Request, email: str = Form(...),
                 admin: sqlite3.Row = Depends(current_admin)):
    db.delete_user(email)
    return _page(request, "users.html", active="users", msg=f"{email} deleted",
                 users=db.list_users(), new_password=None, password_for=None)


@router.post("/users/purge")
def users_purge(request: Request, admin: sqlite3.Row = Depends(current_admin)):
    try:
        n = db.purge_orphan_fin_stats()
        msg = f"Orphaned rows purged: {n}"
    except Exception as e:
        msg = f"Error: {e}"
    return _page(request, "users.html", active="users", msg=msg,
                 users=db.list_users(), new_password=None, password_for=None)


# ── Blog ──────────────────────────────────────────────────────────────────────

def _plain_from_blocks(content_json: str) -> str:
    try:
        blocks = json.loads(content_json).get("blocks", [])
    except (json.JSONDecodeError, AttributeError):
        return ""
    parts = []
    for b in blocks:
        data = b.get("data", {})
        if "text" in data:
            parts.append(data["text"])
        for item in data.get("items", []):
            parts.append(item if isinstance(item, str) else str(item.get("content", "")))
    import re
    return re.sub(r"<[^>]+>", "", "\n".join(parts))


def _save_upload(file: UploadFile | None, subdir: str) -> str | None:
    if file is None or not file.filename:
        return None
    root = os.environ.get("ALGOWEALTH_UPLOADS", "/data/uploads")
    os.makedirs(os.path.join(root, subdir), exist_ok=True)
    ext = os.path.splitext(file.filename)[1][:10]
    rel = f"{subdir}/{uuid.uuid4().hex}{ext}"
    with open(os.path.join(root, rel), "wb") as f:
        f.write(file.file.read())
    return f"/uploads/{rel}"


@router.get("/posts")
def posts_page(request: Request, filter: str = "",
               admin: sqlite3.Row = Depends(current_admin)):
    return _page(request, "posts.html", active="posts", filter=filter,
                 posts=db.list_posts_admin(filter or None))


@router.get("/posts/new")
def post_new(request: Request, admin: sqlite3.Row = Depends(current_admin)):
    return _page(request, "post_form.html", active="posts", post=None,
                 content_json="")


@router.get("/posts/edit/{post_id}")
def post_edit(request: Request, post_id: int,
              admin: sqlite3.Row = Depends(current_admin)):
    post = db.get_post(post_id)
    if post is None:
        return RedirectResponse("/admin/posts", status_code=303)
    return _page(request, "post_form.html", active="posts", post=post,
                 content_json=post["content_json"] or "")


@router.post("/posts/save")
async def post_save(request: Request,
                    title: str = Form(...),
                    type: str = Form("reports"),
                    action: str = Form("draft"),
                    content_json: str = Form(""),
                    post_id: str = Form(""),
                    image: UploadFile | None = File(None),
                    attachment: UploadFile | None = File(None),
                    admin: sqlite3.Row = Depends(current_admin)):
    status = "published" if action == "publish" else "draft"
    db.save_post(
        title=title.strip(), type_=type, status=status,
        content_json=content_json, content_plain=_plain_from_blocks(content_json),
        image_path=_save_upload(image, "images"),
        file_path=_save_upload(attachment, "files"),
        post_id=int(post_id) if post_id.strip() else None)
    return RedirectResponse("/admin/posts", status_code=303)


@router.post("/posts/delete")
def post_delete(request: Request, post_id: str = Form(...),
                admin: sqlite3.Row = Depends(current_admin)):
    db.delete_post(int(post_id))
    return RedirectResponse("/admin/posts", status_code=303)


# ── Password reset requests ────────────────────────────────────────────────────

@router.get("/resets")
def resets_page(request: Request, admin: sqlite3.Row = Depends(current_admin)):
    return _page(request, "resets.html", active="resets",
                 requests=db.list_reset_requests(), new_password=None,
                 password_for=None)


@router.post("/resets/handle")
def resets_handle(request: Request, req_id: str = Form(...), email: str = Form(...),
                  admin: sqlite3.Row = Depends(current_admin)):
    user = db.get_user_by_email(email)
    password = None
    if user is not None:
        password = _gen_password()
        db.set_password(user["id"], password)
        db.mark_reset_handled(int(req_id))
    return _page(request, "resets.html", active="resets",
                 requests=db.list_reset_requests(), new_password=password,
                 password_for=email)
