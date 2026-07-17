"""
Broker Bill Email Parser (Dynamic Money Managers Securities)
==============================================================
Parses PURCHASE/SELL BILL emails from accounts@dynamic44.com into structured
buy/sell transactions with real trade dates and effective (fee-inclusive) rates.

These bills don't cover primary-market allotments (IPO/FPO/mutual fund units) -
those carry no brokerage commission and never generate a "bill" email, so
holdings acquired that way (mutual funds, some IPO shares) won't appear here.
That's expected, not a parsing gap.

Usage:
    python tools/parse_broker_bills.py <raw_emails.json> <out_transactions.json>

Input: JSON list of {"id", "subject", "htmlBody"} (fetched via Gmail).
Output: JSON list of {"type": "BUY"|"SELL", "symbol", "quantity", "price",
"date", "billNo"} sorted by date.
"""

import json
import re
import sys

ROW_RE = re.compile(
    r"<tr[^>]*><td[^>]*>(?P<txn>\d+)</td>"
    r"<td[^>]*>(?P<symbol>[A-Z0-9]+)</td>"
    r"<td[^>]*>(?P<qty>[\d.]+)</td>"
    r"<td[^>]*>[\d.]+</td>"      # Rate (raw, pre-fee)
    r"<td[^>]*>[\d.]+</td>"      # Amt
    r"<td[^>]*>[\d.]+</td>"      # Comm Rate
    r"<td[^>]*>[\d.]+</td>"      # Comm Amt
    r"<td[^>]*>[\d.]+</td>"      # SEBON Comm
    r"(?:<td[^>]*>[\d.]*</td>)?" # Base Price / blank (sell bills only)
    r"(?:<td[^>]*>[\d.]*</td>)?" # CGT (sell bills only)
    r"<td[^>]*>(?P<effrate>[\d.]+)</td>"  # Eff Rate
    r"<td[^>]*>[\d.]+</td></tr>", # Total Amt
)

TXN_DATE_RE = re.compile(r"Transaction Date:\s*[\d-]+\s*\((\d{4}-\d{2}-\d{2}) AD\)")
BILL_NO_RE = re.compile(r"BILL NO ([\w-]+)")


def parse_email(subject: str, html: str) -> list:
    m = BILL_NO_RE.search(subject)
    bill_no = m.group(1) if m else ""
    txn_type = "SELL" if subject.upper().startswith("SELL") else "BUY"

    date_m = TXN_DATE_RE.search(html)
    if not date_m:
        return []
    trade_date = date_m.group(1)

    rows = []
    for row in ROW_RE.finditer(html):
        rows.append({
            "type": txn_type,
            "symbol": row.group("symbol"),
            "quantity": float(row.group("qty")),
            "price": float(row.group("effrate")),
            "date": trade_date,
            "billNo": bill_no,
        })
    return rows


def main():
    if len(sys.argv) != 3:
        print("Usage: python tools/parse_broker_bills.py <raw_emails.json> <out.json>")
        sys.exit(1)

    with open(sys.argv[1], "r", encoding="utf-8") as f:
        emails = json.load(f)

    all_txns = []
    for email in emails:
        txns = parse_email(email["subject"], email["htmlBody"])
        if not txns:
            print(f"  WARNING: no rows parsed from {email.get('id')} ({email.get('subject')})")
        all_txns.extend(txns)

    all_txns.sort(key=lambda t: t["date"])

    with open(sys.argv[2], "w", encoding="utf-8") as f:
        json.dump(all_txns, f, indent=2)

    print(f"Parsed {len(all_txns)} transactions from {len(emails)} emails -> {sys.argv[2]}")

    totals = {}
    for t in all_txns:
        sign = 1 if t["type"] == "BUY" else -1
        totals[t["symbol"]] = totals.get(t["symbol"], 0) + sign * t["quantity"]
    print("\nNet quantity by symbol (from bills only):")
    for sym in sorted(totals):
        print(f"  {sym}: {totals[sym]:.0f}")


if __name__ == "__main__":
    main()
