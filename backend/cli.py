"""User management (run on the server: docker compose exec api python cli.py ...)."""
import argparse
import secrets

from app import db


def _gen_password() -> str:
    return secrets.token_urlsafe(12)


def cmd_create_user(args):
    password = args.password or _gen_password()
    db.init_db()
    db.create_user(email=args.email, password=password, group_id=args.group_id,
                   role=args.role, language=args.language)
    print(f"created: {args.email}  group_id={args.group_id}  role={args.role}")
    print(f"password: {password}")


def cmd_set_password(args):
    user = db.get_user_by_email(args.email)
    if user is None:
        raise SystemExit(f"no such user: {args.email}")
    password = args.password or _gen_password()
    db.set_password(user["id"], password)
    print(f"new password for {args.email}: {password}")


def cmd_list_users(args):
    with db.get_conn() as conn:
        for row in conn.execute("SELECT id, email, role, group_id, language, created_at FROM users"):
            print(dict(row))


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(required=True)

    c = sub.add_parser("create-user")
    c.add_argument("--email", required=True)
    c.add_argument("--group-id", required=True)
    c.add_argument("--role", default="user", choices=["user", "admin"])
    c.add_argument("--language", default="ru", choices=["ru", "en"])
    c.add_argument("--password")
    c.set_defaults(func=cmd_create_user)

    s = sub.add_parser("set-password")
    s.add_argument("--email", required=True)
    s.add_argument("--password")
    s.set_defaults(func=cmd_set_password)

    l = sub.add_parser("list-users")
    l.set_defaults(func=cmd_list_users)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
