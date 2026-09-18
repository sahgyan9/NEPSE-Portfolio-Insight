# Prompt Learnings Log

This file is a master registry of actionable rules, style constraints, and behavioral patterns learned from prompt engineering and refinements. The agent MUST consult this log before starting any task to avoid repeating past mistakes.

---

## 📋 General Guidelines
*Rules that apply across all coding and documentation tasks.*

- **Rule (Tool Minimization):** Keep tools minimal. Do not write automation scripts (such as custom Python utilities for editing/formatting files) if the agent can perform the file manipulation directly using native Markdown edits.
- **Rule (Process-Driven Alignment):** Leverage structured Markdown workflows (SOPs) for process-based tasks instead of programmatic code constraints.
- **Anti-Pattern (Avoid):** Creating redundant code assets that require maintenance, testing, and debugging when clear agent instructions/workflows are sufficient.

---

## 💻 Code Generation & Style
*Rules specifically for writing code, configuring tools, or structuring files.*

- **Rule (Next.js RSC Stream Ingestion):** For scraping Next.js App Router websites that server-render structured state (such as HamroShare), pass header `{"RSC": "1"}` to receive the pure `text/x-component` stream directly. This avoids downloading and regex-parsing bloated HTML or running slow headless browsers.
- **Rule (Strict Project Typechecking with Vite SWC):** In frontend projects using `@vitejs/plugin-react-swc`, `vite build` only strips types without running type checks. Always run `npx tsc -p tsconfig.app.json --noEmit` before concluding edits to hooks, utilities, or services to ensure missing imports, undeclared variables, or signature mismatches never silently reach runtime.
- **Rule (Differentiating Code Exceptions from External Network Failures):** Never wrap complex multi-step data pipelines in a generic `catch (err)` that blindly attributes all failures to external services (e.g. `setError('Failed to fetch stock data')`). Always output `console.error` with the stack trace, differentiate code runtime errors (`ReferenceError`, `TypeError`) from network/HTTP errors, and avoid masking syntax/import bugs as upstream service downtime.
- **Rule (Python-to-TypeScript Literal Safety):** When exporting or migrating JSON-like data or constant mappings from Python scripts into `.ts` or `.js` files, never keep unquoted `None`, `True`, or `False` literals. Convert them to `null`, `true`, `false`, or declare scoped aliases (e.g. `const None = null;`) to avoid fatal runtime reference errors.

---

## 🎨 UI/UX and Aesthetics
*Design choices, layout preferences, color harmonies, and interactive states.*

- **Rule (Fiscal Year Dividend Scoping & Explicit Display):** When displaying stock dividends on portfolio overview tables, default to the active/recent distribution fiscal year (e.g. `082-083`) rather than an unconstrained all-time `latest`. Never show dividends from older years as current dividends without explicit fiscal year labeling in the column header (e.g., `Dividend (082-083)`) and cell tooltips, and always provide an interactive period selector so the user can easily distinguish between recent and historical payouts.
- **Rule (Interactive Multi-Period Holdings Toggle):** For financial tables showing time-scoped distributions (such as annual dividends or quarterly EPS), provide prominent, 1-click segmented toggle buttons (`082-083 (Current)` | `081-082`) rather than hidden select dropdowns. Always reflect the active fiscal year in table headers, column tooltips, and summary cards.
- **Rule (Hook State Forwarding for Filtered Components):** When exposing complex sub-hook state (such as `useLivePortfolio`) through facade hooks (`usePortfolioAnalytics`), always forward all interactive control states (`dividendFiscalYear`, `setDividendFiscalYear`). Omitting state setters causes dependent child components to silently hide their interactive controls via conditional rendering guards.
- **Rule (Unified Cash & Bonus Dividend Valuation in Table Sorting):** In tables displaying corporate dividends, never sort the dividend column solely by cash dividend income (`dividendIncome`). Always compute a combined `totalDividendValue` (`cashGross + (bonusShares * currentPrice)`), ensuring bonus-only distributions (e.g., SAPIL with 10% bonus and 0% cash) sort and rank alongside cash distributions rather than being relegated to 0 alongside non-dividend stocks. Ensure bonus-only rows prominently display both bonus ratio and rupee valuation in cells and tooltips.

---

## 📝 Documentation & Formatting
*Preferences for Markdown files, comment styles, commit messages, and readmes.*

- 

---

## 🛑 Project Specific Constraints
*Rules unique to this workspace, API limitations, or folder structures.*

