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

The backtest imports `gate`, `score_universe` and `eps_trend` from that file unchanged. Weights,
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
