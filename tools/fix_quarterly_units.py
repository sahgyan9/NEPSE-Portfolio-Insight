"""
Fix amounts stored in thousands in db/quarterly
===============================================
The source reports amounts in thousands of rupees. tools/harvest_all_quarterly.py
multiplies them by 1,000 unless a field is a ratio or per-share figure. Its old
test for that was a substring match, and the terms "pe" (for P/E) and "ratio"
also matched "Operating", "Operation" and "Expenses". Eight amount fields were
therefore stored in thousands while the rest of the same record is in rupees.

This tool converts those fields to rupees and repairs the values built from
them. It decides record by record, because records that reached the files by
another import path are already in rupees. A record that cannot be judged alone
(mostly old records without total assets) takes the unit of the same quarter one
year away when the two stored values are the same size. Fields that stay
undecided are left as stored and listed in the report. Running it twice changes
nothing the second time.

Usage:
    python tools/fix_quarterly_units.py              # report only, writes nothing
    python tools/fix_quarterly_units.py --apply      # back up, then fix in place
    python tools/fix_quarterly_units.py --symbols NABIL CHCL

What changes in a converted record:
  raw[<field>]                 x 1,000 for the affected fields
  unit_fix                     new key listing the fields that were multiplied,
                               so a later run leaves them alone
  computed.revenue_ttm         when it was copied from an affected field
  computed.revenue_till_qtr    same
  yoy[<key>]                   only where exactly one of the two quarters compared
                               was converted and the stored figure is the one
                               the harvest tool computed from that pair
  computed.dupont_*, revenue_per_share, operating_profit_margin, combined_ratio
                               only where already present, with the formulas
                               of tools/compute_derived_metrics.py

A report is written to .tmp/quarterly_units_report.json. With --apply the
untouched files are first copied to .tmp/quarterly_units_backup_<timestamp>/.
"""

import argparse
import json
import os
import shutil
import sys
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUARTERLY_DIR = os.path.join(ROOT, "db", "quarterly")
TMP_DIR = os.path.join(ROOT, ".tmp")

# Income and expense lines: large next to total assets when stored in rupees.
VOLUME_FIELDS = (
    "Total Operating Income",
    "Revenue from Operation",
    "Revenue from Operations",
    "Total Expenses And Provisions",
    "Total Expenses",
)
# Profit and small expense lines: can be near zero, so judged by a volume line when one is present.
OTHER_FIELDS = ("Operating Profit", "Total Operating Profit", "Management Expenses")
AFFECTED_FIELDS = VOLUME_FIELDS + OTHER_FIELDS

# Across the dataset each line forms two separate groups by size relative to total
# assets: below about 0.03% (thousands) and above about 0.3% (rupees), with almost
# nothing between. The cut-offs sit in that gap.
VOLUME_CUTOFF = 5e-3
INCOME_FIELDS = ("Total Operating Income", "Revenue from Operation", "Revenue from Operations")
EXPENSE_FIELDS = ("Total Expenses And Provisions", "Total Expenses")
# Against total revenue (insurers): expenses in thousands sit near 0.03% to 0.1% of revenue,
# in rupees near 50% to 110%. Management expenses: under 0.1% in thousands, over 1% in rupees.
EXPENSE_CUTOFF = 2e-2
MANAGEMENT_CUTOFF = 2e-3
# A year-on-year figure outside this range signals that one of the two quarters is still in doubt.
YOY_PLAUSIBLE = (-99.0, 1000.0)
PROFIT_THOUSANDS_BELOW = 1e-4   # profit under 0.01% of assets: thousands
PROFIT_RUPEES_FROM = 1e-3       # profit from 0.1% of assets: rupees; between the two, more evidence is needed
# Two values of the same line, one year apart, count as "the same size" within this factor.
SAME_SIZE_FACTOR = 20.0

# Each converted record is stamped with this key, listing the fields that were multiplied.
# A small genuine amount can still look like "thousands" after conversion, so the stamp, not
# the size test, is what stops a second run from converting it again.
MARKER = "unit_fix"

# Order in which the harvest tool picks "revenue" for computed.revenue_ttm.
REVENUE_PRECEDENCE = ("Revenue", "Revenue from Operation", "Interest Income", "Total Operating Income")


