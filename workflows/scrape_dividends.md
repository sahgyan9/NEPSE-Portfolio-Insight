# Workflow: Fetch Dividend Announcements

## Objective
Keep `db/dividend_data.json` current with dividend/bonus announcements for all portfolio holdings and watchlist stocks, so the Dividends page can compute what the user actually received (bonus shares + cash) without manual entry.

## Data Sources
1. **Primary (Bulk): HamroShare** — `https://hamroshare.com.np/investment/proposed-dividend`
   - Next.js App Router RSC stream (`RSC: 1` header).
   - Returns 830+ announcements across 6 fiscal years covering 320+ NEPSE companies in **one single HTTP request** (~1 second).
   - Enriches data with `announcementDateAD` (board announcement date), `bonusListingDateAD` (NEPSE listing date), and `closePrice`.
2. **Fallback / Detail: NepaliPaisa public JSON API** — `https://nepalipaisa.com/api/GetDividends?stockSymbol=<SYM>&pageNo=1&itemsPerPage=20&pagePerDisplay=5`
   - Per-symbol structured JSON API.
   - Automatically queried as fallback for any requested symbol not present in HamroShare bulk data.
   - Provides `bookClosureDateBS` (Bikram Sambat).

## Tool
`tools/scrape_dividends.py`
- No arguments → fetches all symbols in `db/portfolio.json` using `--source auto`.
- `python tools/scrape_dividends.py NTC SAHAS` → specific symbols only.
- `python tools/scrape_dividends.py --all` → every company in `db/fundamentals_archive` (syncs entire market in ~1s).
- `python tools/scrape_dividends.py --all --missing-only` → skips symbols that already have dividend data.
- `--source {auto,hamroshare,nepalipaisa}` → controls data provider selection.
- `--fy 081-082` → prints a summary for that fiscal year after fetching.
- Merges into `db/dividend_data.json`: dedupes per symbol by fiscal year, updates in place, preserves any `notes` field, retains existing BS closure dates if missing from HamroShare, sorts newest first. Safe to re-run (idempotent).

## Server Integration
- `POST /api/dividends/refresh` (nepse_server.py) runs this tool via subprocess.
- `GET /api/dividends/portfolio?fy=081-082` returns merged per-holding view with computed bonus shares, cash income (gross/net of 5% tax), and share-count timeline.
- The Dividends page "Refresh Announcements" button calls these.

## Conventions & Edge Cases
- Fiscal year normalized to `NNN-NNN` (e.g. `2082/2083` or `FY 2082/83` → `082-083`) to match `manual_dividends.json`.
- Dual-source resilience: in `auto` mode, HamroShare runs first; symbols missing from HamroShare are queried via NepaliPaisa with 0.6s polite delay.
- Non-destructive merging: existing user `notes` and previously fetched `bookClosureDateBS` dates are never overwritten.
- Mutual funds (paid-up Rs 10) often have no corporate dividend entries — logged and gracefully skipped.
- Manual entries in `manual_dividends.json` override auto data for the same symbol + fiscal year (user corrections always win).
