# Phase 2 pre-registration: Sector Leaders backtest

Written 2026-11-07, **before** any backtest result was computed. Changing a rule below after
seeing results must be recorded as a deviation in the paper, with the reason.

## Research questions

1. **Selection (primary).** Within each sector, do companies that Sector Leaders scores higher
   earn higher returns over the next quarter?
   Measure: sector-neutral rank IC (Spearman correlation between score and next-period return
   after subtracting each sector's mean return), averaged over rebalances.
2. **Portfolio.** Does the top-3-per-sector portfolio beat a sector-matched benchmark (equal
   weight of all eligible stocks in the same sectors, held in the same sector proportions)?

Hypothesis: mean IC > 0 and mean excess return over the sector-matched benchmark > 0.
With ~15 quarterly periods the test has low statistical power; a non-significant result is
reported as "inconclusive", not as "the algorithm works" or "it does not work".

## Frozen algorithm

| File | SHA-256 |
|---|---|
| `tools/score_sector_leaders.py` | `76ee5142044a8992fd1ea7e90d3e068778d58ea6d685d2706a6bd5e80383f455` |
| `quarterly_db.py` (sector naming) | `14c723ec2de32ba6a2415ef44e8285ac7cbf5c8b7a3cce7c751dbfb88cf338a2` |

Hashes are over the file content with CRLF line endings normalised to LF, so a Windows
checkout verifies the same. The backtest imports `gate`, `score_universe` and `eps_trend`
from that file unchanged. Weights,
gates, shrinkage (k = 8), the 35.0 unverified-safety default and the 0.80 + 0.20 x coverage
haircut are all used as-is. The backtest refuses to run if either hash differs.

## Point-in-time inputs (the only places the backtest differs from production)

Production reads today's snapshot. A backtest must rebuild each company as it looked on the
signal date, so these inputs are reconstructed:

| Input | Production | Backtest (point-in-time) |
|---|---|---|
| Which quarters are known | all stored | only quarters with `quarter_end + lag <= signal date` |
| EPS trend series | all stored quarters | most recent 8 known quarters |
| P/E, P/B, Graham discount | stored at harvest-day price | recomputed from the signal-date close |
| ROA | archive snapshot, else `roa_ttm` | `roa_ttm`, else YTD net profit x 4/quarter / total assets |
| Net margin | archive snapshot | YTD net profit / YTD revenue (interest income for BFIs) |
| Turnover gate (NPR 100,000) | one capture day | median daily turnover (raw close x volume), last 20 sessions |
| Stale-price gate | `price_is_stale` flag | no trade in the 7 calendar days up to the signal date |
| Dividends (Payout pillar) | several sources, some undated | only `db/dividend_data.json` rows with `announcementDateAD <= signal date` (28 companies); others missing, which the frozen code scores as 50 |

## Test design

- **Universe:** the 327 companies in `db/quarterly` that have prices in `db/prices`.
- **Rebalance calendar:** the 60-day availability date of each fiscal quarter from FY 2079/80 Q1
  (about 2022-12-16) to FY 2082/83 Q4 (about 2026-09-14): ~15 complete holding periods.
  The calendar is fixed; the lag only changes which reports are known on each date.
- **Lags:** 60 days primary; 45 and 90 days as sensitivity runs.
- **Timing:** signal uses the close of the last session on or before the rebalance date;
  the portfolio is bought at the close of the **next** session (no same-day look-ahead) and
  held until the next rebalance's entry session.
- **Returns:** adjusted closes (bonus/rights adjusted). A stock that stops trading inside a
  period is valued at its last close and then held as cash (merger swap value is ignored).
- **Costs:** 0.5% per side on traded weight (broker commission, SEBON fee, DP fee, slippage).
  Capital-gains tax ignored. Results are reported gross and net.
- **Benchmarks:** (a) sector-matched equal weight of eligible stocks (primary),
  (b) equal weight of all eligible stocks, (c) equal weight of every stock with a valid price.
- **Statistics:** mean, t-statistic and hit rate of per-period excess returns and of IC.

## Known limitations, stated in advance

- **Short sample:** about 4 years, so low statistical power.
- **Survivorship bias:** merged or delisted companies are partly missing; 46 merged companies
  are in the universe, about 190 retired ones are not.
- **Fixed lag:** a company that published later than the lag is treated as known too early.
- **Not a true holdout:** the weights were set in September 2026 by looking at company
  rankings, not at returns. They were not fitted to this period's returns, but the designer
  knew the period. The only clean out-of-sample test is forward: the frozen rules applied to
  rebalances after 2026-11-07.
- **Possible restatements:** stored figures may be audited restatements rather than the
  numbers first published.

## Deviation log

### 2026-11-08: checklist compared against the wrong year

**What changed.** In `tools/score_sector_leaders.py`, `load_universe()` picks a "same quarter,
one year earlier" record for each company. The four year-on-year checklist items use it:
"ROA improved YoY", "Net margin improved YoY", "Leverage not rising" and "No dilution beyond
bonus". The old code took the *first* matching quarter in a list sorted oldest to newest, so it
took the *oldest* one. When each company file held 8 quarters, the oldest match was last year.
The files now go back as far as FY 2068-69 (up to 28 quarters), so the old code compared, for
example, Q1 of 2083-84 against Q1 of 2068-69 instead of Q1 of 2082-83. On the current data this
affected 239 of the 329 company files. The new helper `prior_year_quarter()` takes only the same
quarter of the immediately preceding fiscal year ("2083-84" -> "2082-83"). If that quarter is
missing, the YoY items are left unknown; the code does not fall back to an older year.

**What it touches.** Only the checklist, which is shown in the app and used as a tie-break
between companies with the same score in `score_universe()`. The composite score, its weights,
gates and pillars are unchanged.

**Effect on the Phase 2 backtest.** None. The backtest builds its own records in
`build_record()` from the most recent 8 known quarters, so in that window the only other
same-numbered quarter is the prior year's (unless a company has gaps in its reporting). It did
not read the long files through the buggy path.

**Status.** The Phase 2 results in `PHASE2_RESULTS.md` were produced with the old file hash
(`76ee5142...f455`). The fix changes that hash, so `check_frozen()` and
`test_frozen_algorithm_unchanged` now fail on purpose. `FROZEN` in
`tools/backtest_sector_leaders.py` has not been updated; whether the study adopts the fixed
version is an open decision.

**Decision (2026-11-08): adopted as frozen v2.** `FROZEN` now holds
`ece6ac96dbd20c631c8c836920b6c15f46936b3548e3276cffd9bac9c1f47c58` for
`tools/score_sector_leaders.py` (`quarterly_db.py` unchanged). The backtest was re-run under v2
at lags 45, 60 and 90 and compared with the v1 output: summaries, holdings and every per-period
figure are identical, confirming the "no effect" statement above.

### 2026-11-14: dividend history was loaded for only 28 of 329 companies

**What changed.** `db/dividend_data.json` held dividend rows for the 28 portfolio holdings only,
because `tools/scrape_dividends.py` fetches holdings unless run with `--all`. It was re-run with
`--all` (HamroShare bulk) and then `--all --fill-gaps` (new mode: adds fiscal years that
NepaliPaisa has and HamroShare omits, never touching existing rows). The file now has rows for 223
companies (1,358 rows, up from 28 companies); 112 more symbols are stored with no dividends
because neither source lists them. The scorer and `quarterly_db.py` are unchanged; the frozen
hash is unchanged. The data fingerprint of the forward test changes from this date.

**Why it mattered.** The backtest reads dividends only from this file, so before the fix the
Yield pillar had no dividend inputs for 307 of 329 companies. Only rows with an announcement date
reach the backtest: 57 rows (28 companies) before, 582 rows (335 symbol keys) after.

**Effect on the Phase 2 backtest** (re-run in memory, nothing written to `docs/research/results`).
Leader slots changed: 42 of 490 (lag 45), 43 of 487 (lag 60), 45 of 488 (lag 90).

| Lag | Annualised return | Mean excess per period | Mean IC |
|-----|-------------------|------------------------|---------|
| 45  | 16.01% to 17.00%  | +0.26% to +0.47%       | 0.0902 to 0.0892 |
| 60  | 13.10% to 13.17%  | -0.21% to -0.19%       | 0.0753 to 0.0761 |
| 90  | 12.23% to 11.79%  | +0.08% to -0.01%       | 0.0746 to 0.0786 |

No conclusion changes, but the published `PHASE2_RESULTS.md` figures were produced with the
sparse file. **Open decision:** whether to re-run and republish Phase 2 on the full dividend data.
Source values differ slightly between HamroShare and NepaliPaisa (rounding, and HBL 078-079 has
bonus and cash swapped between them); HamroShare is kept where both exist.

**Decision (2026-11-15): re-run and republish.** The backtest was re-run at lags 45, 60 and 90
on the full dividend data (frozen v2 hash unchanged) and `PHASE2_RESULTS.md` now carries the new
figures, with the first run kept at the end of that file. Against the 28-company run the
annualised gross return moves from 16.0% to 17.0% (lag 45), 13.1% to 13.2% (lag 60) and 12.2% to
11.8% (lag 90); mean IC from 0.091 to 0.089, 0.076 to 0.076 and 0.075 to 0.078; IC t-statistics
fall slightly (2.16 to 1.96, 1.73 to 1.59, 1.73 to 1.64). The in-memory table above differs from
these by a few thousandths because quarterly and price files were refreshed between the two runs;
the republished figures are the authoritative ones.

### 2026-11-15: proposed v3 (profit growth in Growth; cash and bonus ranked separately). Not adopted

**Status.** Proposal only. The scorer is unchanged and the frozen hash (v2) still holds. The
draft code is `docs/research/proposals/v3_profit_growth_cash_bonus_split.patch`; apply it with
`git apply` only after the decision below.

**What the patch changes.**

1. *Growth pillar.* The 0.45 weight moves from EPS growth to net-profit growth, falling back to
   EPS growth when profit growth is not reported. Reason: a bonus or rights issue lowers EPS
   without lowering profit, so EPS growth marks down companies that issue shares. Revenue growth
   (0.25) and EPS consistency (0.30) are unchanged.
2. *Payout pillar.* The 0.25 weight on the 5-year average total dividend (cash + bonus added at
   face value) is split into 0.125 on average cash and 0.125 on average bonus, each ranked on its
   own. Cash that only covers the 5% dividend tax on a bonus (cash within 0.02 points of 5% of the
   total) is counted as zero cash. Payout ratio (0.30), dividend yield (0.25) and paying-years
   (0.20) are unchanged. `bonus_avg5` (the total) is kept for the checklist.
3. `tools/backtest_sector_leaders.py` `build_record()` calls the same new helper
   (`dividend_stats`) so the backtest and the live loader compute these fields identically.

**How it arose (exploratory, not pre-registered, returns were seen).** A check on 15 quarters
(entries 2022-12 to 2026-06) asked whether dividend form predicts next-quarter return relative to
the sector. Sector-neutral rank IC at lag 60: 5-year bonus -0.041 (t -1.26), 5-year cash +0.001
(t 0.02), cash yield +0.013 (t 0.59), EPS growth +0.019 (t 0.75), profit growth +0.041 (t 1.34).
Profit growth was ahead of EPS growth at lags 45 and 90 as well (t 1.67 and 2.67). There is no
evidence that bonus-heavy payers outperform cash-heavy ones, so the patch does not weight bonus
above cash.

**Effect on the Phase 2 backtest** (in memory, full dividend file of 2026-11-14, nothing written
to `docs/research/results`). v2 to v3:

| Lag | Annualised gross | Mean excess per period | Mean IC | Leader slots changed |
|-----|------------------|------------------------|---------|----------------------|
| 45  | 17.00% to 17.01% | +0.47% to +0.47%       | 0.0885 to 0.0880 | 13 of 490 |
| 60  | 13.17% to 13.50% | -0.19% to -0.11%       | 0.0756 to 0.0775 | 12 of 487 |
| 90  | 11.79% to 11.99% | -0.01% to +0.04%       | 0.0780 to 0.0799 | 12 of 488 |

All differences are far inside the noise of 15 periods. On the live data the top 3 changes in 3
of 12 sectors (Hydropower: RHPC replaces UHEWA; Finance: SIFC replaces BFC; Manufacturing: HDL
moves ahead of BNT and SARBTM replaces UNL).

**Other faults seen, not addressed by the patch.**

- `build_record()` computes payout ratio and dividend yield from the latest *cash* dividend only;
  the live loader uses NepseAlpha's cash-plus-bonus totals. The two should agree.
- "Last 5 years" of dividends is the last 5 rows on file; for 54 of 223 companies those rows skip
  fiscal years.
- EPS consistency and EPS stability are still diluted by bonus and rights issues.
- The checklist item "No dilution beyond bonus" compares share growth with the 5-year average
  total dividend, not with that year's bonus.

**Open decision.** Adopt as frozen v3, or leave v2. Applying the patch changes the scorer hash,
so `check_frozen()`, `test_frozen_algorithm_unchanged` and the forward-test recorder stop until
`FROZEN` is updated. Because the change was motivated by looking at returns, adopting it before
the first forward rebalance (2026-12-16) keeps the forward test clean; adopting it later would
split the forward record into two rule sets.

**Decision (2026-11-15): adopted as frozen v3**, before any forward record exists. The patch was
applied unchanged. `FROZEN` now holds
`bc87cc97f2013bbaa299cd67928b4826f0310d759798d8c7a091c231ff916be1` for
`tools/score_sector_leaders.py` (`quarterly_db.py` unchanged); the forward-test protocol's frozen
table was updated the same day. All 229 tests in `tools/` pass. The four faults listed above
remain open.

How the study treats it: **v2 stays the pre-registered Phase 2 result**; v3 is the rule set of the
forward test. Because v3 came from an exploratory look at returns over the backtest sample, its
backtest is in-sample and is reported beside v2, not in place of it. On the corrected data of
2026-11-15 (after the percent entry below), v2 to v3:

| Lag | Annualised gross | Mean excess per period (t) | Mean IC (t) | Leader slots changed |
|-----|------------------|----------------------------|-------------|----------------------|
| 45  | 17.19% to 17.19% | +0.50% (0.70) to +0.50% (0.72) | 0.0879 (1.95) to 0.0882 (1.95) | 13 of 490 |
| 60  | 13.35% to 14.02% | -0.15% (-0.21) to +0.00% (0.00) | 0.0744 (1.56) to 0.0770 (1.62) | 13 of 487 |
| 90  | 11.79% to 12.34% | -0.01% (-0.02) to +0.11% (0.18) | 0.0783 (1.64) to 0.0803 (1.67) | 13 of 488 |

These agree with the in-memory estimate above to within the effect of the two data corrections.
`PHASE2_RESULTS.md` was republished with both versions.

### 2026-11-15: operating and expense lines were stored in thousands

**What was wrong.** The source reports amounts in thousands of rupees.
`tools/harvest_all_quarterly.py` multiplies each amount by 1,000 unless `is_ratio_or_per_share()`
says the field is a ratio or a per-share figure. That test matched substrings, and two of its
terms hit amount fields: "pe" (meant for P/E) matches "O**pe**rating" and "Ex**pe**nses", and
"ratio" matches "Ope**ratio**n". Eight amount fields were therefore stored in thousands while
the rest of the same record is in rupees: Operating Profit, Total Operating Profit, Total
Operating Income, Revenue from Operation, Revenue from Operations, Total Expenses And
Provisions, Total Expenses and Management Expenses. Records that reached the files through the
other import path in the same tool were mostly stored correctly, so the fault is per record.

**What changed.**

- `tools/harvest_all_quarterly.py`: `is_ratio_or_per_share()` now matches whole words, and the
  second import path uses the same function. On the 83 distinct field names in the dataset the
  old and new tests disagree on exactly the eight fields above.
- `tools/fix_quarterly_units.py` (new, with `tools/test_fix_quarterly_units.py`) converted the
  stored data in place. Each converted record carries a `unit_fix` key listing the fields that
  were multiplied, so the tool cannot convert a record twice. 3,886 quarter records in 272 of 329
  company files were converted. The files as they were are in
  `.tmp/quarterly_units_backup_20261115_114041/`; the full list of changes is in
  `.tmp/quarterly_units_report_after.json`.
- `computed.revenue_ttm` was corrected in 148 records where the harvest tool had copied it from
  "Revenue from Operation" or "Total Operating Income". Four year-on-year figures for Operating
  Profit that had been computed across mixed units were recomputed (HDHPC 2081-82 Q3, NHPC
  2079-80 Q4, SHINE 2081-82 Q1 and 2082-83 Q1). No year-on-year figure for revenue changed.
- The scorer and `quarterly_db.py` are unchanged; the frozen hashes are unchanged. The data
  fingerprint of the forward test changes from this date.

**How the unit of a record was decided.** By size against a figure stored in rupees in the same
record: total assets where present (the affected lines fall into two separate groups, below about
0.03% of assets and above about 0.3%), total revenue or net premium for insurers without total
assets, and net profit as a cross-check. A record with no such figure took the unit of the same
quarter one year away when the two stored values were within a factor of 20. The rules and
cut-offs are constants at the top of the tool.

**Left in doubt (not changed further).** GCIL 2081-82 Q3 and 2082-83 Q3 (Total Operating
Profit), MKHL 2081-82 Q4 and 2082-83 Q4 (Operating Profit), and the year-on-year figure for
HDHPC 2082-83 Q3 (Operating Profit). Two records still look wrong after conversion because their
stored total assets figure is itself doubtful: ILBS 2081-82 Q1 and MBJC 2083-84 Q1.

**What it touches in the scorer.** The scorer does not read any of the eight fields. It reads
`computed.revenue_ttm`, from which the backtest derives net margin. That figure was 1,000 times
too small for the 148 records above (hotels, manufacturing and other companies whose revenue
line is "Revenue from Operation", and a few with only "Total Operating Income"), which made their
net margin 1,000 times too large.

**Effect on the Phase 2 backtest** (frozen v2, full dividend file of 2026-11-14, re-run before
and after on the same day; outputs in `.tmp/backtest_before/` and `.tmp/backtest/`, nothing
written to `docs/research/results`).

| Lag | Annualised gross | Mean excess per period | Mean IC | Leader slots changed |
|-----|------------------|------------------------|---------|----------------------|
| 45  | 17.00% to 17.12% | +0.47% to +0.49%       | 0.0885 to 0.0883 | 1 of 490 |
| 60  | 13.17% to 13.29% | -0.19% to -0.16%       | 0.0756 to 0.0749 | 1 of 487 |
| 90  | 11.79% to 11.78% | -0.01% to -0.02%       | 0.0780 to 0.0772 | 1 of 488 |

The one changed slot is in Manufacturing: SHIVM replaces BNL (rebalance of 2025-12-16 at lags 45
and 60, 2026-03-15 at lag 90). No conclusion changes.

**Not addressed.** The percent ratios stored without a decimal point (for example CAR 11.12 as
1112 in a few NICA, NABIL and SFCL records) are a separate fault and are unchanged. "Asset
Turnover TTM" and similar source-provided ratios were not reviewed.

**Open decision.** As with the dividend entry of 2026-11-14, the published `PHASE2_RESULTS.md`
figures predate this fix; whether to re-run and republish Phase 2 on the corrected data.

**Decision (2026-11-15): republished.** `PHASE2_RESULTS.md` was re-run and republished once,
covering this correction, the percent correction below and v3.

### 2026-11-15: bank ratios stored 100 times too large

**What was wrong.** For some quarters HamroShare serves bank ratios without the decimal point:
CAR 11.12 arrives as 1112, NPL 9.81 as 981, Base Rate 5.55 as 555. A read-only fetch on
2026-11-15 confirmed the source still serves them this way (NICA 2083-84 Q1, NABIL 2082-83 Q1,
SFCL 2082-83 Q3). `tools/harvest_all_quarterly.py` passes ratios through unchanged, and a later
harvest deep-merges the row again, so the error stays in the files. Sometimes the whole row is
affected, sometimes one field. A few NPL values above 100% are not explained as x100 at all
(GFCL 2081-82 Q1 110.61 and 2082-83 Q1 104.19, NMFBS 2081-82 Q2 129.08, PRVU 2080-81 Q3 127.88).

**What it touches in the scorer.** The scorer reads CAR, NPL and the CD ratio (Safety pillar) and
excludes a bank or financial company whose NPL exceeds 10%. On the live data before the fix, NICA
and SFCL were excluded on "NPL 981%" and "NPL 809%".

**What changed.**

- `tools/fix_quarterly_percents.py` (new, with `tools/test_fix_quarterly_percents.py`). A value
  is a candidate only above a ceiling that a real figure does not reach (NPL and CAR 100%, CD
  ratio 1,000%, cost of funds, base rate and spread 30%). It is divided by 100 only when the
  result is within a factor of 3 of the median of the same field in up to four neighbouring
  quarters on each side. Once one field of a row is confirmed, the row's other candidates are
  divided too. An NPL above 100% that is not explained this way is removed from `raw` and kept
  under `pct_invalid`, so the scorer treats it as unknown. Changed records carry `pct_fix`.
  Stored year-on-year figures of a changed field were recomputed in that record and one fiscal
  year later. 41 values in 22 records of 19 companies changed (37 divided, 4 NPL removed);
  55 year-on-year figures recomputed. A second run changes nothing. Backup:
  `.tmp/quarterly_percents_backup_20261115_120240/`; report: `.tmp/quarterly_percents_report.json`.
- `tools/harvest_all_quarterly.py` calls the same fix on each company file after every upsert,
  so a re-harvest cannot write the x100 values back.
- The scorer and `quarterly_db.py` are unchanged by this entry. The data fingerprint of the
  forward test changes from this date.

**Left as stored (21 values, listed in the report).** Real values above a ceiling that the
neighbour test keeps: NIFRA's CAR of 100% to 344% in 2076-77 to 2079-80 (a new infrastructure
bank), and microfinance cost-of-funds and CD figures that do not fit either reading (for
example KLBS CD ratio about 1,850% to 2,300% in three quarters, GLBSL cost of funds 145.27 in
2083-84 Q1). Also CORBL 2079-80 Q1 CAR 148.49, GMFBS 2073-74 Q2 CAR 310.58 and SABSL 2073-74 Q4
CAR 173.08. The scorer does not read cost of funds; the CAR and CD values in doubt are in
quarters before or at the start of the backtest window.

**Effect on the Phase 2 backtest** (frozen v2, after the unit correction; outputs in
`.tmp/bt_v2_pre_pct/` and `.tmp/bt_v2_post_pct/`).

| Lag | Annualised gross | Mean excess per period | Mean IC | Leader slots changed |
|-----|------------------|------------------------|---------|----------------------|
| 45  | 17.12% to 17.19% | +0.49% to +0.50%       | 0.0883 to 0.0879 | 1 of 490 |
| 60  | 13.29% to 13.35% | -0.16% to -0.15%       | 0.0749 to 0.0744 | 1 of 487 |
| 90  | 11.78% to 11.79% | -0.02% to -0.01%       | 0.0772 to 0.0783 | 1 of 488 |

The one changed slot is in Finance: GFCL, previously excluded on an NPL of 104.19%, replaces
ICFC (rebalance of 2025-12-16 at lags 45 and 60, 2026-03-15 at lag 90). No conclusion changes.
The large effect is on the live ranking and so on the forward test: NICA and SFCL are eligible
again.