def _num(raw, key):
    v = raw.get(key)
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    return v if v != 0 else None


def stored_in_thousands(raw):
    """True when this record's affected lines are in thousands, False when in rupees, None when it cannot be told
    from the record alone (the caller then compares with the same quarter of neighbouring years)."""
    assets = _num(raw, "Total Assets")
    net_profit = _num(raw, "Net Profit")

    # Income for the period cannot be far below the profit made from it. This holds even
    # where the record's total assets figure is itself wrong.
    if net_profit is not None:
        for key in INCOME_FIELDS:
            v = _num(raw, key)
            if v is not None and abs(v) < abs(net_profit) / 2.0:
                return True

    if assets and assets > 0:
        for key in VOLUME_FIELDS:
            v = _num(raw, key)
            if v is not None:
                return abs(v) / assets < VOLUME_CUTOFF

    # Insurance records often carry no total assets. Expenses are then compared with
    # total revenue or net premium, which are stored in rupees.
    turnover = _num(raw, "Total Revenue") or _num(raw, "Net Premium")
    if turnover and turnover > 0:
        for key in EXPENSE_FIELDS:
            v = _num(raw, key)
            if v is not None:
                return abs(v) / turnover < EXPENSE_CUTOFF
        mgmt = _num(raw, "Management Expenses")
        if mgmt is not None and _num(raw, "Operating Profit") is None and _num(raw, "Total Operating Profit") is None:
            return abs(mgmt) / turnover < MANAGEMENT_CUTOFF

    profit = _num(raw, "Operating Profit")
    if profit is None:
        profit = _num(raw, "Total Operating Profit")
    if profit is None:
        profit = _num(raw, "Management Expenses")
        if profit is None:
            return None

    revenue = _num(raw, "Revenue")  # "Revenue" itself is stored in rupees
    if assets and assets > 0:
        share = abs(profit) / assets
        if share < PROFIT_THOUSANDS_BELOW:
            return True
        if share >= PROFIT_RUPEES_FROM:
            return False
        # In between: a profit cannot be much larger than the revenue it came from.
        if revenue and revenue > 0 and profit > 0:
            return abs(profit) * 1000.0 <= 1.5 * revenue
        return None

    if revenue and revenue > 0 and profit > 0:
        if abs(profit) * 1000.0 > 1.5 * revenue:
            return False
        if abs(profit) < revenue / 200.0:
            return True
        return None
    return None


def _scalable(raw, key):
    """Whether one affected field of a thousands-record should be multiplied. A few records mix both units."""
    v = raw.get(key)
    if isinstance(v, bool) or not isinstance(v, (int, float)) or v == 0:
        return False
    # A line 30 times smaller than net profit is in thousands whatever the assets figure says
    # (a few records have a wrong total assets value).
    net_profit = _num(raw, "Net Profit")
    if net_profit is not None and key not in EXPENSE_FIELDS and key != "Management Expenses" \
            and abs(v) * 30.0 < abs(net_profit):
        return True
    assets = _num(raw, "Total Assets")
    if assets and assets > 0:
        limit = VOLUME_CUTOFF if key in VOLUME_FIELDS else PROFIT_RUPEES_FROM
        if abs(v) / assets >= limit:
            return False
    return True


def fields_to_scale(raw):
    """Affected fields to multiply, judged from this record alone."""
    if stored_in_thousands(raw) is not True:
        return []
    return [k for k in AFFECTED_FIELDS if _scalable(raw, k)]


def _close(a, b):
    return a is not None and b is not None and abs(a - b) <= max(0.01, abs(b) * 1e-9)


def _prev_fy(fy):
    """ "2083-84" -> "2082-83" """
    try:
        start = int(str(fy).split("-")[0])
    except (ValueError, IndexError):
        return None
    return f"{start - 1}-{str(start % 100).zfill(2)}"


def _yoy(curr, prev):
    if curr is None or prev is None or prev == 0:
        return None
    return round(((curr - prev) / abs(prev)) * 100.0, 2)


def _next_fy(fy):
    """ "2082-83" -> "2083-84" """
    try:
        start = int(str(fy).split("-")[0])
    except (ValueError, IndexError):
        return None
    return f"{start + 1}-{str((start + 2) % 100).zfill(2)}"