- **Rule (Dividend Scraping Priority & Hierarchy):** For dividend announcement ingestion, always prioritize the bulk Next.js RSC stream from `HamroShare` (`https://hamroshare.com.np/investment/proposed-dividend`, `RSC: 1` header) as the primary source for full-market data (covers 320+ companies across 6 FYs in a single ~1s call). Use the `NepaliPaisa` API (`https://nepalipaisa.com/api/GetDividends`) strictly as a targeted per-symbol fallback for missing tickers or when Bikram Sambat (`bookClosureDateBS`) is specifically required.
- **Rule (NepseAlpha Cloudflare TLS Impersonation):** When scraping NepseAlpha endpoints directly (`tools/scrape_nepsealpha_direct.py`, `tools/scrape_fundamentals_direct.py`), standard Python HTTP clients (`httpx`, `requests`) trigger Cloudflare `HTTP 403` bot challenges. Always ensure `curl_cffi` is installed in the active virtual environment (`impersonate="chrome"`).
- **Rule (Dividend Non-Destructive Merging):** When updating `db/dividend_data.json` from HamroShare or NepaliPaisa, NEVER overwrite the entire record. Retain existing user `notes`, existing Bikram Sambat book closure dates (`bookClosureDateBS`), and manual entries from `db/manual_dividends.json`.
- **Rule (Live Market & Index Architecture Priority):** Use `HamroShare` Next.js RSC streaming (`https://hamroshare.com.np/` and `/nepse/live-market` with header `{"RSC": "1"}`) as the primary live market and index fetcher in `nepse_server.py`. It delivers the NEPSE Index, 13 sub-indices, market turnover/status, and quotes for all 345+ traded stocks in a single ~400ms request with 24/7 CDN availability. Retain `AsyncNepse` (`nepalstock.com/api/nots/...`) strictly as a secondary fallback. Always maintain a 30-second in-memory cache to keep response times sub-millisecond and avoid spamming external services.
- **Rule (Company Fundamentals & Universe Scraping Priority):** For company fundamentals, 52-week High/Low, shares outstanding, and promoter holdings, prioritize `https://hamroshare.com.np/company/<SYMBOL>` and `/nepse/stocks` via Next.js RSC streaming (`RSC: 1` header). Retain `MerolaganiFetcher` strictly as an automatic fallback. This eliminates slow regex HTML parsing, avoids paid Firecrawl credits, and bypasses Cloudflare blocks while returning clean, structured quarterly data in ~250ms.
- **Rule (Frontend Live Pricing Pipeline):** Route frontend live quotes in `sharebazaarApi.ts` through local `nepse_server.py` (`/api/live-market`) first. It resolves the full portfolio in <5ms from the in-memory cache, keeping third-party `sharebazaar.vercel.app` purely as an automated fallback for unlisted or missing instruments.
- **Rule (Unified Single Source of Truth for Dividend Pipeline):** When computing or displaying stock dividends across different pages (Home Page holdings table, summary cards, and Dividends Page), ALWAYS consume from the single centralized endpoint (`GET /api/dividends/portfolio` in `nepse_server.py`) via `src/services/receivedDividendsApi.ts`. Never re-implement client-side merging or ad-hoc calculation routines in hooks or components. All tax rules (5%), fractional cash calculations, bonus share roundoffs, date eligibility, and manual overrides must remain strictly centralized in `compute_portfolio_dividends`.
- **Rule (Summary Card = All-Time Cash, Table Column = Per-FY):** The Home Page summary cards ("Total Cash Dividends", "Net Growth") MUST always display **all-time accumulated cash dividends** across every fiscal year (fetched via `fy='all'` from `compute_portfolio_dividends`). The holdings table Dividend column, however, scopes to the currently-selected FY. These are two separate `fetchPortfolioDividends` calls in `useLivePortfolio.ts` — one per-FY and one `fy='all'` — resolved in parallel via `Promise.allSettled`. The `fy='all'` result drives `summary.totalDividendIncome` and `summary.netGrowth`; the per-FY result drives per-holding `dividendIncome`. Never collapse these into a single call or revert the summary to per-FY scoping.

- **Rule (Demat Audit Trail Reconciliation):** When a user believes a transaction did not execute (e.g. "I tried to sell but it wasn't sold"), never blindly delete the transaction record. Cross-reference the official broker/Demat settlement transaction numbers (`SET:...`, `TD:...`) from the clearing statement. Often, the trade did clear, but subsequent buy or corporate action bonus lots were omitted from the ledger.
- **Rule (No Silent Demo Portfolio Substitution):** If live pricing or metadata fetching experiences an error, NEVER silently replace the user's authentic portfolio holdings from `db/portfolio.json` with hardcoded fallback/demo positions (`fallbackPortfolioData`). Substituting demo assets causes calculated cards and metrics (such as "Underperforming %" or total portfolio valuation) to report deceptive phantom statistics on assets the user does not own. Maintain the user's actual holding positions and gracefully fall back to last-known prices instead.


---


*To add new learnings, follow the process in [prompt_learning.md](file:///c:/Users/sahgy/Downloads/portfolio-insight-Copy/workflows/prompt_learning.md).*
