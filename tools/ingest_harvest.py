"""
Ingest browser-harvested NepseAlpha data (no network, no dependencies)
======================================================================
Companion to tools/browser_harvest.js.

Cloudflare sometimes TLS-fingerprints the Python scrapers and returns 403 while
a real Chrome tab sails through. When that happens, the browser harvester runs
inside a nepsealpha.com tab, builds the *same* snapshot/fundamentals objects the
Python collectors build, and dumps them to a JSON file. This script merges that
file into the two on-disk stores — using the identical dedupe rules as
tools/archive_fundamentals.py and tools/scrape_fundamentals_direct.py:

    db/fundamentals.json              <- latest snapshot per symbol (overwrite-merge)
    db/fundamentals_archive/<SYM>.json <- append-only, one row per published quarter

Input format (array, or a single object):

    [
      {
        "symbol": "NLO",
        "full_name": "Nepal Lube Oil Limited",
        "snapshot":     { ...archive row, must contain reported_quarter... },
        "fundamentals": { "eps": 73.8, "peRatio": 3.65, ... }
      },
      ...
    ]

Both "snapshot" and "fundamentals" are optional per record — whichever is
present gets written.

Usage:
    python tools/ingest_harvest.py .tmp/harvest.json
    python tools/ingest_harvest.py .tmp/harvest.json --dry-run
"""

import argparse
import json
import os
import sys
from datetime import datetime

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS_DIR)
DB_PATH = os.path.join(ROOT, "db", "fundamentals.json")
ARCHIVE_DIR = os.path.join(ROOT, "db", "fundamentals_archive")
META_PATH = os.path.join(ARCHIVE_DIR, "_meta.json")


def _load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def _save_json(path, doc):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)


def upsert_snapshot(symbol, full_name, snap, dry_run=False):
    """Same dedupe rule as archive_fundamentals.upsert_snapshot: one row per
    published quarter, refreshed in place if that quarter already exists."""
    path = os.path.join(ARCHIVE_DIR, f"{symbol}.json")
    doc = _load_json(path, {"symbol": symbol, "full_name": full_name, "snapshots": []})

    doc["symbol"] = symbol
    if full_name:
        doc["full_name"] = full_name
    if snap.get("sector"):
        doc["sector"] = snap["sector"]

    snaps = doc.setdefault("snapshots", [])
    existing = next((s for s in snaps
                     if s.get("reported_quarter") == snap.get("reported_quarter")), None)
    if existing:
        existing.update(snap)
        result = "updated"
    else:
        snaps.append(snap)
        result = "new"

    snaps.sort(key=lambda s: (s.get("fiscal_year", ""), s.get("quarter", 0)))
    if not dry_run:
        _save_json(path, doc)
    return result


def main():
    parser = argparse.ArgumentParser(
        description="Merge browser-harvested NepseAlpha records into the on-disk stores.")
    parser.add_argument("input", help="JSON file written by tools/browser_harvest.js")
    parser.add_argument("--dry-run", action="store_true",
                        help="Report what would change without writing")
    args = parser.parse_args()

    records = _load_json(args.input, None)
    if records is None:
        print(f"Could not read {args.input}")
        sys.exit(1)
    if isinstance(records, dict):
        records = [records]

    db = _load_json(DB_PATH, {})
    stats = {"new": 0, "updated": 0, "fundamentals": 0, "skipped": 0}

    for rec in records:
        symbol = (rec.get("symbol") or "").upper()
        if not symbol:
            stats["skipped"] += 1
            continue

        fields = rec.get("fundamentals") or {}
        if fields:
            db.setdefault(symbol, {}).update(fields)
            stats["fundamentals"] += 1

        snap = rec.get("snapshot") or {}
        if snap.get("reported_quarter"):
            result = upsert_snapshot(symbol, rec.get("full_name", ""), snap,
                                     dry_run=args.dry_run)
            stats[result] += 1
            print(f"  {symbol}: archive {result} ({snap['reported_quarter']}, "
                  f"EPS {snap.get('eps_ttm')}, PE {snap.get('pe_ratio')}, "
                  f"ROE {snap.get('roe')}) + {len(fields)} fundamentals fields")
        else:
            print(f"  {symbol}: {len(fields)} fundamentals fields (no archive snapshot)")

    if not args.dry_run:
        _save_json(DB_PATH, db)
        meta = _load_json(META_PATH, {})
        meta["last_run"] = datetime.now().isoformat()
        meta["last_source"] = "browser_harvest"
        meta["last_stats"] = stats
        _save_json(META_PATH, meta)

    prefix = "[dry-run] " if args.dry_run else ""
    print(f"\n{prefix}{stats['new']} new-quarter rows, {stats['updated']} refreshed, "
          f"{stats['fundamentals']} symbols updated in fundamentals.json, "
          f"{stats['skipped']} skipped.")


if __name__ == "__main__":
    main()
