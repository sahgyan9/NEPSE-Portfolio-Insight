"""
Fix percentage ratios stored 100 times too large in db/quarterly
================================================================
For some quarters the source (HamroShare) serves bank ratios without the decimal
point: CAR 11.12 arrives as 1112, NPL 9.81 as 981, Base Rate 5.55 as 555. Sometimes
the whole row is affected (NICA 2083-84 Q1, NABIL 2082-83 Q1, SFCL 2082-83 Q3),
sometimes a single field (JBBL 2078-79 Q3 CAR 1496, SANIMA 2082-83 Q3 NPL 399).
The harvest tool passes ratios through unchanged, so the error lands in the files,
and a later harvest writes it back. The scorer reads CAR, NPL and the CD ratio, and
excludes a bank or financial company with NPL above 10%, so one such row can drop a
company from the ranking.

How a value is judged. A value is a candidate only when it is above a ceiling that
a real figure does not reach (NPL above 100%, a rate above 30%, CAR above 100%,
CD ratio above 1,000%). Some real figures do exceed these ceilings for long spells
(NIFRA's CAR near 300% after it started, microfinance CD ratios in the hundreds),
so a candidate is divided by 100 only when the result agrees with the same field in
the company's neighbouring quarters (up to four on each side, ignoring other
candidates): within a factor of 3 of their median. A candidate with no usable
neighbours is divided by 100 only when another field of the same row was confirmed
by its neighbours. Once any field of a row is confirmed, the row is taken to be
stored x100 and its other candidates are divided too. An NPL above 100% that is not
explained this way is removed from raw (kept under `pct_invalid`), because no real
NPL exceeds 100% and the scorer would otherwise exclude the company on it. Anything
else is left as stored and listed as in doubt.

Running it twice changes nothing the second time: a corrected value is below its
ceiling. Changed records get a `pct_fix` key listing the fields divided by 100.
Year-on-year figures of a changed field are recomputed in the changed record and in
the record one fiscal year later, with the harvest tool's formula.

Usage:
    python tools/fix_quarterly_percents.py              # report only, writes nothing
    python tools/fix_quarterly_percents.py --apply      # back up, then fix in place
    python tools/fix_quarterly_percents.py --symbols NICA SFCL

A report is written to .tmp/quarterly_percents_report.json. With --apply the
untouched files are first copied to .tmp/quarterly_percents_backup_<timestamp>/.
tools/harvest_all_quarterly.py calls fix_file() after each upsert.
"""

import argparse
import json
import os
import shutil
import statistics
import sys
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUARTERLY_DIR = os.path.join(ROOT, "db", "quarterly")
TMP_DIR = os.path.join(ROOT, ".tmp")

# Field name -> ceiling (percent) that a correctly stored value does not exceed.
CEILINGS = {
    "CAR": 100.0, "car": 100.0,
    "NPL": 100.0, "npl": 100.0,
    "Credit To Deposit Ratio": 1000.0, "CD ratio": 1000.0, "CD Ratio": 1000.0, "cd_ratio": 1000.0,
    "Cost of funds": 30.0, "Cost of Funds": 30.0,
    "Base Rate": 30.0,
    "Interest Spread Rate": 30.0,
}
NEIGHBOURS_EACH_SIDE = 4
AGREE_FACTOR = 3.0
MARK = "pct_fix"
# NPL is a share of the loan book, so a value above 100% cannot be real. When it is
# not explained as x100 either, it is removed from raw (the scorer then treats NPL as
# unknown) and the stored value is kept under this key.
IMPOSSIBLE_ABOVE_100 = ("NPL", "npl")
INVALID_MARK = "pct_invalid"


def _num(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(",", ""))
    except (TypeError, ValueError):
        return None


