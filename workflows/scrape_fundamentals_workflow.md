# Scrape Fundamentals Workflow

**Objective**: Scrape the latest fundamental data (EPS, P/E, Book Value, P/B) for stocks using Firecrawl and update the local database.

**When to use this**:
- When the user asks to update or scrape fundamentals.
- When new stocks are added to the portfolio or watchlist and their fundamentals show up as N/A.
- During quarterly updates (when new financial reports are published).

> [!TIP]
> **Token Efficiency**: Before running this scraper, check if the user has already fetched the "Quarterly" report for the stock (via `nepse_server.py`). The backend's `/api/fundamentals` endpoint automatically intercepts and reads `db/quarterly/<symbol>.json`. If it finds the quarterly data, it derives EPS, Book Value, P/E, and P/B instantly for FREE! You only need to run this scraper if the user *specifically* wants to skip downloading the full quarterly history.

**How it works**:
- The script `tools/scrape_fundamentals.py` calls NepseAlpha via Firecrawl.
- Firecrawl uses LLM extraction to get structured JSON data.
- The results are saved directly into `db/fundamentals.json`.

**Required Tool**:
`run_command` -> `python tools/scrape_fundamentals.py [SYMBOL]`

**Steps**:
1. Check if the user specified a symbol (e.g., `SHIVM`) or wants to update all (`all`).
2. Run `python tools/scrape_fundamentals.py <SYMBOL>`.
3. Wait for the command to finish. It takes roughly 10-15 seconds per symbol because of the LLM extraction step.
4. Verify the output says `Successfully saved fundamentals`.
5. Inform the user that the backend now has the fresh data and the frontend Watchlist/Portfolio will update automatically on refresh.

**Edge Cases & Errors**:
- If Firecrawl fails to extract valid JSON, the script will warn you. You may need to retry once.
- The database is `db/fundamentals.json`. If it's corrupted, check the file manually.
