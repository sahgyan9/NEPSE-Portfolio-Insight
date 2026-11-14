# Workflow: Portfolio Risk and Optimization

**Goal**: Measure how risky the user's portfolio is, where that risk comes from, and how its return compares with the market, then explain it in plain language.

**When to use this**:
- When the user asks "is my portfolio safe?" or "how should I rebalance?" or "run the optimizer".
- After a major market run-up where sector weights might have drifted significantly.

**How it works**:
1. Run `python tools/optimize_portfolio.py` (use `.venv/Scripts/python.exe`).
2. It calls the risk engine `tools/portfolio_risk.py`, which reads `db/portfolio.json` and the price history in `db/prices/` and computes, from two years of weekly returns: volatility per holding and for the portfolio, correlations, each holding's and sector's share of total risk, beta against an equal-weight index of all stocks on file, drawdown, a bad-week loss estimate, and the money-weighted return (XIRR) against the same deposits put into the index.
3. It compares each holding's P/E with the median of its own sector and flags loss-making companies.
4. Output: `db/portfolio_risk.json` (full report) and `db/portfolio_optimization.json` (same report under `risk`, plus the older top-level keys the Intelligence page reads). `tools/portfolio_health.py` uses the same engine for its "Market Risk" pillar.
5. Present the `findings` list to the user, most severe first. Describe risk; do not tell the user to buy or sell a specific stock.

**Important Notes**:
- Volatility is measured, not assumed. Earlier versions used a fixed guess per sector and weighted holdings at cost; both are gone.
- Price data must be current: run `python tools/fetch_price_history.py` first if `asOf` in the report is old.
- Holdings without their own price history (mutual funds, new listings) are estimated from the sector average or the market index and listed under `coverage.proxied`. If `coverage.measuredWeight` is low, say the numbers are approximate.
- The index excludes delisted and merged companies, so it is slightly flattering (survivorship bias).
- XIRR excludes cash dividends and fees. Purchases without a broker bill are assumed made at average cost on the holding's `dateAdded`.
- Known data fault (2026-11-11): some quarterly files store percentage ratios without the decimal point (CAR 11.12 as 1112; seen in NICA, NABIL, SFCL). `portfolio_health.py` rescales these defensively. The source data in `db/quarterly/` was left untouched because it is the research dataset.
- First run after price files change takes about 10 seconds (it parses every price file); later runs use a cache in `.tmp/` and take under a second.

## EPS insights (earnings per share against your cost)

**Tool**: `tools/eps_insights.py` (run with `.venv/Scripts/python.exe`). Tests: `tools/test_eps_insights.py`.
**Output**: `db/eps_insights.json` (gitignored, holds personal holdings). Endpoint: `GET /api/eps-insights` on `portfolio_db.py` (port 5001; restart the server after pulling this change). The Quarterly page shows a "Your position: earnings" card for held stocks and the Research page shows a "Your holdings: earnings check" table.

**What it does**: for each non-fund holding with a file in `db/quarterly/`, it builds true trailing-12-month (TTM) EPS from year-to-date net profit, then works out P/E at your average cost, earnings yield on cost, your share of yearly profit, profit versus the same period last year, the sector median TTM P/E, and plain-English flags (loss, falling or rising profit, seasonal distortion, expensive at cost, cheap versus sector). Thresholds are named constants at the top of the tool.

**The TTM vs annualized trap**: in the quarterly data `raw["Net Profit"]` is year-to-date (Q1 = 3 months, Q4 = full year), and `computed["eps_ttm"]` is NOT trailing 12 months. It is the NEPSE annualized figure (year-to-date scaled to a year). After Q1 it can mislead badly: NIMB Q1 83-84 shows 0.53 annualized but 8.05 TTM; hydropower SGHC shows 34.22 annualized but 13.58 TTM because the monsoon Q1 is its best quarter. TTM = previous Q4 year-to-date minus same quarter last year plus this year-to-date. If a previous-year quarter is missing, TTM is None and only the annualized figure is shown. Never rename the mislabeled fields; `db/quarterly/` is the frozen research dataset.

**Notes**:
- Share count: `Number of Shares`, else `Paid Up Capital / 100`, else `sharesOutstanding` in `db/fundamentals.json`.
- Price is the latest close in `db/prices`; the Quarterly card prefers the live LTP when the quote has loaded.
- Sector median needs at least 3 companies with 0 < P/E < 500. Mutual funds are skipped (no EPS).
- A company whose latest report repeats an earlier quarter's figures (NIMB Q1 83-84 profit equals Q1 82-83 exactly) will show a misleading year-on-year change; check the source report.
