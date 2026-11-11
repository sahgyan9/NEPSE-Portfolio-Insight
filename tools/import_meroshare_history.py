"""
Import IPO, rights and bonus events from a MeroShare "Transaction History" CSV.

Broker bills (workflows/import_broker_transactions.md) only cover secondary-market trades.
Shares that arrived any other way never produce a bill:
  - IPO / FPO allotments        ("INITIAL PUBLIC OFFERING ...")   paid for
  - rights shares               ("CA-Rights ...")                 paid for, at Rs. 100
  - bonus shares                ("CA-Bonus ...")                  free
  - fund units paid as dividend ("CA-Rearrangement ... DREP ...") free
MeroShare's history has the real credit date and quantity for each of these, but no price.

What this tool does, per holding:
  1. Adds one BUY row per IPO / rights / bonus event, dated from MeroShare, with a
     `source` starting "meroshare:". Bonus and dividend units are recorded at price 0
     because no cash was paid.
  2. Replaces older hand-entered rows for the same event (same symbol and quantity, no
     broker bill number), keeping the price that row had for IPOs.
  3. Works out an IPO price where none is on record: the holding's total cost (quantity x
     average cost, which follows MeroShare's WACC rule of counting bonus shares at Rs. 100)
     minus everything else, divided by the IPO quantity.
  4. Checks that the rows now add up to the holding's quantity and reports any that do not.

Fund purchases by SIP ("CA-Rearrangement ... PUR ...") are NOT imported: the SIP statement
has the real NAV paid and exact fractional units, which MeroShare truncates.

Usage:
    python tools/import_meroshare_history.py "path/to/Transaction History.csv"          # dry run
    python tools/import_meroshare_history.py "path/to/Transaction History.csv" --apply  # write

--apply saves db/portfolio_backup_<timestamp>.json first. Re-running is safe: rows this
tool created are removed and rebuilt each time.
"""

import argparse
import csv
import json
import os
import shutil
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import portfolio_common as pc  # noqa: E402

PORTFOLIO_PATH = os.path.join(pc.DB_DIR, "portfolio.json")
SOURCE_PREFIX = "meroshare:"
FREE_KINDS = ("bonus", "dividend-units")


def classify(description):
    d = " ".join((description or "").upper().split())
    if d.startswith("INITIAL PUBLIC OFFERING"):
        return "ipo"
    if d.startswith("CA-BONUS"):
        return "bonus"
    if d.startswith("CA-RIGHTS"):
        return "rights"
    if d.startswith("CA-REARRANGEMENT"):
        return "dividend-units" if " DREP " in f" {d} " else "fund-purchase"
    if d.startswith("ON-CR") or d.startswith("ON-DR"):
        return "market"
    return "other"


def read_history(path):
    events = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            def num(key):
                raw = (row.get(key) or "").strip()
                return float(raw) if raw not in ("", "-") else 0.0
            credit, debit = num("Credit Quantity"), num("Debit Quantity")
            desc = " ".join((row.get("History Description") or "").split())
            events.append({
                "symbol": (row.get("Scrip") or "").strip().upper(),
                "date": (row.get("Transaction Date") or "").strip()[:10],
                "quantity": credit - debit,
                "kind": classify(desc),
                "description": desc,
            })
    events.sort(key=lambda e: e["date"])
    return events


def is_free_share_row(tx):
    """True for rows that record shares received without paying cash."""
    source = str(tx.get("source") or "").lower()
    return "bonus" in source or "dividend-reinvestment" in source or "dividend-units" in source


