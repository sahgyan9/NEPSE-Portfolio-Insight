# Workflow: Fetch Dividend Announcements

## Objective
Keep `db/dividend_data.json` current with dividend/bonus announcements for all portfolio holdings, so the Dividends page can compute what the user actually received (bonus shares + cash) without manual entry.

## Data Source
**NepaliPaisa public JSON API** — `https://nepalipaisa.com/api/GetDividends?stockSymbol=<SYM>&pageNo=1&itemsPerPage=20&pagePerDisplay=5`

Chosen after testing (2026-07):
- ShareSansar `proposed-dividend` table is AJAX/JS-rendered — raw fetch returns no rows.
- Merolagani company pages are ASP.NET postback-heavy — parseable but brittle.
- NepaliPaisa returns clean JSON: bonus %, cash %, total %, book closure dates (AD + BS), fiscal year (BS), status. No firecrawl credits or LLM parsing needed.

## Tool
`tools/scrape_dividends.py`
- No arguments → fetches every symbol in `db/portfolio.json`.
- `python tools/scrape_dividends.py NTC SAHAS` → specific symbols only.
- `--fy 081-082` → prints a summary for that fiscal year after fetching.
- Merges into `db/dividend_data.json`: dedupes per symbol by fiscal year, updates in place, preserves any `notes` field, sorts newest first. Safe to re-run (idempotent).

## Server Integration
- `POST /api/dividends/refresh` (nepse_server.py) runs this tool via subprocess.
- `GET /api/dividends/portfolio?fy=081-082` returns merged per-holding view with computed bonus shares, cash income (gross/net of 5% tax), and share-count timeline.
- The Dividends page "Refresh Announcements" button calls these.

## Conventions & Edge Cases
- Fiscal year normalized to `NNN-NNN` (e.g. `2081/2082` → `081-082`) to match `manual_dividends.json`.
- API does fuzzy symbol matching; the tool keeps exact-symbol rows only (HDL vs NHDL problem).
- Mutual funds (paid-up Rs 10) often have no entries in this API — failures/empties are logged, not fatal.
- Manual entries in `manual_dividends.json` override auto data for the same symbol + fiscal year (user corrections always win).
- Rate limiting: 0.6 s delay between requests; exit code 2 if any symbol failed.