def _same_size(a, b):
    return 1.0 / SAME_SIZE_FACTOR <= abs(a) / abs(b) <= SAME_SIZE_FACTOR


def plan_document(quarters):
    """Decide, for every quarter, which affected fields are in thousands.

    Returns (scale, unresolved):
      scale       {(fy, quarter): [fields to multiply]}
      unresolved  fields that could not be decided, or that disagree with a neighbouring year
    """
    by_ident = {(q.get("fy"), q.get("quarter")): q for q in quarters}
    done = {i: set(((q.get(MARKER) or {}).get("fields")) or []) for i, q in by_ident.items()}
    status = {i: stored_in_thousands(q.get("raw") or {}) for i, q in by_ident.items()}
    scale = {i: set(fields_to_scale(q.get("raw") or {})) - done[i] for i, q in by_ident.items()}
    # Fields already known to be in rupees: judged so from the record, or converted by an earlier run.
    rupees = {}
    for i, q in by_ident.items():
        raw = q.get("raw") or {}
        rupees[i] = set(done[i])
        if status[i] is not None:
            rupees[i] |= {k for k in AFFECTED_FIELDS if _num(raw, k) is not None and k not in scale[i]}
        if done[i]:
            status[i] = False  # already handled; do not take a unit from a neighbouring year

    def neighbours(ident):
        fy, qn = ident
        for other in ((_prev_fy(fy), qn), (_next_fy(fy), qn)):
            if other in by_ident:
                yield other

    # A record that cannot be judged alone takes the unit of the same quarter one year away,
    # when the two stored values are the same size. Repeated so a decision can travel across years.
    progress = True
    while progress:
        progress = False
        for ident, q in by_ident.items():
            if status[ident] is not None:
                continue
            raw = q.get("raw") or {}
            for key in AFFECTED_FIELDS:
                v = _num(raw, key)
                if v is None or key in scale[ident] or key in rupees[ident]:
                    continue
                for other in neighbours(ident):
                    ov = _num(by_ident[other].get("raw") or {}, key)
                    if ov is None or not _same_size(v, ov):
                        continue
                    if key in scale[other]:
                        scale[ident].add(key)
                    elif key in rupees[other]:
                        rupees[ident].add(key)
                    else:
                        continue
                    progress = True
                    break

    unresolved = []
    for ident, q in by_ident.items():
        raw = q.get("raw") or {}
        for key in AFFECTED_FIELDS:
            v = _num(raw, key)
            if v is None:
                continue
            if key not in scale[ident] and key not in rupees[ident]:
                unresolved.append({"fy": ident[0], "quarter": ident[1], "field": key, "value": v,
                                   "reason": "undecided: no evidence in the record or in neighbouring years"})
                continue
            for other in neighbours(ident):
                ov = _num(by_ident[other].get("raw") or {}, key)
                if ov is None:
                    continue
                if done[ident] or done[other]:
                    continue
                if _same_size(v, ov) and (key in scale[ident]) != (key in scale[other]):
                    unresolved.append({"fy": ident[0], "quarter": ident[1], "field": key, "value": v,
                                       "reason": f"in doubt: same size as {other[0]} Q{other[1]} but decided differently"})
                    break
    return {i: sorted(f) for i, f in scale.items() if f}, unresolved


