"""
Recompute peRatio / pbRatio in db/fundamentals.json from each record's own eps / bookValue.

The scrapers used to copy the P/E published by HamroShare / NepseAlpha. Those sites build
it on their own EPS figure, which lags the quarterly EPS we store, so P/E and EPS could
disagree (sometimes in sign). The scrapers now derive the ratios themselves through
portfolio_common.recompute_ratios; this script applies the same rule to the whole file,
e.g. after a price refresh or to repair data written by the old code.

Only db/fundamentals.json is touched. db/fundamentals_archive and db/quarterly feed the
frozen research scorer and are left as they are.

Usage:
    python tools/recompute_valuation_ratios.py            # rewrite the file
    python tools/recompute_valuation_ratios.py --dry-run  # report changes only
"""

import argparse
import json
import os
import sys

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS_DIR)
from portfolio_common import recompute_ratios  # noqa: E402

FUNDAMENTALS_PATH = os.path.join(os.path.dirname(TOOLS_DIR), "db", "fundamentals.json")
REPORT_THRESHOLD = 0.25  # list symbols whose P/E moved by more than 25%


def main():
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="report changes without writing")
    args = parser.parse_args()

    with open(FUNDAMENTALS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    updated, moved = 0, []
    for sym, record in data.items():
        if not isinstance(record, dict):
            continue
        old_pe = record.get("peRatio")
        recompute_ratios(sym, record)
        if "ratioPrice" not in record:
            continue  # no usable price; record untouched
        updated += 1
        new_pe = record.get("peRatio")
        if isinstance(old_pe, (int, float)) and isinstance(new_pe, (int, float)):
            if abs(new_pe - old_pe) > REPORT_THRESHOLD * max(abs(new_pe), 1e-9):
                moved.append((sym, record.get("eps"), old_pe, new_pe, record["ratioPrice"]))
        elif old_pe != new_pe:
            moved.append((sym, record.get("eps"), old_pe, new_pe, record["ratioPrice"]))

    print(f"Ratios derived for {updated} of {len(data)} symbols; "
          f"{len(moved)} P/E values moved by more than {int(REPORT_THRESHOLD * 100)}%:")
    for sym, eps, old_pe, new_pe, price in sorted(moved):
        print(f"  {sym:10} eps={eps!s:>9}  price={price:>9}  P/E {old_pe!s:>10} -> {new_pe}")

    if args.dry_run:
        print("Dry run: file not written.")
        return
    with open(FUNDAMENTALS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Saved {FUNDAMENTALS_PATH}")


if __name__ == "__main__":
    main()
