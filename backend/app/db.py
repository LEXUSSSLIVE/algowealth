import sqlite3

from .config import get_settings
from .security import hash_password

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    group_id TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'ru' CHECK (language IN ('ru', 'en')),
    token_version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS watchlist (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, symbol)
);

CREATE TABLE IF NOT EXISTS quote_cache (
    key TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    fetched_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    handled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('stock_ideas', 'reports')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    image_path TEXT,
    file_path TEXT,
    content_json TEXT,
    content_plain TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    published_at TEXT
);
"""


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(get_settings().db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA)


def create_user(email: str, password: str, group_id: str,
                role: str = "user", language: str = "ru") -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO users (email, password_hash, role, group_id, language) "
            "VALUES (?, ?, ?, ?, ?)",
            (email.strip().lower(), hash_password(password), role, group_id, language),
        )
        return cur.lastrowid


def get_user_by_email(email: str) -> sqlite3.Row | None:
    with get_conn() as conn:
        return conn.execute(
            "SELECT * FROM users WHERE email = ?", (email.strip().lower(),)
        ).fetchone()


def set_password(user_id: int, new_password: str) -> None:
    """Changing the password invalidates all issued tokens (token_version + 1)."""
    with get_conn() as conn:
        conn.execute(
            "UPDATE users SET password_hash = ?, token_version = token_version + 1 "
            "WHERE id = ?",
            (hash_password(new_password), user_id),
        )


def get_user_by_id(user_id: int) -> sqlite3.Row | None:
    with get_conn() as conn:
        return conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()


def list_watchlist(user_id: int) -> list[sqlite3.Row]:
    with get_conn() as conn:
        return conn.execute(
            "SELECT symbol, name, created_at FROM watchlist "
            "WHERE user_id = ? ORDER BY created_at, symbol",
            (user_id,),
        ).fetchall()


def add_watchlist(user_id: int, symbol: str, name: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO watchlist (user_id, symbol, name) VALUES (?, ?, ?) "
            "ON CONFLICT (user_id, symbol) DO UPDATE SET name = excluded.name",
            (user_id, symbol, name),
        )


def remove_watchlist(user_id: int, symbol: str) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM watchlist WHERE user_id = ? AND symbol = ?",
                     (user_id, symbol))


def add_password_reset_request(user_id: int) -> None:
    with get_conn() as conn:
        conn.execute("INSERT INTO password_reset_requests (user_id) VALUES (?)",
                     (user_id,))


def delete_user(email: str) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM users WHERE email = ?", (email.strip().lower(),))


def list_users() -> list[sqlite3.Row]:
    with get_conn() as conn:
        return conn.execute(
            "SELECT id, email, role, group_id, language, created_at FROM users ORDER BY id"
        ).fetchall()


def save_post(title: str, type_: str, status: str, content_json: str,
              content_plain: str, image_path: str | None = None,
              file_path: str | None = None, post_id: int | None = None) -> int:
    with get_conn() as conn:
        if post_id:
            conn.execute(
                "UPDATE posts SET title=?, type=?, status=?, content_json=?, "
                "content_plain=?, image_path=COALESCE(?, image_path), "
                "file_path=COALESCE(?, file_path), "
                "published_at=CASE WHEN ?='published' AND published_at IS NULL "
                "THEN datetime('now') ELSE published_at END WHERE id=?",
                (title, type_, status, content_json, content_plain,
                 image_path, file_path, status, post_id))
            return post_id
        cur = conn.execute(
            "INSERT INTO posts (title, type, status, content_json, content_plain, "
            "image_path, file_path, published_at) VALUES (?,?,?,?,?,?,?, "
            "CASE WHEN ?='published' THEN datetime('now') END)",
            (title, type_, status, content_json, content_plain,
             image_path, file_path, status))
        return cur.lastrowid


def get_post(post_id: int) -> sqlite3.Row | None:
    with get_conn() as conn:
        return conn.execute("SELECT * FROM posts WHERE id=?", (post_id,)).fetchone()


def delete_post(post_id: int) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM posts WHERE id=?", (post_id,))


def list_posts_admin(status: str | None) -> list[sqlite3.Row]:
    q = "SELECT id, title, type, status, created_at, published_at FROM posts"
    args: list = []
    if status:
        q += " WHERE status=?"
        args.append(status)
    q += " ORDER BY id DESC"
    with get_conn() as conn:
        return conn.execute(q, args).fetchall()


def list_reset_requests() -> list[sqlite3.Row]:
    with get_conn() as conn:
        return conn.execute(
            "SELECT r.id, r.created_at, r.handled, u.email FROM password_reset_requests r "
            "JOIN users u ON u.id = r.user_id ORDER BY r.id DESC"
        ).fetchall()


def mark_reset_handled(req_id: int) -> None:
    with get_conn() as conn:
        conn.execute("UPDATE password_reset_requests SET handled=1 WHERE id=?", (req_id,))


def purge_orphan_fin_stats() -> int:
    """Orphans in fin_stats (Go DB): group_id with no user in app.db. Returns the row count."""
    import os
    go_db = os.environ.get("ALGOWEALTH_GOAPI_DB")
    if not go_db:
        raise RuntimeError("ALGOWEALTH_GOAPI_DB is not set")
    with get_conn() as conn:
        groups = [r["group_id"] for r in conn.execute("SELECT DISTINCT group_id FROM users")]
    go = sqlite3.connect(go_db)
    try:
        ph = ",".join("?" for _ in groups) or "''"
        with go:
            cur = go.execute(
                f"DELETE FROM fin_stats WHERE group_id NOT IN ({ph})", groups)
            return cur.rowcount
    finally:
        go.close()


def set_language(user_id: int, language: str) -> None:
    with get_conn() as conn:
        conn.execute("UPDATE users SET language = ? WHERE id = ?",
                     (language, user_id))


def list_posts(type_: str | None, limit: int) -> list[sqlite3.Row]:
    q = ("SELECT id, title, type, image_path, published_at FROM posts "
         "WHERE status = 'published'")
    args: list = []
    if type_:
        q += " AND type = ?"
        args.append(type_)
    q += " ORDER BY published_at DESC, id DESC LIMIT ?"
    args.append(limit)
    with get_conn() as conn:
        return conn.execute(q, args).fetchall()


def get_published_post(post_id: int) -> sqlite3.Row | None:
    with get_conn() as conn:
        return conn.execute(
            "SELECT id, title, type, image_path, file_path, content_json, "
            "published_at FROM posts WHERE id = ? AND status = 'published'",
            (post_id,)).fetchone()


def cache_get(key: str) -> tuple[str, float] | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT payload, fetched_at FROM quote_cache WHERE key = ?", (key,)
        ).fetchone()
        return (row["payload"], row["fetched_at"]) if row else None


def cache_put(key: str, payload: str, fetched_at: float) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO quote_cache (key, payload, fetched_at) VALUES (?, ?, ?) "
            "ON CONFLICT (key) DO UPDATE SET payload = excluded.payload, "
            "fetched_at = excluded.fetched_at",
            (key, payload, fetched_at),
        )
