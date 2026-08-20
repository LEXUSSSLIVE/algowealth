# Demo blog content for AlgoWealth (run inside the api container):
#   docker compose cp seed_blog_demo.py api:/tmp/ && docker compose exec api python /tmp/seed_blog_demo.py
# Self-contained: downloads cover images (picsum.photos) and generates placeholder
# PDF attachments into the uploads dir before inserting the posts.
import datetime
import json
import os
import pathlib
import urllib.request

from app import db

UPLOADS = pathlib.Path(os.environ.get("ALGOWEALTH_UPLOADS", "/data/uploads"))

POSTS = [
    # (title, type, days_ago, blocks, file_path)
    ("NVDA: the AI capex supercycle is not done", "stock_ideas", 2, [
        ("h", "Why the market still underprices compute"),
        ("p", "Hyperscaler capex guidance keeps moving higher, and <b>supply remains the constraint</b>, not demand. Lead times on advanced packaging are still measured in quarters."),
        ("p", "The bear case rests on digestion risk, but every prior digestion phase in this cycle has lasted <i>weeks, not quarters</i>."),
        ("l", ["Data center revenue growing faster than total revenue", "Gross margin holding above 70%", "Networking attach rate keeps climbing"]),
    ], None),
    ("Weekly Market Report: rotation into value", "reports", 4, [
        ("h", "The week in three charts"),
        ("p", "Small caps outperformed for the third consecutive week while the megacap complex consolidated. Breadth indicators reached their <b>best levels since spring</b>."),
        ("l", ["Russell 2000 +2.4% on the week", "Equal-weight S&P beat cap-weight by 110 bps", "10Y yield stable around 4.2%"]),
        ("p", "Full breakdown with positioning data in the attached PDF."),
    ], "/uploads/files/weekly-report-w32.pdf"),
    ("Copper miners: quiet beneficiaries of the grid buildout", "stock_ideas", 6, [
        ("h", "Electrification math"),
        ("p", "Grid spending is the <b>least glamorous</b> part of the energy transition and the most underinvested. Copper demand from grid projects alone is set to double by 2030."),
        ("p", "We prefer producers with <i>brownfield expansion</i> optionality over greenfield stories."),
        ("l", ["Supply deficits projected from 2027", "Permitting remains the bottleneck", "M&A premium building in the mid-cap space"]),
    ], None),
    ("Macro outlook: sticky services inflation", "reports", 9, [
        ("h", "What the last CPI print actually said"),
        ("p", "Goods deflation is doing the heavy lifting while <b>services ex-shelter refuses to break below 3.5%</b>. That combination keeps the terminal rate debate alive."),
        ("p", "Our base case remains two cuts this year, but the bar for the second one is rising."),
    ], None),
    ("Japan banks: the rate normalization play", "stock_ideas", 12, [
        ("h", "From zero to something"),
        ("p", "Every 25 bps of policy normalization adds roughly <b>8-12% to net interest income</b> for the megabanks. The market still prices less than half of the announced path."),
        ("l", ["Loan books repricing faster than deposits", "Cross-shareholding unwinds fund buybacks", "Valuations still below book"]),
    ], None),
    ("Q2 earnings season recap", "reports", 15, [
        ("h", "Beats, misses and the guidance tell"),
        ("p", "78% of companies beat on EPS, but the stock reaction to beats was the <b>weakest in eight quarters</b> - the market had already paid for the good news."),
        ("p", "Guidance revisions skew positive in industrials and financials, negative in consumer discretionary."),
        ("l", ["Blended EPS growth: +11.2% y/y", "Revenue beats: 61% of companies", "Margin expansion in 7 of 11 sectors"]),
    ], "/uploads/files/q2-earnings-recap.pdf"),
    ("Small-cap energy: three setups under $2B", "stock_ideas", 18, [
        ("h", "Where the drilling economics work"),
        ("p", "With WTI stuck in the 70s, the market pays for <b>capital discipline</b>, not growth. We screen for names with sub-2x leverage and double-digit free cash flow yields."),
        ("p", "All three names generate positive FCF <i>below $60 WTI</i>."),
    ], None),
    ("Rates and FX weekly", "reports", 22, [
        ("h", "Dollar smile, again"),
        ("p", "The dollar strengthened against every G10 currency last week. <b>Carry remains the dominant driver</b> while vol stays suppressed."),
        ("l", ["DXY +0.8% on the week", "JPY testing intervention territory", "EM local debt saw first outflows in six weeks"]),
    ], None),
    ("European defense: the decade-long order book", "stock_ideas", 26, [
        ("h", "Structural, not cyclical"),
        ("p", "NATO members are committing to spending floors that translate into <b>order books stretching past 2035</b>. The sector re-rating has run far, but earnings upgrades keep pace."),
        ("p", "We favor suppliers of consumables and electronics over prime contractors at current multiples."),
    ], None),
    ("Portfolio construction notes: sizing under uncertainty", "reports", 30, [
        ("h", "Kelly, capped"),
        ("p", "Full-Kelly sizing assumes you know your edge. In practice, <b>half-Kelly with a hard position cap</b> preserves most of the growth rate at a fraction of the drawdown."),
        ("l", ["Cap single positions at 5% of NAV", "Rebalance on thesis change, not price", "Correlation clusters count as one position"]),
    ], None),
]


