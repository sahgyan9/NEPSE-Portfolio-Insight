"""
Realized gains: profit or loss on shares already sold.

Reads the BUY and SELL rows in db/portfolio.json. Nothing is fetched and nothing is written.

For every SELL row it works out:
  - cost per share of the shares sold (weighted average cost, the rule MeroShare uses)
  - money received, and profit or loss in rupees and percent
  - which bought lots the sale used up (first in, first out, as CDSC does for capital
    gains tax), the oldest and newest of those dates, and how many shares were held
    under 365 days (taxed at 7.5% for individuals, 5% from 365 days)

Cost per share, in order of preference:
  recorded   costPerShare stored on the SELL row when it was entered (the holding's
             average cost at that moment; set by /api/holdings/sell since 2026-11-17)
  estimated  worked out by replaying the BUY rows before the sale. Bonus shares
             (BUY at price 0) count at face value (Rs 10 for Mutual Funds, Rs 100
             otherwise), the face value MeroShare's WACC uses.
  unknown    the buy history before the sale has fewer shares than were sold

Money received, in order of preference:
  netReceived on the row       the bill's net amount (after commission, SEBON, DP, CGT)
  quantity x price, fees='included'  explicitly marked fee-inclusive
  quantity x price, otherwise  rate typed in by hand or from trade confirmation;
                               fees and tax not taken off (feesMissing flagged)

Fiscal year is the Nepali one (1 Shrawan to end of Asar), e.g. "2083/84".

Usage:
    python tools/realized_gains.py         # print the summary as JSON
"""

import json
import os
import sys
from collections import defaultdict, deque
from datetime import date, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import portfolio_common as pc  # noqa: E402

PORTFOLIO_PATH = os.path.join(pc.DB_DIR, "portfolio.json")
BONUS_COST = 100.0
MUTUAL_FUND_BONUS_COST = 10.0
SHORT_TERM_DAYS = 365


def _day(value):
    """Date part of a transaction date ('2026-11-17' or '2026-11-17 18:48:00')."""
    return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()


def fiscal_year(d):
    """Nepali fiscal year label for an AD date, e.g. date(2026, 11, 17) -> '2083/84'."""
    import nepali_datetime

    bs = nepali_datetime.date.from_datetime_date(d)
    start = bs.year if bs.month >= 4 else bs.year - 1  # month 4 = Shrawan
    return f"{start}/{str(start + 1)[-2:]}"


def _ordered(transactions):
    """Chronological order; rows on the same day keep their stored order, buys first."""
    indexed = list(enumerate(transactions))
    return [t for _, t in sorted(indexed, key=lambda it: (_day(it[1]["date"]), 0 if it[1]["type"] == "BUY" else 1, it[0]))]


def compute_sales(transactions):
    """One record per SELL row, oldest first."""
    qty = defaultdict(float)       # replayed shares held
    cost = defaultdict(float)      # replayed total cost of those shares
    lots = defaultdict(deque)      # FIFO lots: [date, quantity]
    sales = []

    for tx in _ordered(transactions):
        sym = tx["symbol"]
        q = float(tx.get("quantity") or 0)
        price = float(tx.get("price") or 0)
        d = _day(tx["date"])

        if tx["type"] == "BUY":
            qty[sym] += q
            sector = tx.get("sector") or pc.resolve_sector(sym)
            bonus_cost = MUTUAL_FUND_BONUS_COST if sector == "Mutual Fund" else BONUS_COST
            cost[sym] += q * (price if price > 0 else bonus_cost)
            lots[sym].append([d, q])
            continue

        if tx["type"] != "SELL" or q <= 0:
            continue

        replay_avg = cost[sym] / qty[sym] if qty[sym] >= q - 1e-9 and qty[sym] > 0 else None
        if tx.get("costPerShare") is not None and str(tx.get("costPerShare")).strip() != "":
            cps, basis = float(tx["costPerShare"]), "recorded"
        elif replay_avg is not None:
            cps, basis = replay_avg, "estimated"
        else:
            cps, basis = None, "unknown"

        # FIFO lots used by this sale
        remaining, used = q, []
        while remaining > 1e-9 and lots[sym]:
            lot = lots[sym][0]
            take = min(lot[1], remaining)
            used.append((lot[0], take))
            lot[1] -= take
            remaining -= take
            if lot[1] <= 1e-9:
                lots[sym].popleft()
        short_term = sum(n for ld, n in used if (d - ld).days < SHORT_TERM_DAYS)

        # Keep the replay going at the same average cost (selling does not change WACC).
        if qty[sym] > 0:
            avg = cost[sym] / qty[sym]
            qty[sym] = max(qty[sym] - q, 0.0)
            cost[sym] = avg * qty[sym]

        if tx.get("netReceived") is not None and str(tx.get("netReceived")).strip() != "":
            received, fees = float(tx["netReceived"]), "bill"
        elif tx.get("fees") == "included":
            received, fees = q * price, "included"
        else:
            received, fees = q * price, "not_included"

        has_received = price > 0 or (tx.get("netReceived") is not None and str(tx.get("netReceived")).strip() != "")
        cost_total = cps * q if cps is not None else None
        profit = received - cost_total if has_received and cost_total is not None else None
        sales.append({
            "date": str(tx["date"])[:10],
            "fiscalYear": fiscal_year(d),
            "symbol": sym,
            "quantity": q,
            "sellPrice": price if price > 0 else None,
            "received": round(received, 2) if has_received else None,
            "costPerShare": round(cps, 2) if cps is not None else None,
            "cost": round(cost_total, 2) if cost_total is not None else None,
            "profit": round(profit, 2) if profit is not None else None,
            "profitPct": round(profit / cost_total * 100, 2) if profit is not None and cost_total else None,
            "costBasis": basis,
            "fees": fees,
            "heldFrom": used[0][0].isoformat() if used else None,
            "heldTo": used[-1][0].isoformat() if used else None,
            "shortTermQty": short_term if used else None,
            "billNo": tx.get("billNo"),
        })
    return sales


def summarize(transactions, today=None):
    today = today or date.today()
    sales = compute_sales(transactions)
    current_fy = fiscal_year(today)

    def total(rows):
        counted = [r for r in rows if r["profit"] is not None]
        return {
            "profit": round(sum(r["profit"] for r in counted), 2),
            "cost": round(sum(r["cost"] for r in counted), 2),
            "received": round(sum(r["received"] for r in counted), 2),
            "sales": len(rows),
            "uncounted": len(rows) - len(counted),
            "feesMissing": sum(1 for r in counted if r["fees"] == "not_included"),
        }

    by_year = defaultdict(list)
    for r in sales:
        by_year[r["fiscalYear"]].append(r)

    return {
        "asOf": today.isoformat(),
        "currentFiscalYear": current_fy,
        "allTime": total(sales),
        "thisYear": total(by_year.get(current_fy, [])),
        "byYear": [{"fiscalYear": fy, **total(rows)} for fy, rows in sorted(by_year.items(), reverse=True)],
        "sales": list(reversed(sales)),
    }


def load_summary(path=PORTFOLIO_PATH, today=None):
    with open(path, "r", encoding="utf-8-sig") as f:
        db = json.load(f)
    return summarize(db.get("transactions", []), today=today)


if __name__ == "__main__":
    print(json.dumps(load_summary(), indent=2, ensure_ascii=False))
