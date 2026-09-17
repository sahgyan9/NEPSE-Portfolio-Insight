# Prompt Refinement Log: Dividend Pipeline Unification & Fiscal Year Scoping

- **Date:** 2026-09-17
- **Target Agent/Model:** Gemini 3.8 Flash (High) / Antigravity Agent
- **Goal/Objective:** Resolve dividend display divergence between the Dividends Page and Home Page holdings table, unify into a single source of truth, and ensure current-year dividend payouts are clearly scoped and labeled.

---

## 🔄 Refinement History

### 1. Initial Prompt (V1)
```text
recently we added dividend fetch and its reflected in dividend page but not in home page where we have portfolio table . Can you find out the issue
```

#### Output Summary (V1)
The agent investigated the two data pipelines:
1. `DividendsPage.tsx` fetched from `GET /api/dividends/portfolio?fy=...`, which computed dividends in `nepse_server.py` using auto-scraped HamroShare announcements and manual overrides.
2. `useLivePortfolio.ts` (Home page) ran a legacy duplicate calculation that fetched raw `dividend_data.json` and `manual_dividends.json` but strictly used manual records for cash and bonus shares, displaying `-` for all auto-scraped stocks.

#### User Follow-up & Strategic Direction (V2)
```text
why don't we unify both so that its never a probelm and fixing one fixes other
```

#### What Was Implemented (V2)
- Added `fy='latest'` support to `compute_portfolio_dividends` in `nepse_server.py` to compare auto and manual records across all fiscal years per stock.
- Replaced duplicate client-side math in `useLivePortfolio.ts` with a direct call to `fetchPortfolioDividends('latest')`.
- Verified TypeScript compilation and backend response.

---

### 2. User Feedback on V2 Implementation
```text
Updated fetchPortfolioDividends(fy) to default to 'latest'
But I want to see only of this year because if its latest then I can make sense okay which company has given dividend. Because of the latest implementation I see many dividend but no way to see which year it belongs to. So the better idea is of recent year
```

#### What Went Wrong / Root Cause Analysis
1. **Historical Payout Ingestion:** Defaulting to an unconstrained all-time `latest` pulled in announcements from 3-4 years ago (e.g., HBL from FY 078-079, NICA from FY 079-080, NIMB from FY 079-080, HRL from FY 080-081).
2. **Ambiguous Column Header:** The table column was labeled generically as `Dividend`. Users looking at the table saw numbers for 20 out of 26 holdings with no visible indication of which fiscal year each payout belonged to.
3. **Mismatched Expectations:** On the Dividends page, the active fiscal year was `081-082`, showing only 12 paying companies. The Home page showed 20 companies, inflating perceived current dividend income with ancient distributions.

---

### 3. Refined & Final Implementation (V3)

#### Key Adjustments Made
1. **Default to Recent Active Distribution Year (`081-082`):**
   - In `nepse_server.py`: `DEFAULT_DIVIDEND_FY = "081-082"`. Route `GET /api/dividends/portfolio` defaults to `081-082`.
   - In `src/services/receivedDividendsApi.ts`: `fetchPortfolioDividends(fy = DEFAULT_DIVIDEND_FY)`.
   - Non-paying holdings for `081-082` cleanly display `-`.
2. **Explicit Column Header & Tooltips:**
   - Table header explicitly renders `Dividend (081-082)`.
   - Cell tooltips state `FY {holding.latestDividendFiscalYear} Dividend`.
3. **Interactive Toolbar Fiscal Year Switcher:**
   - Added a compact `Dividend FY` dropdown to the `HoldingsTable` toolbar:
     - `FY 081-082 (Recent / Active)` *(Default)*
     - `FY 082-083 (Upcoming / Proposed)`
     - `FY 080-081`
     - `FY 079-080`
     - `All-Time Latest`
   - Switching the dropdown instantly updates the table column and portfolio summary cards.
4. **End-to-End State Synchronization:**
   - Exposes `dividendFiscalYear` and `setDividendFiscalYear` from `useLivePortfolio` and `usePortfolioAnalytics` to `Index.tsx`.

#### Output Summary & Verification (V3)
- API endpoint `http://localhost:5175/api/nepse-server/api/dividends/portfolio` returns `FY 081-082` with exactly 12 paying companies (Rs. 3,328.16 gross cash, 10 bonus shares), matching `DividendsPage` identically.
- `npx tsc --noEmit` and `npm run build` completed with zero errors.

---

## 🏆 Final Architecture

```text
Database (db/dividend_data.json + db/manual_dividends.json)
                         │
                         ▼
        nepse_server.py: compute_portfolio_dividends(fy)
                [Single Source of Truth]
                - Default fy: "081-082" (recent active year)
                - Explicit fy: "082-083", "080-081", etc.
                - All-time fallback: "latest"
                         │
                         ▼
            Endpoint: GET /api/dividends/portfolio?fy=...
                         │
                         ▼
      receivedDividendsApi.ts: fetchPortfolioDividends(fy)
            ┌────────────┴────────────┐
            ▼                         ▼
   Home Page Holdings Table     Dividends Page
   - Header: Dividend (081-082) - Dropdown FY selector
   - Toolbar FY Switcher        - Sparklines & history
   - Non-paying: "-"            - Identical calculations
```

---

## 💡 Derived Learnings

1. **Rule (Unified Dividend Source of Truth):** Never maintain separate frontend math or duplicate scrapers across different pages. All dividend computations (cash gross, cash net with 5% tax, bonus shares, eligibility by closure date, and manual override priority) must reside in a single endpoint (`GET /api/dividends/portfolio`).
2. **Rule (Fiscal Year Dividend Scoping & Explicit Display):** When displaying stock dividends in portfolio summary tables, default to the active/recent distribution fiscal year (`081-082`) rather than an unconstrained all-time `latest`. Never show dividends from older years as current dividends without explicit fiscal year labeling in the column header and cell tooltips, and always provide an interactive period selector so the user can easily distinguish between recent and historical payouts.
