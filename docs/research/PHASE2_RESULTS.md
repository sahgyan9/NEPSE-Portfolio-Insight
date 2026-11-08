# Phase 2 results: Sector Leaders backtest (first run, 2026-11-07)

Rules: [PHASE2_PREREGISTRATION.md](PHASE2_PREREGISTRATION.md). No rule was changed after
seeing these numbers. Produced with frozen scorer v1; re-run under v2 (checklist fix, see the
deviation log) on 2026-11-08 gave identical results at all three lags. Reproduce with `python tools/backtest_sector_leaders.py`
(output in `.tmp/backtest/`).

Sample: 15 quarterly periods, entry 2022-12-18 to exit 2026-09-15 (3.74 years),
about 160 eligible companies per rebalance, about 32 held (top 3 in each sector).

## Headline numbers

| Lag | Portfolio (gross) | Portfolio (net of 0.5%/side) | Sector-matched benchmark | All eligible | All stocks | Mean excess vs matched / period (t) | Mean IC (t) |
|---|---|---|---|---|---|---|---|
| 45 | 16.0%/yr | 14.5%/yr | 14.7%/yr | 14.5%/yr | 17.0%/yr | +0.26% (0.40) | 0.091 (2.16) |
| **60** | **13.1%/yr** | **11.8%/yr** | **13.8%/yr** | **13.1%/yr** | **16.6%/yr** | **-0.21% (-0.30)** | **0.076 (1.73)** |
| 90 | 12.2%/yr | 10.7%/yr | 11.7%/yr | 11.3%/yr | 16.1%/yr | +0.08% (0.13) | 0.075 (1.73) |

## Reading

1. **Portfolio question: inconclusive, no evidence of outperformance.** The top-3-per-sector
   portfolio earned about the same as simply holding every eligible stock in the same sectors.
   After costs it trails. Hit rate is about 50%.
2. **Selection question: weak positive signal.** Higher-scored companies did somewhat better
   than lower-scored ones in the same sector (IC 0.075 to 0.09, t 1.7 to 2.2). This is
   borderline statistically, with only 15 periods. It holds at all three lags, so it does not
   come from look-ahead on report dates.
3. **The signal is concentrated in recent periods.** Mean IC is 0.012 over the first 8 periods
   (2022-12 to 2024-12) and 0.148 over the last 7 (2025-03 to 2026-06). The weights were
   calibrated in September 2026 using the recent cross-section, so the recent strength may
   partly reflect design knowledge rather than a durable effect. Only forward testing can
   separate the two.
4. **The eligibility gates cost return in this period.** All stocks (16.6%/yr) beat all
   eligible stocks (13.1%/yr): the excluded loss-makers and illiquid names rallied more.
   This is a period effect worth reporting, not a reason to drop the gates after the fact.

## Notes for the paper

- On rebalance dates that fall on a non-trading day, the signal session is the day before,
  so that quarter's newest report is not yet public under the rule. This is conservative.
- Found during this phase, not fixed (the algorithm is frozen): the production checklist
  compares against the **oldest** same-numbered quarter in the file, not the prior year. With
  8-quarter files that is the prior year; the files now hold up to 28 quarters, so production
  compares against years-old data. It affects the checklist and the tie-break only.
  The backtest uses an 8-quarter window, so it behaves as originally intended.