def fix_document(doc, unresolved_out=None):
    """Fix one company file in memory. Returns a list of change records (empty when nothing changed)."""
    quarters = doc.get("quarters") or []
    plan, unresolved = plan_document(quarters)
    if unresolved_out is not None:
        unresolved_out.extend(unresolved)
    changes = []
    # (fy, quarter) -> set of keys whose stored value changed, in raw or computed
    changed_keys = {}
    # (fy, quarter) -> {key: value before the fix}
    before = {}

    for q in quarters:
        ident = (q.get("fy"), q.get("quarter"))
        scale = plan.get(ident)
        if not scale:
            continue
        raw = q.get("raw") or {}
        old_raw = {k: raw[k] for k in scale}
        for k in scale:
            raw[k] = round(raw[k] * 1000.0, 2)
        touched = set(scale)
        previous = (q.get(MARKER) or {}).get("fields") or []
        q[MARKER] = {"fields": sorted(set(previous) | set(scale)), "factor": 1000, "tool": "tools/fix_quarterly_units.py"}
        before[ident] = dict(old_raw)
        rec = {"fy": ident[0], "quarter": ident[1], "raw": {k: [old_raw[k], raw[k]] for k in scale}, "computed": {}}

        computed = q.get("computed") or {}
        # The harvest tool copied revenue from the first of these fields that had a value.
        source = next((k for k in REVENUE_PRECEDENCE if old_raw.get(k, raw.get(k))), None)
        if source in old_raw:
            for ck in ("revenue_ttm", "revenue_till_qtr"):
                if _close(computed.get(ck), old_raw[source]):
                    rec["computed"][ck] = [computed[ck], raw[source]]
                    before[ident][ck] = computed[ck]
                    computed[ck] = raw[source]
                    touched.add(ck)

        changed_keys[ident] = touched
        changes.append(rec)

    if not changes:
        return changes

    by_ident = {(q.get("fy"), q.get("quarter")): q for q in quarters}
    by_change = {(c["fy"], c["quarter"]): c for c in changes}

    def value(q, key, old=False):
        ident = (q.get("fy"), q.get("quarter"))
        if old and key in before.get(ident, {}):
            return before[ident][key]
        src = (q.get("computed") or {}) if key.startswith("revenue_t") else (q.get("raw") or {})
        return src.get(key)

    # Year-on-year figures. A pair converted on both sides keeps its percentage. A figure is
    # recomputed only when exactly one side was converted AND the stored figure is the one the
    # harvest tool computed from that pair (other figures come straight from the source).
    watch = set(AFFECTED_FIELDS) | {"revenue_ttm", "revenue_till_qtr"}
    ordered = sorted(quarters, key=lambda x: (str(x.get("fy", "")), x.get("quarter") or 0))
    for idx, q in enumerate(ordered):
        ident = (q.get("fy"), q.get("quarter"))
        yoy = q.get("yoy")
        if not isinstance(yoy, dict):
            continue
        partners = [by_ident.get((_prev_fy(ident[0]), ident[1])), ordered[idx - 4] if idx >= 4 else None]
        for key in watch:
            if key not in yoy:
                continue
            for prev in partners:
                if prev is None:
                    continue
                pident = (prev.get("fy"), prev.get("quarter"))
                if (key in changed_keys.get(ident, ())) == (key in changed_keys.get(pident, ())):
                    continue
                if not _close(yoy[key], _yoy(value(q, key, old=True), value(prev, key, old=True))):
                    continue
                new = _yoy(value(q, key), value(prev, key))
                if new is None or new == yoy[key]:
                    break
                if not (YOY_PLAUSIBLE[0] < new < YOY_PLAUSIBLE[1]):
                    # One side is still wrong in the stored data. Keep the stored figure and report it.
                    if unresolved_out is not None:
                        unresolved_out.append({"fy": ident[0], "quarter": ident[1], "field": key,
                                               "value": value(q, key),
                                               "reason": f"in doubt: year-on-year against {pident[0]} Q{pident[1]} "
                                                         f"would become {new}%, left at {yoy[key]}%"})
                    break
                rec = by_change.setdefault(ident, {"fy": ident[0], "quarter": ident[1], "raw": {}, "computed": {}})
                rec.setdefault("yoy", {})[key] = [yoy[key], new]
                yoy[key] = new
                break

    # Derived ratios, only where a value is already stored. Formulas: tools/compute_derived_metrics.py.
    for q in quarters:
        ident = (q.get("fy"), q.get("quarter"))
        touched = changed_keys.get(ident)
        if not touched:
            continue
        raw, computed = q.get("raw") or {}, q.get("computed") or {}
        rec = by_change[ident]

        def put(key, value):
            if key in computed and computed[key] is not None and value is not None and computed[key] != value:
                rec["computed"][key] = [computed[key], value]
                computed[key] = value

        if "revenue_ttm" in touched:
            profit = computed.get("net_profit_ttm") or raw.get("Net Profit")
            revenue = computed.get("revenue_ttm") or raw.get("Revenue")
            assets, equity = raw.get("Total Assets"), raw.get("Total Equity")
            margin = round((profit / revenue) * 100, 2) if profit and revenue else None
            turnover = round(revenue / assets, 4) if revenue and assets else None
            multiplier = round(assets / equity, 2) if assets and equity and equity > 0 else None
            put("dupont_net_margin", margin)
            put("dupont_asset_turnover", turnover)
            if None not in (margin, turnover, multiplier):
                put("dupont_roe", round(margin * turnover * multiplier, 2))
            shares = raw.get("Number of Shares")
            if revenue and shares and shares > 0:
                put("revenue_per_share", round(revenue / shares, 2))

        if touched & {"Operating Profit", "Total Operating Income"}:
            op = raw.get("Operating Profit")
            base = raw.get("Revenue") or raw.get("Interest Income") or raw.get("Total Operating Income")
            if op is not None and base and base > 0:
                put("operating_profit_margin", round((op / base) * 100, 2))

        if "Management Expenses" in touched:
            claim, premium, mgmt = raw.get("Net Claim Payment"), raw.get("Net Premium"), raw.get("Management Expenses")
            if claim and premium and premium > 0:
                put("combined_ratio", round((claim / premium + (mgmt / premium if mgmt else 0.0)) * 100, 2))

    return [c for c in by_change.values() if c.get("raw") or c.get("computed") or c.get("yoy")]


