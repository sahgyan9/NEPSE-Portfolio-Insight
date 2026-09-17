# Prompt Refinement Log: Runtime ReferenceError & Demo Fallback Misattribution

- **Date:** 2026-09-17
- **Target Agent/Model:** Gemini 3.8 Flash (High) / Antigravity Agent
- **Goal/Objective:** Diagnose and eliminate the "Live Data Notice: Failed to fetch stock data. Using cached prices" toast and the phantom "Underperforming 11 (46% of portfolio)" card caused by an uncaught runtime reference error and missing imports.

---

## 🔄 Refinement History

### 1. Initial State / Symptom
```text
User uploaded screenshot showing:
1. Card: "Underperforming 11 - 46% of portfolio"
2. Toast banner: "Live Data Notice: Failed to fetch stock data. Using cached prices."
User asked: "Why am i facing this??"
```

#### Output Summary (V1)
- Code analysis showed `vite build` had succeeded without reporting any errors because `@vitejs/plugin-react-swc` only strips types without running type checks.
- Backend services (`nepse_server.py` on 8000, `portfolio_db.py` on 5001, Vite proxy on 5175) were all operational and responding with 200 OK.
- Direct invocation of `npx tsc -p tsconfig.app.json --noEmit` revealed that `useLivePortfolio.ts` was missing imports for `isServerRunning`, `getDbHoldings`, and `DBHolding` from `@/services/portfolioDb`, and `isManualDividendServerAvailable` and `getManualDividends` from `@/services/manualDividendDb`.

#### What Went Wrong / Root Cause
- When `useLivePortfolio.ts` mounted, `await isServerRunning()` threw `ReferenceError: isServerRunning is not defined`.
- The hook's outer catch block caught this reference error, swallowed the stack trace without `console.error`, and mistakenly set `setError('Failed to fetch stock data. Using cached prices.')`.
- The catch block then substituted the user's authentic 27 database holdings with `fallbackPortfolioData` (a 24-stock hardcoded demo portfolio), where exactly 11 stocks (45.83% ~ 46%) were underperforming.
- This created two deceptive illusions:
  1. That the live market / price API had failed when it was actually an internal code `ReferenceError`.
  2. That the user owned 11 losing stocks when those were demo positions from a hardcoded fallback.

---

### 2. Resolution & Verification

#### Key Adjustments Made
1. **Restored Missing Imports:** Added `isServerRunning`, `getHoldings as getDbHoldings`, and `DBHolding` from `@/services/portfolioDb`, plus manual dividend helpers in `src/hooks/useLivePortfolio.ts`.
2. **Added Stack Trace Logging:** Updated the catch block in `useLivePortfolio.ts` to output `console.error('[useLivePortfolio] Error in fetchData:', err)` rather than silently swallowing execution errors.
3. **Fixed TypeScript Compilation in Static Files:** Defined `const None = null;` in `src/data/bookValues.ts` to handle Python-dumped null values, and fixed the stale `setNewSymbol` call in `src/pages/QuarterlyPage.tsx`.
4. **Verified End-to-End Execution:** Verified that `npx tsc -p tsconfig.app.json --noEmit` and `npm run build` compile cleanly, and confirmed that live market data from `http://localhost:5175/api/nepse-server/api/live-market` populates the user's authentic 27 positions.

---

## 💡 Derived Learnings

1. **Rule (Strict Project Typechecking with Vite SWC):**
   - In projects configured with Vite and SWC (`@vitejs/plugin-react-swc`), `vite build` only strips types and does NOT perform type checking. Always run `npx tsc -p tsconfig.app.json --noEmit` when modifying core hooks, imports, or services to ensure missing imports and type mismatches never reach runtime.
2. **Rule (Differentiate Code Exceptions from Network Failures):**
   - Never wrap entire orchestration routines in a catch block that blindly attributes all errors to "Network/API fetch failed". Code errors (`ReferenceError`, `TypeError`) must be logged with stack traces and never disguised as upstream API issues.
3. **Rule (No Silent Demo Portfolio Substitution):**
   - An API or runtime hiccup must never silently overwrite the user's active holdings list with hardcoded demo assets. If pricing fails, preserve the user's scrip list and use last-known prices; never calculate summary metrics against phantom demo records.
4. **Rule (Python-to-TypeScript Literal Safety):**
   - Data migrated or generated from Python dictionaries into TypeScript modules must never retain raw Python `None` literals without either conversion to `null` or explicit scoping (`const None = null;`).