def plan_import(portfolio, events, fundamentals=None):
    """Return (new_transactions, report_rows). Pure: does not modify `portfolio`."""
    txs = [dict(t) for t in portfolio.get("transactions", [])
           if not str(t.get("source") or "").startswith(SOURCE_PREFIX)]
    holdings = {h["symbol"].upper(): h for h in portfolio.get("holdings", [])}
    report = []

    by_symbol = {}
    for e in events:
        by_symbol.setdefault(e["symbol"], []).append(e)

    for sym, sym_events in sorted(by_symbol.items()):
        holding = holdings.get(sym)
        if not holding:
            continue
        primary = [e for e in sym_events if e["kind"] in ("ipo", "rights", "bonus", "dividend-units")]
        fund_purchases = [e for e in sym_events if e["kind"] == "fund-purchase"]
        if fund_purchases:
            report.append({"symbol": sym, "status": "skipped",
                           "note": f"{len(fund_purchases)} fund purchases: use the SIP statement for these"})
            continue
        if not primary:
            continue

        # Replace hand-entered rows that describe the same event (no bill, same quantity).
        mine = [t for t in txs if t["symbol"].upper() == sym]
        kept_prices = {}
        for e in primary:
            match = next((t for t in mine if not t.get("billNo") and not t.get("_used")
                          and abs(float(t["quantity"]) - e["quantity"]) < 1e-9
                          and not _is_market_match(t, sym_events)), None)
            if match:
                match["_used"] = True
                kept_prices[id(e)] = float(match.get("price") or 0)
        txs = [t for t in txs if not t.get("_used")]

        remaining = [t for t in txs if t["symbol"].upper() == sym]
        other_cost = sum(float(t["quantity"]) * float(t.get("price") or 0) * (1 if t["type"] == "BUY" else 0)
                         for t in remaining)
        sold_any = any(t["type"] != "BUY" for t in remaining)
        qty, avg = float(holding["quantity"]), float(holding.get("avgCost") or 0)
        free_qty = sum(e["quantity"] for e in primary if e["kind"] in FREE_KINDS)
        rights_qty = sum(e["quantity"] for e in primary if e["kind"] == "rights")
        ipo_events = [e for e in primary if e["kind"] == "ipo"]
        ipo_qty = sum(e["quantity"] for e in ipo_events)
        sector = pc.resolve_sector(sym, fundamentals or {})
        face = 10.0 if sector == "Mutual Fund" else 100.0

        derived, price_note = None, ""
        known_ipo = [kept_prices[id(e)] for e in ipo_events if kept_prices.get(id(e))]
        if ipo_events and len(known_ipo) == len(ipo_events):
            price_note = "IPO price kept from the existing record"
        elif ipo_qty > 0 and not sold_any:
            # WACC counts bonus at face value; back the IPO price out of the total cost.
            derived = (qty * avg - other_cost - rights_qty * face - free_qty * face) / ipo_qty
            if not (face * 0.9 <= derived <= 3000):
                derived, price_note = None, f"IPO price could not be derived; assumed Rs. {face:.0f}"
            else:
                derived = round(derived, 2)
                price_note = f"IPO price Rs. {derived:g} derived from average cost"
        elif ipo_qty > 0:
            price_note = f"IPO price assumed Rs. {face:.0f} (position was partly sold)"

        for e in primary:
            if e["kind"] in FREE_KINDS:
                price = 0.0
            elif e["kind"] == "rights":
                price = face
            else:
                price = kept_prices.get(id(e)) or derived or face
            label = {"ipo": "IPO/FPO allotment", "rights": "rights shares",
                     "bonus": "bonus shares (no cash paid)",
                     "dividend-units": "dividend-units (no cash paid)"}[e["kind"]]
            txs.append({"type": "BUY", "symbol": sym, "quantity": _clean(e["quantity"]),
                        "price": price, "date": e["date"],
                        "source": f"{SOURCE_PREFIX} {label} [{e['description'][:60]}]"})

        net = sum(float(t["quantity"]) * (1 if t["type"] == "BUY" else -1)
                  for t in txs if t["symbol"].upper() == sym)
        ok = abs(net - qty) < 0.01
        report.append({
            "symbol": sym, "status": "ok" if ok else "MISMATCH",
            "holding": _clean(qty), "rows_total": _clean(net),
            "events": ", ".join(f"{e['kind']} {_clean(e['quantity'])} on {e['date']}" for e in primary),
            "note": price_note,
            "first_date": min(str(t["date"])[:10] for t in txs if t["symbol"].upper() == sym),
        })

    for t in txs:
        t.pop("_used", None)
    txs.sort(key=lambda t: str(t.get("date"))[:10])
    return txs, report


def _is_market_match(tx, sym_events):
    """A hand-entered row that matches a secondary-market credit is a real trade, not an
    IPO/bonus placeholder, even if its quantity equals one."""
    day = str(tx.get("date") or "")[:10]
    for e in sym_events:
        if e["kind"] == "market" and abs(e["quantity"] - float(tx["quantity"])) < 1e-9:
            try:
                gap = abs((datetime.strptime(day, "%Y-%m-%d") - datetime.strptime(e["date"], "%Y-%m-%d")).days)
            except ValueError:
                continue
            if gap <= 10:
                return True
    return False


def _clean(x):
    return int(x) if float(x).is_integer() else round(float(x), 4)


def main():
    parser = argparse.ArgumentParser(description="Import IPO, rights and bonus events from MeroShare history.")
    parser.add_argument("csv_path")
    parser.add_argument("--apply", action="store_true", help="write changes (default is a dry run)")
    args = parser.parse_args()

    portfolio = pc.load_json(PORTFOLIO_PATH)
    if not portfolio:
        print("db/portfolio.json not found.")
        return 1
    fundamentals = pc.load_json(os.path.join(pc.DB_DIR, "fundamentals.json")) or {}
    events = read_history(args.csv_path)
    new_txs, report = plan_import(portfolio, events, fundamentals)

    for r in report:
        if r["status"] == "skipped":
            print(f"{r['symbol']:<8} skipped   {r['note']}")
            continue
        print(f"{r['symbol']:<8} {r['status']:<9} holding {r['holding']} rows {r['rows_total']} | {r['events']}"
              + (f" | {r['note']}" if r["note"] else ""))
    before, after = len(portfolio.get("transactions", [])), len(new_txs)
    print(f"\nTransactions: {before} -> {after}")
    mismatches = [r["symbol"] for r in report if r["status"] == "MISMATCH"]
    if mismatches:
        print("Do not add up to the holding quantity (left as imported; check by hand): " + ", ".join(mismatches))

    if not args.apply:
        print("\nDry run. Re-run with --apply to write.")
        return 0

    backup = os.path.join(pc.DB_DIR, f"portfolio_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
    shutil.copyfile(PORTFOLIO_PATH, backup)
    portfolio["transactions"] = new_txs
    first_dates = {r["symbol"]: r["first_date"] for r in report if r.get("first_date")}
    for h in portfolio["holdings"]:
        first = first_dates.get(h["symbol"].upper())
        if first and (not h.get("dateAdded") or first < str(h["dateAdded"])[:10]):
            h["dateAdded"] = first
    with open(PORTFOLIO_PATH, "w", encoding="utf-8") as f:
        json.dump(portfolio, f, indent=2, ensure_ascii=False)
    print(f"\nWritten. Backup: {backup}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
