# Phase 2 results: Sector Leaders backtest (re-run on corrected data, 2026-11-15)

Rules: [PHASE2_PREREGISTRATION.md](PHASE2_PREREGISTRATION.md). No rule of the pre-registered
scorer (v2) was changed after seeing these numbers. The figures below are from a re-run on
2026-11-15 after three data corrections, each recorded in the deviation log: dividend history for
all companies instead of 28 (2026-11-14), operating and expense lines stored in thousands
(2026-11-15), and bank ratios stored without the decimal point (2026-11-15).

Two scorer versions are reported:

- **v2, the pre-registered scorer, is the Phase 2 result.**
- **v3** (profit growth in the Growth pillar; cash and bonus dividends ranked separately) was
  adopted on 2026-11-15 as the rule set for the forward test. It was proposed after an
  exploratory look at returns over this same sample, so its backtest is in-sample and is shown
  only so that the forward-test rules have a backtest beside them. See the deviation log.

Earlier runs are kept at the end of this file. Reproduce with `python tools/backtest_sector_leaders.py`
(output in `.tmp/backtest/`). The code in the repository is v3. v3 also changed `build_record()`
in the backtest, so v2 is reproduced from the commit before v3 was adopted (see the v3 entry in
the deviation log), run on the current data files.

Sample: 15 quarterly periods, entry 2022-12-18 to exit 2026-09-15 (3.74 years),
about 163 eligible companies per rebalance, about 32 held (top 3 in each sector).

## Headline numbers: v2 (pre-registered)

| Lag | Portfolio (gross) | Portfolio (net of 0.5%/side) | Sector-matched benchmark | All eligible | All stocks | Mean excess vs matched / period (t) | Mean IC (t) |
|---|---|---|---|---|---|---|---|
| 45 | 17.2%/yr | 15.7%/yr | 14.7%/yr | 14.6%/yr | 17.0%/yr | +0.50% (0.70) | 0.088 (1.95) |
| **60** | **13.4%/yr** | **12.1%/yr** | **13.8%/yr** | **13.1%/yr** | **16.6%/yr** | **-0.15% (-0.21)** | **0.074 (1.56)** |
| 90 | 11.8%/yr | 10.4%/yr | 11.7%/yr | 11.4%/yr | 16.1%/yr | -0.01% (-0.02) | 0.078 (1.64) |

## v3 (forward-test rules, in-sample)

| Lag | Portfolio (gross) | Portfolio (net of 0.5%/side) | Sector-matched benchmark | All eligible | All stocks | Mean excess vs matched / period (t) | Mean IC (t) |
|---|---|---|---|---|---|---|---|
| 45 | 17.2%/yr | 15.7%/yr | 14.7%/yr | 14.6%/yr | 17.0%/yr | +0.50% (0.72) | 0.088 (1.95) |
| **60** | **14.0%/yr** | **12.7%/yr** | **13.8%/yr** | **13.1%/yr** | **16.6%/yr** | **+0.00% (0.00)** | **0.077 (1.62)** |
| 90 | 12.3%/yr | 10.9%/yr | 11.7%/yr | 11.4%/yr | 16.1%/yr | +0.11% (0.18) | 0.080 (1.67) |

v3 changes 13 leader slots out of about 490 at each lag. The differences from v2 are far inside
the noise of 15 periods and do not change any reading below.

## Reading

Figures are for v2; v3 reads the same.

1. **Portfolio question: inconclusive, no evidence of outperformance.** The top-3-per-sector
   portfolio earned about the same as simply holding every eligible stock in the same sectors.
   Net of costs it beats the sector-matched benchmark at lag 45 (by 1.0 point a year) and trails
   it at lags 60 and 90. Hit rate is 53% to 67%, with no consistent sign.
2. **Selection question: weak positive signal.** Higher-scored companies did somewhat better
   than lower-scored ones in the same sector (IC 0.074 to 0.088, t 1.6 to 2.0). This is
   borderline statistically, with only 15 periods. It holds at all three lags, so it does not
   come from look-ahead on report dates.
3. **The signal is concentrated in recent periods.** Mean IC is between -0.02 and 0.03 over the
   first 8 periods (2022-12 to 2024-09) and between 0.16 and 0.19 over the last 7 (2024-12 to
   2026-06). The weights were calibrated in September 2026 using the recent cross-section, so the
   recent strength may partly reflect design knowledge rather than a durable effect. Only forward
   testing can separate the two.
4. **The eligibility gates cost return in this period.** All stocks (16.6%/yr) beat all
   eligible stocks (13.1%/yr): the excluded loss-makers and illiquid names rallied more.
   This is a period effect worth reporting, not a reason to drop the gates after the fact.

## Notes for the paper

- On rebalance dates that fall on a non-trading day, the signal session is the day before,
  so that quarter's newest report is not yet public under the rule. This is conservative.
- The production checklist used to compare against the oldest same-numbered quarter in a file
  instead of the prior year. It was fixed in v2 (2026-11-08) and never affected the backtest,
  which builds its records from an 8-quarter window.
- Data faults found and corrected during Phase 2 are listed in the deviation log with their
  effect on these figures. None changed a reading. Faults still open are listed there too
  (records in doubt, payout and yield computed from cash only in `build_record()`).
- Earlier versions of this file said the first 8 periods ran "2022-12 to 2024-12"; the split
  has always been at the 2024-12 rebalance, so the first 8 end at 2024-09.

## Superseded runs

Kept for the record. Same rules.

**Run 2 (2026-11-15, v2), full dividend data, before the unit and percent corrections.**

| Lag | Portfolio (gross) | Portfolio (net) | Sector-matched | All eligible | All stocks | Mean excess / period (t) | Mean IC (t) |
|---|---|---|---|---|---|---|---|
| 45 | 17.0%/yr | 15.5%/yr | 14.7%/yr | 14.5%/yr | 17.0%/yr | +0.47% (0.65) | 0.089 (1.96) |
| 60 | 13.2%/yr | 12.0%/yr | 13.8%/yr | 13.1%/yr | 16.6%/yr | -0.19% (-0.27) | 0.076 (1.59) |
| 90 | 11.8%/yr | 10.4%/yr | 11.7%/yr | 11.3%/yr | 16.1%/yr | -0.01% (-0.02) | 0.078 (1.64) |

**Run 1 (v1, identical under v2), dividend history for 28 companies only.**

| Lag | Portfolio (gross) | Portfolio (net) | Sector-matched | All eligible | All stocks | Mean excess / period (t) | Mean IC (t) |
|---|---|---|---|---|---|---|---|
| 45 | 16.0%/yr | 14.5%/yr | 14.7%/yr | 14.5%/yr | 17.0%/yr | +0.26% (0.40) | 0.091 (2.16) |
| 60 | 13.1%/yr | 11.8%/yr | 13.8%/yr | 13.1%/yr | 16.6%/yr | -0.21% (-0.30) | 0.076 (1.73) |
| 90 | 12.2%/yr | 10.7%/yr | 11.7%/yr | 11.3%/yr | 16.1%/yr | +0.08% (0.13) | 0.075 (1.73) |

The qualitative reading is the same in all runs: no portfolio-level outperformance and a weak,
borderline selection signal that sits in the last 7 periods.
