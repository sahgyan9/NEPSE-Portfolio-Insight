# Forward test protocol: Sector Leaders (out-of-sample)

Written 2026-11-08, **before** the first recorded forward run. Changing a rule below after a
record exists must be entered in the deviation log at the end, with the date and the reason.

## Why a forward test

The Phase 2 backtest ([PHASE2_PREREGISTRATION.md](PHASE2_PREREGISTRATION.md),
[PHASE2_RESULTS.md](PHASE2_RESULTS.md)) is not a true holdout: the scorer's weights were set in
September 2026 by someone who knew the 2022-2026 period. The only clean test is forward: the
frozen rules pick stocks on future dates, the picks are written down with a timestamp before
their returns exist, and they are scored later with the same method as the backtest.

## Frozen code

| File | Role | SHA-256 (CRLF normalised to LF) |
|---|---|---|
| `tools/score_sector_leaders.py` | scorer, frozen v2 | `ece6ac96dbd20c631c8c836920b6c15f46936b3548e3276cffd9bac9c1f47c58` |
| `quarterly_db.py` | sector naming | `14c723ec2de32ba6a2415ef44e8285ac7cbf5c8b7a3cce7c751dbfb88cf338a2` |

These are the values in `FROZEN` in `tools/backtest_sector_leaders.py`. The recording tool calls
`check_frozen()` and refuses to run if either file differs. Any change to either file, or to
`FROZEN`, is a deviation and goes in the log below.

The point-in-time record builder and the evaluation code live in
`tools/backtest_sector_leaders.py` (`build_record`, `score_at`, `evaluate_period`, `summarize`)
and are shared with the backtest, so both use exactly one implementation. On 2026-11-08 the
backtest loop was split into these helpers; the regenerated Phase 2 output at lags 45, 60 and 90
was byte-identical to the output before the split. Each forward record stores the SHA-256 of
`tools/backtest_sector_leaders.py` and `tools/forward_test_sector_leaders.py` as they were when
the record was made. A later change to how records are built or evaluated is a deviation.

## Rules (identical to Phase 2 at the primary lag)

- **Report availability:** a quarterly report is used only if `quarter_end + 60 days <= signal date`.
- **Signal:** the close of the last trading session on or before the rebalance date.
- **Entry:** the close of the next session after the signal session (no same-day look-ahead).
- **Exit:** the entry session of the next rebalance date.
- **Point-in-time inputs:** as in the Phase 2 table: the 8 most recent known quarters for the EPS
  trend, P/E, P/B and Graham discount from the signal-day close, median turnover over the last
  20 sessions, the 7-day stale-price gate, and only dividends announced on or before the signal date.
- **Portfolio:** top 3 per sector by the frozen score (frozen tie-break), equal weight.
- **Returns:** adjusted closes. A stock that stops trading inside a period is valued at its last
  close and then held as cash.
- **Costs:** 0.5% per side on traded weight. The first forward period starts from cash (a full
  buy); later periods trade from the drifted weights of the previous period. Results are reported
  gross and net.
- **Benchmarks:** (a) sector-matched equal weight of eligible stocks (primary), (b) equal weight
  of all eligible stocks, (c) equal weight of every stock with a non-stale price.
