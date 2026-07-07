# Workflow: Portfolio Optimization (MPT)

**Goal**: Analyze the user's WACC portfolio and mathematically suggest rebalancing actions to optimize the risk/reward ratio based on frontier market volatility heuristics.

**When to use this**:
- When the user asks "is my portfolio safe?" or "how should I rebalance?" or "run the optimizer".
- After a major market run-up where sector weights might have drifted significantly.

**How it works**:
1. Run `python tools/optimize_portfolio.py`
2. The script reads the user's `db/portfolio.json` and maps each stock to a sector volatility baseline (derived from arXiv quantitative finance literature on frontier markets).
3. It computes the total portfolio variance drag.
4. It checks the valuation (P/E) of individual holdings to warn about overpriced assets.
5. The agent should read the script's stdout and present the specific rebalancing suggestions directly to the user in a clean, bulleted format.

**Important Notes**:
- This uses a heuristic approach for volatility since we do not store 5-year daily historical prices locally. It assumes sector-level betas relative to the NEPSE index.