def blocks_to_editorjs(blocks):
    out = []
    for kind, data in blocks:
        if kind == "h":
            out.append({"type": "header", "data": {"text": data, "level": 2}})
        elif kind == "p":
            out.append({"type": "paragraph", "data": {"text": data}})
        elif kind == "l":
            out.append({"type": "list", "data": {"style": "unordered", "items": data}})
    return json.dumps({"blocks": out})


def plain(blocks):
    import re
    parts = []
    for kind, data in blocks:
        items = data if isinstance(data, list) else [data]
        parts.extend(re.sub(r"<[^>]+>", "", str(x)) for x in items)
    return " ".join(parts)


def make_pdf(path, title):
    """Writes a minimal one-page PDF with a title line (valid xref, no deps)."""
    text = f"BT /F1 24 Tf 72 720 Td ({title}) Tj ET"
    stream = text.encode()
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream),
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n%s\nendobj\n" % (i, body)
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    path.write_bytes(bytes(out))


def fetch_assets():
    (UPLOADS / "images").mkdir(parents=True, exist_ok=True)
    (UPLOADS / "files").mkdir(parents=True, exist_ok=True)
    for i in range(1, len(POSTS) + 1):
        dest = UPLOADS / "images" / f"blog_seed_{i}.jpg"
        if not dest.exists():
            url = f"https://picsum.photos/seed/algowealth{i}/800/450"
            urllib.request.urlretrieve(url, dest)
            print(f"cover {i}: downloaded")
    for fname, title in [("weekly-report-w32.pdf", "Weekly Market Report - W32"),
                         ("q2-earnings-recap.pdf", "Q2 Earnings Season Recap")]:
        dest = UPLOADS / "files" / fname
        if not dest.exists():
            make_pdf(dest, title)
            print(f"pdf: {fname} generated")


fetch_assets()
now = datetime.datetime.now(datetime.UTC)
with db.get_conn() as conn:
    deleted = conn.execute(
        "DELETE FROM posts WHERE title = 'Test post (blog check)'").rowcount
    for i, (title, type_, days_ago, blocks, file_path) in enumerate(POSTS, start=1):
        ts = (now - datetime.timedelta(days=days_ago, hours=i)).strftime("%Y-%m-%d %H:%M:%S")
        conn.execute(
            "INSERT INTO posts (title, type, status, content_json, content_plain, "
            "image_path, file_path, created_at, published_at) "
            "VALUES (?, ?, 'published', ?, ?, ?, ?, ?, ?)",
            (title, type_, blocks_to_editorjs(blocks), plain(blocks),
             f"/uploads/images/blog_seed_{i}.jpg", file_path, ts, ts))
    n = conn.execute("SELECT COUNT(*) c FROM posts WHERE status='published'").fetchone()["c"]
print(f"deleted test posts: {deleted}; published posts now: {n}")
