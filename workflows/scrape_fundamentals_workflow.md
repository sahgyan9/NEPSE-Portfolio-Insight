# Scrape Fundamentals Workflow

**Objective**: Fetch the latest fundamental + market data (EPS, P/E, Book Value, P/B, shares outstanding, promoter/public holding, 52-week high/low) for stocks and update the local database — **directly over plain HTTP, no Firecrawl API key or LLM extraction**.

**When to use this**:
- When the user asks to update or scrape fundamentals.
- When new stocks are added to the portfolio or watchlist and their fundamentals show up as N/A.
- During quarterly updates (when new financial reports are published).

> [!TIP]
> **Token Efficiency**: Before running this scraper, check if the user has already fetched the "Quarterly" report for the stock (via `nepse_server.py`). The backend's `/api/fundamentals` endpoint automatically intercepts and reads `db/quarterly/<symbol>.json`. If it finds the quarterly data, it derives EPS and Book Value instantly for free, and re-derives P/E and P/B from them at the `ratioPrice` stored in `db/fundamentals.json`. You only need to run this scraper if the user *specifically* wants to skip downloading the full quarterly history — or wants the market-data fields (holdings, 52-week range, shares outstanding) that only this scraper provides.

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
- `peRatio` / `pbRatio` are NOT taken from the source site. Learned 2026-11-14: NepseAlpha's `funda_table.pe_ratio` and HamroShare's `report.peRatio` rest on the site's own EPS, which lags the quarterly EPS we store, so P/E disagreed with EPS for 45 of 305 priced symbols (NIMB eps 0.53 with P/E 14.81; some with the wrong sign). Both writers (`scrape_fundamentals_direct.py`, `harvest_all_quarterly.py`) now call `portfolio_common.recompute_ratios`, which sets P/E = latest close in `db/prices` ÷ stored EPS (fallback: captured `ltp`) and records `ratioPrice` / `ratioPriceDate`. The frontend recomputes P/E from the live price the same way it does P/B.
- To repair the whole file after a price refresh or old data, run `python tools/recompute_valuation_ratios.py` (`--dry-run` lists changes first). It touches only `db/fundamentals.json`; `db/fundamentals_archive` keeps the source P/E because the frozen research scorer reads it.
- Mutual funds / instruments without a company page are skipped automatically (`fund` sector or the hardcoded exclusion list).
- If NepseAlpha redesigns the page and the embedded JSON disappears, fall back to the legacy Firecrawl scripts and update the direct scraper.
- The database is `db/fundamentals.json`. If it's corrupted, check the file manually.
