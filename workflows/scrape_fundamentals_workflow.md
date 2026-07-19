# Scrape Fundamentals Workflow

**Objective**: Fetch the latest fundamental + market data (EPS, P/E, Book Value, P/B, shares outstanding, promoter/public holding, 52-week high/low) for stocks and update the local database — **directly over plain HTTP, no Firecrawl API key or LLM extraction**.

**When to use this**:
- When the user asks to update or scrape fundamentals.
- When new stocks are added to the portfolio or watchlist and their fundamentals show up as N/A.
- During quarterly updates (when new financial reports are published).

> [!TIP]
> **Token Efficiency**: Before running this scraper, check if the user has already fetched the "Quarterly" report for the stock (via `nepse_server.py`). The backend's `/api/fundamentals` endpoint automatically intercepts and reads `db/quarterly/<symbol>.json`. If it finds the quarterly data, it derives EPS, Book Value, P/E, and P/B instantly for FREE! You only need to run this scraper if the user *specifically* wants to skip downloading the full quarterly history — or wants the market-data fields (holdings, 52-week range, shares outstanding) that only this scraper provides.

**How it works**:
- `tools/scrape_fundamentals_direct.py` makes one plain `httpx` GET per symbol to NepseAlpha's server-rendered stock page (the same request `scrape_nepsealpha_direct.py` makes) and reads the JSON embedded in the page source: `masterData` (eps, book value, shares outstanding, 52-week hi/lo), `funda_table` (live P/E, P/B), `stocksGenralInfo` (promoter/public holding, stored as fractions and converted to 0–100 percent).
- Results are merged into `db/fundamentals.json` — existing keys not in the payload (e.g. `avgVolume120d`) are left untouched.
- This replaces BOTH legacy Firecrawl scripts: `tools/scrape_fundamentals.py` and `tools/scrape_market_data.py` (kept as emergency fallbacks only).

**Required Tool**:
`run_command` -> `python tools/scrape_fundamentals_direct.py [SYMBOL ...]`

**Steps**:
1. Check if the user specified symbols (e.g., `SHIVM NTC`) or wants to update all (no args or `all` = every portfolio holding, mutual funds auto-excluded).
2. Run `python tools/scrape_fundamentals_direct.py <SYMBOL>`.
3. It takes ~1-2 seconds per symbol (plain HTTP, 1s polite delay between symbols).
4. Verify the per-symbol output lines and the final `Saved db/fundamentals.json` summary.
5. Inform the user that the backend now has the fresh data and the frontend Watchlist/Portfolio will update automatically on refresh.

**Edge Cases & Errors**:
- Values are exact (from NepseAlpha's own data payload), unlike the old LLM extraction which occasionally misread numbers (e.g. NTC's sharesOutstanding was stored as paid-up capital in rupees).
- `peRatio` here is the LIVE ratio based on today's price (LTP), which may differ slightly from the quarterly table's period-end P/E.
- Mutual funds / instruments without a company page are skipped automatically (`fund` sector or the hardcoded exclusion list).
- If NepseAlpha redesigns the page and the embedded JSON disappears, fall back to the legacy Firecrawl scripts and update the direct scraper.
- The database is `db/fundamentals.json`. If it's corrupted, check the file manually.
