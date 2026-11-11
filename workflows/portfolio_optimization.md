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