def run(apply=False, symbols=None, quarterly_dir=QUARTERLY_DIR, tmp_dir=TMP_DIR):
    files = sorted(f for f in os.listdir(quarterly_dir) if f.endswith(".json"))
    if symbols:
        wanted = {f"{s.upper()}.json" for s in symbols}
        files = [f for f in files if f in wanted]

    report = {"generated_at": datetime.now().isoformat(timespec="seconds"), "applied": bool(apply),
              "files_scanned": len(files), "files_changed": 0, "records_changed": 0,
              "field_counts": {}, "computed_counts": {}, "yoy_recomputed": 0, "unresolved_count": 0,
              "unresolved": {}, "companies": {}}
    pending = []

    for name in files:
        path = os.path.join(quarterly_dir, name)
        try:
            with open(path, "r", encoding="utf-8") as f:
                doc = json.load(f)
        except (OSError, ValueError) as e:
            print(f"skip {name}: {e}")
            continue
        unresolved = []
        changes = fix_document(doc, unresolved)
        if unresolved:
            report["unresolved"][name[:-5]] = unresolved
            report["unresolved_count"] += len(unresolved)
        if not changes:
            continue
        report["files_changed"] += 1
        report["records_changed"] += sum(1 for c in changes if c.get("raw"))
        for c in changes:
            for k in c.get("raw", {}):
                report["field_counts"][k] = report["field_counts"].get(k, 0) + 1
            for k in c.get("computed", {}):
                report["computed_counts"][k] = report["computed_counts"].get(k, 0) + 1
            report["yoy_recomputed"] += len(c.get("yoy", {}))
        report["companies"][name[:-5]] = changes
        pending.append((path, doc))

    os.makedirs(tmp_dir, exist_ok=True)
    if apply and pending:
        backup = os.path.join(tmp_dir, "quarterly_units_backup_" + datetime.now().strftime("%Y%m%d_%H%M%S"))
        os.makedirs(backup)
        for path, _ in pending:
            shutil.copy2(path, backup)
        report["backup_dir"] = backup
        for path, doc in pending:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(doc, f, indent=2, ensure_ascii=False)

    with open(os.path.join(tmp_dir, "quarterly_units_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=1, ensure_ascii=False)
    return report


def main():
    ap = argparse.ArgumentParser(description="Convert quarterly amounts stored in thousands to rupees.")
    ap.add_argument("--apply", action="store_true", help="write the fix (default: report only)")
    ap.add_argument("--symbols", nargs="*", help="limit to these symbols")
    args = ap.parse_args()

    report = run(apply=args.apply, symbols=args.symbols)
    print(("Applied." if args.apply else "Report only, nothing written."))
    print(f"files scanned {report['files_scanned']}, files changed {report['files_changed']}, "
          f"records changed {report['records_changed']}, yoy recomputed {report['yoy_recomputed']}, "
          f"fields undecided or in doubt {report['unresolved_count']}")
    print("fields:", json.dumps(report["field_counts"], indent=1))
    print("computed:", json.dumps(report["computed_counts"], indent=1))
    if report.get("backup_dir"):
        print("backup:", report["backup_dir"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