def _neighbour_median(quarters, i, field):
    lo, hi = max(0, i - NEIGHBOURS_EACH_SIDE), min(len(quarters), i + NEIGHBOURS_EACH_SIDE + 1)
    vals = []
    for j in range(lo, hi):
        if j == i:
            continue
        v = _num((quarters[j].get("raw") or {}).get(field))
        if v is not None and 0 < v <= CEILINGS[field]:
            vals.append(v)
    return statistics.median(vals) if vals else None


def _prior_fy(fy):
    try:
        a, b = fy.split("-")
        return f"{int(a) - 1}-{int(b) - 1:02d}"
    except (ValueError, AttributeError):
        return None


def _yoy(curr, prev):
    if curr is None or prev is None or prev == 0:
        return None
    return round(((curr - prev) / abs(prev)) * 100.0, 2)


def fix_quarters(quarters, doubtful=None):
    """Fix the list of quarter records in place. Returns a list of change dicts."""
    decisions = {}  # index -> {field: (old, new)}
    for i, q in enumerate(quarters):
        raw = q.get("raw") or {}
        confirmed, unconfirmed = {}, []
        for field, ceiling in CEILINGS.items():
            v = _num(raw.get(field))
            if v is None or v <= ceiling:
                continue
            med = _neighbour_median(quarters, i, field)
            if med is None:
                unconfirmed.append((field, v, None))
            elif med / AGREE_FACTOR <= v / 100.0 <= med * AGREE_FACTOR:
                confirmed[field] = (v, round(v / 100.0, 4))
            else:
                unconfirmed.append((field, v, med))
        if confirmed:
            # The row is shown to be stored x100: divide its other candidates as well.
            for field, v, med in list(unconfirmed):
                if v / 100.0 <= CEILINGS[field]:
                    confirmed[field] = (v, round(v / 100.0, 4))
                    unconfirmed.remove((field, v, med))
        invalid = {}
        for field, v, med in list(unconfirmed):
            if field in IMPOSSIBLE_ABOVE_100:
                invalid[field] = v
                unconfirmed.remove((field, v, med))
        if confirmed or invalid:
            decisions[i] = (confirmed, invalid)
        if doubtful is not None:
            for field, v, med in unconfirmed:
                doubtful.append({"fy": q.get("fy"), "quarter": q.get("quarter"), "field": field,
                                 "stored": v, "neighbour_median": med})

    by_key = {(q.get("fy"), q.get("quarter")): q for q in quarters}
    changes = []
    for i, (fields, invalid) in decisions.items():
        q = quarters[i]
        raw = q.setdefault("raw", {})
        for field, (_, new) in fields.items():
            raw[field] = new
        if fields:
            q[MARK] = sorted(set(q.get(MARK, [])) | set(fields))
        for field, v in invalid.items():
            raw.pop(field, None)
            q.setdefault(INVALID_MARK, {})[field] = v
            if isinstance(q.get("yoy"), dict):
                q["yoy"].pop(field, None)
        change = {"fy": q.get("fy"), "quarter": q.get("quarter"),
                  "raw": {f: [old, new] for f, (old, new) in fields.items()},
                  "removed": dict(invalid), "yoy": {}}
        # Recompute stored YoY of the changed fields here and one fiscal year later.
        later = next((r for r in quarters if r.get("quarter") == q.get("quarter")
                      and _prior_fy(r.get("fy")) == q.get("fy")), None)
        for rec in (q, later):
            if rec is None:
                continue
            prev = by_key.get((_prior_fy(rec.get("fy")), rec.get("quarter")))
            yoy = rec.get("yoy")
            if not isinstance(yoy, dict) or prev is None:
                continue
            for field in fields:
                if field not in yoy:
                    continue
                new = _yoy(_num((rec.get("raw") or {}).get(field)), _num((prev.get("raw") or {}).get(field)))
                if new is not None and new != yoy[field]:
                    change["yoy"][f"{rec.get('fy')} Q{rec.get('quarter')} {field}"] = [yoy[field], new]
                    yoy[field] = new
        changes.append(change)
    return changes


