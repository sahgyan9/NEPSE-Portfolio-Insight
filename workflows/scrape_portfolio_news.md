# Workflow: Fetch Targeted Portfolio News

## Objective
Extract the latest news headlines and links from ShareSansar for specific symbols in the user's Portfolio or Watchlist.

## Required Inputs
- `symbol`: The stock ticker symbol (e.g., NICA, SAHAS)

## Tools
- `tools/scrape_sharesansar_news.py`: Fetches ShareSansar's server-rendered, company-filtered listing (`/category/latest?company=<SYMBOL>`) with plain HTTP (httpx) and parses it with BeautifulSoup. **No Firecrawl, no LLM extraction, no API credits** (migrated 2026-07; the old version burned Firecrawl credits per symbol).

## How Parsing Works (for future maintenance)
- Relevance filtering happens **server-side** via ShareSansar's own `?company=` tag — the old HDL-vs-NHDL substring problem no longer exists.
- Articles are identified as `/newsdetail/` links whose URL slug ends in a date (`...-2026-06-23`). Static menu links to newsdetail pages have no date suffix and drop out automatically. Dates come from the slug, so parsing is layout-independent.
- `--pages N` follows the cursor pagination for older articles (default 1 page ≈ 10 articles).

## Expected Output
The script appends or updates the news array for the given symbol in `db/news.json` (format unchanged):
```json
{
  "NICA": [
    {
      "headline": "NICA reports 20% profit growth...",
      "date": "2024-05-10",
      "link": "https://www.sharesansar.com/newsdetail/..."
    }
  ]
}
```

## Process
1. Read `db/portfolio.json` and `db/watchlist.json` to identify active symbols.
2. Run `python tools/scrape_sharesansar_news.py <SYMBOL>` for any symbol the user requests or on a scheduled cadence. The server endpoint `POST /api/news/fetch/<symbol>` calls the same script.

## Edge Cases
- **Rate limiting**: No API credits involved, but stay polite — this is page scraping. Fetching all ~26 portfolio symbols sequentially is fine; don't hammer in tight loops.
- **Dedupe/retention**: Items are deduped by link and only the last 90 days are kept, sorted newest first (same as before).
- **Symbol not found / no news**: The listing simply returns no dated newsdetail links; the script saves an empty (or unchanged) array gracefully.
- **Layout changes**: If ShareSansar ever changes URL structure (dates out of slugs), the parser's SLUG_DATE_RE anchor is the thing to update.
