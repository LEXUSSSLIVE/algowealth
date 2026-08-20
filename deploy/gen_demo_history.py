#!/usr/bin/env python3
"""Generates a fully fictional daily portfolio history.

Composition: US banks only, random account numbers, US-listed instruments.
Prices follow a random walk (fixed seed) with occasional quantity changes.
Output: N daily CSVs in OUT_DIR (Go csv-upload format, `;`) + manifest.txt
with expected checksums to verify against after uploading.

Usage: python3 gen_demo_history.py [days] [out_dir]
"""
import csv
import random
import sys
from datetime import date, timedelta
from pathlib import Path

DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 400
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("demo_history")
END = date(2026, 8, 19)
rng = random.Random(20260819)

HEADER = ["Instrument", "Investment category", "Instrument type", "Curr",
          "Quantity / Nominal", "Purch, price", "Current Price",
          "Total value USD", "UNREALISED RESULT", "% profit", "ISIN",
          "Bank Name", "Account Name", "Account ID", "IBAN"]

# per-day drift/volatility by instrument type
DYN = {
    "Equities":    (0.00030, 0.012),
    "Bond":        (0.00012, 0.0025),
    "Treasury":    (0.00010, 0.0018),
    "OTC Bond":    (0.00015, 0.004),
    "Alternative": (0.00025, 0.006),
    "Cash":        (0.0, 0.0),
}
CAT = {
    "Equities": "Equities & similar positions",
    "Bond": "Bonds & similar positions",
    "Treasury": "Bonds & similar positions",
    "OTC Bond": "Bonds & similar positions",
    "Alternative": "Alternative investments",
    "Cash": "Liquidity",
}

# (bank, account_name, account_id): [(instrument, type, isin, price0, qty, frozen)]
BOOK = {
    ("JPMorgan Private Bank", "", "84772091"): [
        ("NVIDIA Corp", "Equities", "US67066G1040", 118.0, 90000, False),
        ("Alphabet Inc Class A", "Equities", "US02079K3059", 168.0, 42000, False),
        ("US Treasury 4.625% 15.05.2034", "Treasury", "US91282CKR11", 102.3, 160000, False),
        ("USD Cash", "Cash", "", 1.0, 3400000, False),
    ],
    ("JPMorgan Private Bank", "", "84772092"): [
        ("Amazon.com Inc", "Equities", "US0231351067", 186.0, 38000, False),
        ("Meta Platforms Inc", "Equities", "US30303M1027", 510.0, 9500, False),
    ],
    ("Goldman Sachs PWM", "", "55310468"): [
        ("GS Vintage Fund IX LP", "Alternative", "", 1000.0, 5200, False),
        ("Eli Lilly & Co", "Equities", "US5324571083", 780.0, 5600, False),
        ("USD Cash", "Cash", "", 1.0, 1150000, False),
    ],
    ("Morgan Stanley Wealth", "", "90148253"): [
        ("Apple Inc", "Equities", "US0378331005", 228.0, 26000, False),
        ("Apple Inc 3.85% 2043", "Bond", "US037833AL42", 88.9, 52000, False),
        ("USD Cash", "Cash", "", 1.0, 890000, False),
    ],
    ("Bank of America Merrill", "", "33207915"): [
        ("US Treasury 4.25% 15.08.2033", "Treasury", "US91282CHT18", 98.4, 120000, False),
        ("iShares Core US Aggregate ETF", "Bond", "US4642872265", 98.1, 64000, False),
    ],
    ("Charles Schwab", "", "71689002"): [
        ("SPDR S&P 500 ETF", "Equities", "US78462F1030", 545.0, 14500, False),
        ("Invesco QQQ Trust", "Equities", "US46090E1038", 465.0, 9200, False),
        ("USD Cash", "Cash", "", 1.0, 640000, False),
    ],
    ("Charles Schwab", "", "71689003"): [
        ("Vanguard Real Estate ETF", "Equities", "US9229085538", 88.6, 30000, False),
        ("US Treasury 4.0% 15.02.2034", "Treasury", "US91282CJZ59", 97.6, 78000, False),
    ],
    ("Fidelity Investments", "", "60934187"): [
        ("Microsoft Corp", "Equities", "US5949181045", 442.0, 12500, False),
        ("iShares iBoxx IG Corp Bond ETF", "Bond", "US4642872422", 108.7, 46000, False),
        ("USD Cash", "Cash", "", 1.0, 1730000, False),
    ],
    ("Citi Private Bank", "", "42078356"): [
        ("US Treasury 4.125% 15.11.2032", "Treasury", "US91282CFV88", 97.9, 210000, False),
        ("Microsoft Corp 3.3% 2027", "Bond", "US594918BY93", 96.8, 74000, False),
        ("USD Cash", "Cash", "", 1.0, 5100000, False),
    ],
    ("Wells Fargo Advisors", "", "28569140"): [
        ("Berkshire Hathaway B", "Equities", "US0846707026", 452.0, 15000, False),
        ("NYC GO 4.0% 2035 Muni", "Bond", "US64966QCC22", 99.2, 41000, False),
    ],
    ("Northern Trust", "", "19402877"): [
        ("Blackstone BREIT Class I", "Alternative", "", 14.2, 620000, False),
        ("Private Credit Note 8.5% 2028", "OTC Bond", "", 100.0, 88000, False),
        ("USD Cash", "Cash", "", 1.0, 980000, False),
    ],
    ("Raymond James", "", "66120593"): [
        ("Visa Inc Class A", "Equities", "US92826C8394", 275.0, 21000, False),
        ("UnitedHealth Group Inc", "Equities", "US91324P1021", 505.0, 7400, False),
        ("Exxon Mobil Corp", "Equities", "US30231G1022", 112.0, 34000, False),
    ],
}