def fix_file(path, doubtful=None):
    """Fix one company file in place. Returns the change list (empty if nothing changed)."""
    with open(path, "r", encoding="utf-8") as f:
        doc = json.load(f)
    changes = fix_quarters(doc.get("quarters", []), doubtful)
    if changes:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(doc, f, indent=2, ensure_ascii=False)
    return changes


def run(apply=False, symbols=None, quarterly_dir=QUARTERLY_DIR, tmp_dir=TMP_DIR):
    files = sorted(f for f in os.listdir(quarterly_dir) if f.endswith(".json"))
    if symbols:
        wanted = {f"{s.upper()}.json" for s in symbols}
        files = [f for f in files if f in wanted]

    report = {"generated_at": datetime.now().isoformat(timespec="seconds"), "applied": bool(apply),
              "files_scanned": len(files), "files_changed": 0, "records_changed": 0, "values_changed": 0,
              "yoy_recomputed": 0, "doubtful_count": 0, "doubtful": {}, "companies": {}}
    pending = []
    for name in files:
        path = os.path.join(quarterly_dir, name)
        try:
            with open(path, "r", encoding="utf-8") as f:
                doc = json.load(f)
        except (OSError, ValueError) as e:
            print(f"skip {name}: {e}")
            continue
        doubtful = []
        changes = fix_quarters(doc.get("quarters", []), doubtful)
        if doubtful:
            report["doubtful"][name[:-5]] = doubtful
            report["doubtful_count"] += len(doubtful)
        if not changes:
            continue
        report["files_changed"] += 1
        report["records_changed"] += len(changes)
        report["values_changed"] += sum(len(c["raw"]) for c in changes)
        report["yoy_recomputed"] += sum(len(c["yoy"]) for c in changes)
        report["companies"][name[:-5]] = changes
        pending.append((path, doc))

    os.makedirs(tmp_dir, exist_ok=True)
    if apply and pending:
        backup = os.path.join(tmp_dir, "quarterly_percents_backup_" + datetime.now().strftime("%Y%m%d_%H%M%S"))
        os.makedirs(backup)
        for path, _ in pending:
            shutil.copy2(path, backup)
        report["backup_dir"] = backup
        for path, doc in pending:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(doc, f, indent=2, ensure_ascii=False)

    with open(os.path.join(tmp_dir, "quarterly_percents_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=1, ensure_ascii=False)
    return report


def main():
    ap = argparse.ArgumentParser(description="Divide percent ratios stored 100x too large by 100.")
    ap.add_argument("--apply", action="store_true", help="write the fix (default: report only)")
    ap.add_argument("--symbols", nargs="*", help="limit to these symbols")
    args = ap.parse_args()

    report = run(apply=args.apply, symbols=args.symbols)
    print("Applied." if args.apply else "Report only, nothing written.")
    print(f"files scanned {report['files_scanned']}, files changed {report['files_changed']}, "
          f"records changed {report['records_changed']}, values changed {report['values_changed']}, "
          f"yoy recomputed {report['yoy_recomputed']}, values in doubt {report['doubtful_count']}")
    for sym, changes in report["companies"].items():
        for c in changes:
            print(f"  {sym:8s} {c['fy']} Q{c['quarter']}: " +
                  ", ".join([f"{k} {a:g} -> {b:g}" for k, (a, b) in c["raw"].items()]
                            + [f"{k} {v:g} removed" for k, v in c.get("removed", {}).items()]))
    if report["doubtful"]:
        print("in doubt (left as stored):")
        for sym, items in report["doubtful"].items():
            for d in items:
                print(f"  {sym:8s} {d['fy']} Q{d['quarter']}: {d['field']} {d['stored']:g} "
                      f"(neighbours {d['neighbour_median']})")
    if report.get("backup_dir"):
        print("backup:", report["backup_dir"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
