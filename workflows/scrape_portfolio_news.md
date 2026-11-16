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

## News event extraction (added 2026-11-15)

### What it does
`tools/extract_news_events.py` reads `db/news.json` and works out what each headline is about (dividend proposed, book closure, right share, quarterly result, and so on). It pulls out the numbers and dates and writes `db/news_events.json`. The app's `NewsEventsCard` and the news feed labels read it through `GET /api/news/events`.

It is fully rule-based: keyword and regex patterns only. No LLM, no paid API, no new dependency (httpx, beautifulsoup4, lxml, nepali-datetime). If a number or date is not in the text, the field is null. Nothing is guessed.

### How to run
```
.venv/Scripts/python.exe tools/extract_news_events.py                # normal run, fetches up to 25 article bodies
.venv/Scripts/python.exe tools/extract_news_events.py --no-fetch     # headlines + cached bodies only
.venv/Scripts/python.exe tools/extract_news_events.py --max-fetch 5
.venv/Scripts/python.exe -m pytest tools/test_extract_news_events.py -q
```
`nepse_server.py` runs it automatically at the end of the daily refresh, and in a background thread after every successful `POST /api/news/fetch/<symbol>` (several fetches in a row collapse into one or two runs). A failure is logged and never breaks the news endpoints.

### Output schema (`db/news_events.json`)
`{ generated_at, stats: {total, by_type, non_roundup, other, other_share, high_confidence, bodies_fetched, body_fetch_failures}, events: [...] }`. Each event:

| key | meaning |
|---|---|
| `id` | first 16 hex chars of sha1(link). One article attached to two symbols gives two records with the same id; `(id, symbol)` is unique. |
| `symbol`, `headline`, `link` | as in news.json |
| `date` | ISO `YYYY-MM-DD` (both stored formats accepted; falls back to the date in the URL slug) |
| `event_type` | see the list below |
| `fields` | numbers and dates for that type (null when not stated). BS dates are converted to ISO and the original string is kept in `<name>_date_bs`. |
| `action_date`, `action_kind` | date the investor must act by or be aware of (`last_buy_day`, `book_closure`, `agm`, `issue_open`, `issue_close`, `lock_in_end`, `auction_open`), or null |
| `is_roundup` | multi-company list or sector/index move (noise for one holding). `fields.popularity_list` marks "most bought", "top gainers", "highest volume" lists. |
| `subject_match` | does the text name this symbol's company? false for subsidiaries and wrongly tagged items (e.g. "NIC Asia Capital" under NICA, "Nabil Investment Banking" under NABIL). Uses `db/company_symbol_map.json` names. |
| `confidence` | `high` when a specific pattern matched with its key fields and `subject_match` is not false; otherwise `low`. Low items get no `action_date` and the UI shows only the original headline. |

Event types: `dividend_proposed`, `dividend_approved`, `book_closure`, `bonus_listed`, `price_adjustment`, `right_share`, `agm`, `quarterly_result`, `rating_change`, `ipo_fpo`, `debenture`, `auction`, `promoter_sale`, `merger_acquisition`, `lock_in_expiry`, `incident`, `csr`, `management_change`, `investment_or_expansion`, `business_update`, `market_roundup`, `other`.

### Article bodies (fetch limits)
Headlines often leave out the book closure date. For `dividend_proposed`, `book_closure`, `right_share` and `agm` items whose headline lacks the date, the tool fetches the article page with the scraper's headers and reads `#newsdetail-content`:
- only items newer than 60 days;
- at most 1 request per second;
- body text cached in `.tmp/news_bodies/<id>.txt`, never fetched twice (delete a file to force a refetch);
- `--max-fetch` caps requests per run (default 25); `--no-fetch` turns fetching off.

Multi-company articles ("Last trading day to secure dividend of five companies") describe each company after its `(TICKER)`. The tool reads only the part for the item's symbol; if the symbol is not in the article at all, the record becomes low confidence. ShareSansar sometimes tags such articles to a related symbol (NABIL for NABILINV), so this check matters.

### Bikram Sambat dates
Text dates like "Ashoj 14", "22nd Ashoj, 2083" or "2082-07-25" are converted with `nepali-datetime`. When the year is missing, the BS year that puts the date nearest the article date is used. Month spellings (Ashwin/Ashoj/Asoj, Poush/Paush, ...) live in `_BS_MONTH_ALIASES`.

### How to add a pattern
1. Dump the headlines that end up as `other` (or misclassified): `stats.by_type` and the `events` list show them.
2. Add or extend a regex in `_RULES` (order matters: first match wins; specific corporate actions come before generic buckets like `csr` or `business_update`). Roundup phrases go in `_ROUNDUP_RE`.
3. If the type carries numbers, add a branch in `extract_fields` and list its key fields in `_KEY_FIELDS` (these decide `confidence`). Add an `action_for` rule if it has a date to remember.
4. Add the real headline with its expected type and fields to `tools/test_extract_news_events.py`, run pytest, then re-run the tool and check `other_share`.
5. For a new type, add `type_<name>` and `m_<name>` strings to both `src/i18n/locales/en/news.ts` and `ne/news.ts`, the type to `NewsEventType` in `src/services/newsEventsApi.ts`, and an icon in `src/components/news/eventText.ts`.

### Learned while building (2026-11-15)
- Of 138 stored items (100 unique articles), 53 were roundups; after the rules, `other` was 0 of 85 non-roundup items. Expect `other` to rise on new kinds of news: add patterns rather than widening generic ones.
- ShareSansar's company filter attaches related-company news to a symbol (SHL received Mid Solu Hydropower and Shiva Shree items; HBL received Himalayan 80-20 and Himalayan Capital). The `subject_match` check keeps those from being explained as the holder's own company.
- The scraper now stores every date as ISO (`normalize_date`), including old long-format items on the next scrape of that symbol. Old items that were only kept because their date could not be parsed will now fall outside the 90-day window and drop out.