- **Selection measure:** sector-neutral rank IC (Spearman between score and next-period return
  minus the sector's mean return), using every eligible company's score.

## Rebalance calendar

The rebalance date of a Nepali fiscal quarter is its 60-day availability date,
`quarter_end(fy, q) + 60 days`, with `quarter_end` from `tools/report_availability.py`
(exact conversion with `nepali_datetime`). The first forward rebalance is FY 2083-84 Q1.

| # | Fiscal quarter | Quarter end | Rebalance date | Weekday |
|---|---|---|---|---|
| 1 | 2083-84 Q1 | 2026-10-17 | **2026-12-16** | Wed |
| 2 | 2083-84 Q2 | 2027-01-14 | **2027-03-15** | Mon |
| 3 | 2083-84 Q3 | 2027-04-13 | **2027-06-12** | Sat |
| 4 | 2083-84 Q4 | 2027-07-16 | **2027-09-14** | Tue |
| 5 | 2084-85 Q1 | 2027-10-16 | **2027-12-15** | Wed |

`python tools/forward_test_sector_leaders.py calendar` prints these and later dates. When a
rebalance date is not a trading day (for example 2027-06-12, a Saturday), the signal session is
the last session before it, as in the backtest.

## Recording

1. Refresh the inputs first: prices (`tools/fetch_price_history.py`) and quarterly reports.
2. Run `python tools/forward_test_sector_leaders.py record --date <rebalance date>` once the
   price data contains the entry session (the session after the signal session). The tool
   refuses to record when it does not, because until a later session exists the tool cannot
   tell whether the last stored day is really the signal session. It also refuses when fewer
   than 80% of the usual number of symbols have a close on the signal session (a partial
   price refresh). Over the 500 sessions before 2026-11-08 the lowest ratio was 90%.
3. The record is written to `db/research/forward_test/<rebalance date>.json`. It holds: the
   fiscal quarter, signal and entry sessions, the next rebalance date, every holding with its
   score and sector rank, every eligible company's score and pillars (needed for the IC), every
   excluded company with its gate reasons, the universe with each company's stale-price flag,
   the frozen hashes, the code hashes, a SHA-256 fingerprint of the `db/quarterly`, `db/prices`
   and `db/dividend_data.json` contents used, the git commit, and the UTC creation time.
4. Records are append-only. The tool refuses to overwrite an existing file. A mistaken record
   is not edited or deleted; a correction is a new deviation-log entry.
5. Commit the record and push it to the remote repository on the day it is made. The push time
   on the remote host is a timestamp that does not depend on this machine's clock.
6. **Deadline.** A record should be made within 7 days of the rebalance date. One made more than
   14 days after is flagged `late` in the file and listed in the deviation log. The tool refuses
   to make a live record on or after the next rebalance date, because by then a large part of
   the period's return is known.

The tool refuses to write a rebalance date before 2026-12-16 into the live folder. Past dates
can be recorded only into another folder (`--out-dir`), for validation.

### What differs from the backtest, by design

The backtest scored past dates with today's data. A forward record uses the data that exists on
the day it is made. A company that has not published its report by then is scored on its
previous report, which is what an investor would have seen. A company listed after Phase 2 joins
the universe once it has a report in `db/quarterly` and prices in `db/prices`. These differences
make the forward test more realistic, not less; they are not deviations.

## Evaluation

`python tools/forward_test_sector_leaders.py evaluate` reads every record, and for each one
whose exit session is now in `db/prices` computes the period's portfolio and benchmark returns,
cost and IC with `evaluate_period` (the backtest's code), using the holdings, eligible scores and
universe stored in the record. Holdings are never re-scored. Periods are chained in date order
for the cost calculation. If a rebalance date has no record, the next period starts from cash
again, and the gap is a deviation. Output: `.tmp/forward_test_summary.json` and a printed table.

## Analysis plan

- **Primary measures:** mean sector-neutral IC, and mean excess return of the gross portfolio
  over the sector-matched benchmark, per period.
- **First report:** after 4 complete periods (records 1 to 4 above; the fourth period ends at the
  entry session after 2027-12-15). With 4 periods no significance test has useful power, so the
  first report is descriptive: each period's numbers, the means, and how they compare with the
  backtest (mean IC 0.076 over 15 periods; 0.012 over the first 8 and 0.148 over the last 7).
- **Continuation:** the test keeps running after the first report. Every completed period is
  reported; the test is not stopped or restarted because of its results.
- **Reading:** a positive forward IC near the recent backtest level would support the signal
  being real rather than design knowledge; an IC near zero would support the opposite. Either
  way the result is stated with its sample size.

## Known limitations

- **Short horizon:** about 4 periods per year.
- **Data revisions:** if a provider later revises a past price, the evaluation uses the revised
  adjusted series, as the backtest does. The fingerprint and git commit in each record show
  which data the picks were based on.
- **Restatements:** a report published late or restated after the record is not used for that
  record; this is intended (see "What differs from the backtest").

## Deviation log

No deviations yet.
