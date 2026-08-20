#!/usr/bin/env python3
"""Uploads a directory of daily portfolio CSVs (YYYY-MM-DD.csv) to the portfolio API.

Usage:
  python3 upload_history.py --api http://localhost:8088/api --key <API_KEY> \
      --group my-portfolio --dir demo_history

Pairs with gen_demo_history.py: generate the snapshots, then upload them all.
Stdlib only — no dependencies.
"""
import argparse
import pathlib
import sys
import urllib.request
import uuid

p = argparse.ArgumentParser()
p.add_argument("--api", required=True, help="portfolio API base, e.g. http://localhost:8088/api")
p.add_argument("--key", required=True, help="X-API-Key value")
p.add_argument("--group", required=True, help="group id to upload into")
p.add_argument("--dir", required=True, help="directory with YYYY-MM-DD.csv files")
args = p.parse_args()

files = sorted(pathlib.Path(args.dir).glob("*.csv"))
if not files:
    sys.exit(f"no .csv files in {args.dir}")

ok = fail = 0
for f in files:
    date = f.stem
    boundary = uuid.uuid4().hex
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="csvfile"; filename="{f.name}"\r\n'
        f"Content-Type: text/csv\r\n\r\n"
    ).encode() + f.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        f"{args.api}/{args.group}/csv-upload?date={date}", data=body, method="POST",
        headers={"X-API-Key": args.key,
                 "Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            ok += 1
    except Exception as e:
        fail += 1
        print(f"FAIL {date}: {e}")

print(f"uploaded ok={ok} fail={fail}")
sys.exit(1 if fail else 0)
