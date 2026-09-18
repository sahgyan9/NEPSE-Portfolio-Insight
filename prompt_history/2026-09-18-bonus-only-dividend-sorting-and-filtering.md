# Prompt Refinement Log: Bonus-Only Dividend Sorting & Filtering

- **Date:** 2026-09-18
- **Target Agent/Model:** Gemini 3.8 Flash (High) / Antigravity
- **Goal/Objective:** Ensure stocks declaring 100% bonus shares and 0% cash (such as SAPIL) sort and filter accurately alongside cash dividend stocks in the portfolio holdings table.

---

## 🔄 Refinement History

### 1. Initial Prompt (V1)
```text
in our portfolio holding we have filters in all the field. But I found that when I clicked the dividend field SAPIL hasn't given cash and only bonus hence it was not filter as all others. Hope you understood
```

#### Output Summary (V1)
Diagnosed that the holdings table sorted solely by `dividendIncome` (which only captured gross cash dividend income in Rs). Because SAPIL declared a 10% bonus share dividend and 0% cash dividend for FY 082-083, its `dividendIncome` was 0. When users clicked the table header to sort or filter by dividend, SAPIL received a score of 0 and remained lumped together with stocks declaring no dividends at all.

#### What Went Wrong / User Feedback
- The sorting comparator only checked `dividendIncome` (cash dividend).
- The `SortKey` on the table header was explicitly bound to `dividendIncome` rather than combined dividend value.
- The TableCell display for bonus-only stocks displayed `Bonus: 10%` without the monetary value equivalent of the bonus shares at current LTP.
- An invalid HTML nested `<button>` tag inside another `<button>` in the TableHead wrapped the sort button and icon, causing erratic click capture.

---

## 🏆 Final Solution & Implementation

1. **Unified Dividend Valuation:** Added `bonusPercent`, `totalDividendPercent`, and `totalDividendValue` to `StockHolding` in `src/data/portfolioData.ts` and computed them in `src/hooks/useLivePortfolio.ts` (`totalDividendValue = dividendIncome + bonusShareValue`).
2. **Comprehensive Dividend Sorting:** In `src/components/HoldingsTable.tsx`, expanded `SortKey` to `"totalDividendValue"`. The comparator evaluates both cash income and bonus share value, with graceful fallback to declared bonus/cash percentages if LTP is unavailable.
3. **Keyword Search Filtering:** Enhanced `filteredHoldings` to match "dividend", "dividends", "bonus", and "cash" search queries.
4. **First-Class Bonus Cell Display:** Updated the dividend cell to render bonus share count and estimated monetary value alongside the ratio, plus total combined dividend value in the tooltip.
5. **Valid DOM Event Handling:** Eliminated nested `<button>` tags by passing the icon as `children` to `SortableHeader`.

---

## 💡 Derived Learnings

1. **Rule (Unified Cash & Bonus Dividend Valuation in Table Sorting):** In tables displaying corporate dividends, never sort the dividend column solely by cash dividend (`dividendIncome`). Always compute a combined `totalDividendValue` (`cashGross + (bonusShares * currentPrice)`), ensuring bonus-only distributions (e.g. 100% bonus like SAPIL) rank appropriately with cash distributions.
2. **Context/Reason:** Investors evaluate dividends as total returns. Sorting only by cash causes stocks with high bonus payouts to be penalized with a 0 score and placed at the bottom alongside non-paying stocks.