# --- calibrate the starting total to ~$188M ----------------------------------
start_total = sum(p * q for rows in BOOK.values() for _, _, _, p, q, _ in rows)
scale = 188_000_000 / start_total
book = []  # flat list of positions with mutable state
for (bank, acc_name, acc_id), rows in BOOK.items():
    for name, typ, isin, p0, q0, frozen in rows:
        qty = round(q0 * scale, 4 if typ != "Cash" else 2)
        book.append({
            "bank": bank, "acc_name": acc_name, "acc_id": acc_id,
            "name": name, "type": typ, "isin": isin, "frozen": frozen,
            "purch": p0, "price": p0, "qty": qty,
        })

OUT.mkdir(parents=True, exist_ok=True)
dates = [END - timedelta(days=i) for i in range(DAYS - 1, -1, -1)]
manifest = []
for di, d in enumerate(dates):
    # occasional "trades": roughly every 45 days one non-frozen,
    # non-cash position changes its quantity by ±10%
    if di > 0 and di % 45 == 0:
        cand = [b for b in book if not b["frozen"] and b["type"] != "Cash"]
        pos = rng.choice(cand)
        pos["qty"] = round(pos["qty"] * (1 + rng.choice([-0.1, 0.1])), 4)
    total = 0.0
    with open(OUT / f"{d.isoformat()}.csv", "w", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(HEADER)
        for b in book:
            if not b["frozen"]:
                drift, vol = DYN[b["type"]]
                b["price"] *= 1 + rng.gauss(drift, vol)
            value = round(b["price"] * b["qty"], 2)
            unreal = round((b["price"] - b["purch"]) * b["qty"], 2)
            profit = round((b["price"] / b["purch"] - 1) * 100, 2) if b["purch"] else 0
            total += value
            w.writerow([
                b["name"], CAT[b["type"]], b["type"], "USD",
                f"{b['qty']:.4f}", f"{b['purch']:.4f}", f"{b['price']:.6f}",
                f"{value:.2f}", f"{unreal:.2f}", f"{profit:.2f}",
                b["isin"], b["bank"], b["acc_name"], b["acc_id"], "-",
            ])
    manifest.append((d.isoformat(), len(book), round(total, 2)))

with open(OUT / "manifest.txt", "w") as f:
    for d, n, t in manifest:
        f.write(f"{d} rows={n} total={t}\n")
print(f"dates={len(dates)} first={dates[0]} last={dates[-1]}")
print(f"rows/day={len(book)} start_total={manifest[0][2]:,.2f} end_total={manifest[-1][2]:,.2f}")
