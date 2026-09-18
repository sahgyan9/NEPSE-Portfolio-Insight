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

## Server & Frontend Unified Architecture
- `POST /api/dividends/refresh` (`nepse_server.py`) runs `tools/scrape_dividends.py` via subprocess.
- `GET /api/dividends/portfolio?fy=<FY>` (`nepse_server.py`) is the **Single Source of Truth** for all dividend computations across the entire application:
  - **Defaults to `082-083`** (current fiscal year distributions).
  - Explicit fiscal years (e.g. `082-083`, `081-082`, `080-081`, `079-080`) filter to announcements matching that profit year.
  - `fy=all` (or `cumulative`/`lifetime`) aggregates eligible cash dividends across every historical fiscal year in the database.
  - `fy=latest` dynamically identifies the newest declared dividend across all fiscal years per stock.
  - Automatically incorporates active manual overrides from `db/manual_dividends.json` while skipping parked entries (`disabled: true`).
  - Computes `calc_qty`, `shares_held_at` eligibility, `cashGross`, `cashNet` (5% tax), `bonusShares`, `bonusTaxDue`, and `dividendTrend`.
- **Frontend Service:** `src/services/receivedDividendsApi.ts` exports `fetchPortfolioDividends(fy = DEFAULT_DIVIDEND_FY)`.
- **Home Page Integration:**
  - `src/hooks/useLivePortfolio.ts` dispatches two parallel calls via `Promise.allSettled`:
    1. `fetchPortfolioDividends(dividendFiscalYear)` → populates per-company dividend values for the `HoldingsTable`.
    2. `fetchPortfolioDividends('all')` → retrieves all-time accumulated net cash to populate `summary.totalDividendIncome` and compute `netGrowth = totalGainLoss + allTimeDividendCashNet`.
  - `src/components/HoldingsTable.tsx` displays the active fiscal year in the column header (e.g., `Dividend (082-083)`), provides a segmented toggle group (`082-083 (Current)` | `081-082` | dropdown), and displays clean `-` for holdings with no announcements in the selected year.
  - `PortfolioSummaryCards` renders the **"Total Cash Dividends"** card with all-time accumulated cash received (after 5% tax) and Net Growth.
- **Dividends Page Integration:**
  - `src/pages/DividendsPage.tsx` uses the same `fetchPortfolioDividends(fiscalYear)` service to populate the detailed breakdown, status tags, and historical sparklines.

## Conventions & Edge Cases
- **Fiscal Year Scoping:** Never default portfolio overview displays to an unconstrained all-time `latest`. Older payouts (e.g., 3-4 years ago) will mislead users into thinking they represent current-year dividend income. Default to the current/recent active distribution year (`082-083`), label the column header explicitly (`Dividend (082-083)`), and provide a period switcher.
- **Date Sanitization:** Always sanitize raw announcement dates into standard `YYYY-MM-DD` ISO format, stripping any scraper metadata or status suffixes like `[Closed]`.
- **Fiscal year normalization:** Normalized to `NNN-NNN` (e.g. `2082/2083` or `FY 2082/83` → `082-083`) to match `manual_dividends.json`.
- **Dual-source resilience:** In `auto` mode, HamroShare runs first; symbols missing from HamroShare are queried via NepaliPaisa with 0.6s polite delay.
- **Non-destructive merging:** Existing user `notes` and previously fetched `bookClosureDateBS` dates are never overwritten in `db/dividend_data.json`.
- **Mutual funds (paid-up Rs 10):** Often have no corporate dividend entries or declare unit cash dividends — handled gracefully with explicit unit face values.
- **Manual override hierarchy:** Active entries in `manual_dividends.json` override auto data for the same symbol + fiscal year (user corrections always win), while entries marked `disabled: true` are bypassed so automated scraping takes over.
