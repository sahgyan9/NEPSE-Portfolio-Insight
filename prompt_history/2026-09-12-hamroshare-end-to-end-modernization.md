# Prompt Refinement Log: HamroShare End-to-End Modernization (Opportunities 1–5)

- **Date:** 2026-09-12
- **Target Agent/Model:** Gemini 3.8 Flash (High) / Antigravity Agent
- **Goal/Objective:** Modernize Portfolio Insight backend and data fetching across opportunities 1 through 5 using HamroShare Next.js RSC streaming, eliminating slow/flaky scrapers, accelerating portfolio pricing to <5ms, and adding IPO Pipeline & 52-Week High/Low Breakout Scanners.

---

## 🔄 Refinement History

### 1. User Instruction
```text
go ahead till opportunity 5. Since its a huge things you will most likey break things. so test, validate and go slowly so that chnages doesn't break things. I liked that now IPO will be also there. Great!!
```

### 2. Execution Phases & Implementation

1. **Phase 1: High-Speed Frontend Portfolio Pricing**
   - Upgraded [`src/services/sharebazaarApi.ts`](file:///c:/Users/sahgy/Downloads/portfolio-insight-Copy/src/services/sharebazaarApi.ts) with `fetchFromNepseServer()` calling `GET /api/live-market`.
   - Portfolio holdings now resolve in **<5ms** from memory instead of 4–8 seconds of chunked Vercel calls.
   - Retained ShareBazaar Vercel as automatic fallback for any missing instruments.
   - Updated [`src/pages/DividendsPage.tsx`](file:///c:/Users/sahgy/Downloads/portfolio-insight-Copy/src/pages/DividendsPage.tsx) to use batch `fetchMultipleStockData`.

2. **Phase 2: Company Fundamentals via HamroShare in Backend**
   - Added `HamroShareCompanyFetcher` and `UnifiedFundamentalsFetcher` to [`nepse_server.py`](file:///c:/Users/sahgy/Downloads/portfolio-insight-Copy/nepse_server.py).
   - Ingests Book Value, EPS (with reported quarter), PE, PBV, 52w High/Low, shares, and promoter holding in ~250ms directly from `https://hamroshare.com.np/company/<SYMBOL>` via RSC stream (`RSC: 1` header).
   - Retained `MerolaganiFetcher` as automatic fallback.

3. **Phase 3: Retire Paid Firecrawl Scrapers for Market Data**
   - Modernized [`tools/scrape_market_data.py`](file:///c:/Users/sahgy/Downloads/portfolio-insight-Copy/tools/scrape_market_data.py) to pull from HamroShare RSC as primary source.
   - Preserves non-destructive merge into `db/fundamentals.json`.
   - Keeps `--source firecrawl` as an optional fallback.

4. **Phase 4: Master Security Universe & 52-Week Range Bulk Sync**
   - Added `get_all_securities()` to `nepse_server.py` and endpoint `GET /api/nepse/all-stocks` returning all 951 listed securities in ~400ms.
   - Created [`tools/sync_universe.py`](file:///c:/Users/sahgy/Downloads/portfolio-insight-Copy/tools/sync_universe.py), populating 949 company mappings in `db/company_symbol_map.json` and 951 securities in `db/fundamentals.json`.

5. **Phase 5: Feature Expansion (IPO Pipeline & 52-Week High/Low Scanner)**
   - Added `get_ipos()` and `get_high_low_scanner()` to `nepse_server.py`.
   - Exposed endpoints `GET /api/investment/ipos` and `GET /api/market/high-low-scanner`.
   - Created [`src/services/investmentApi.ts`](file:///c:/Users/sahgy/Downloads/portfolio-insight-Copy/src/services/investmentApi.ts).
   - Created [`src/components/IPOTable.tsx`](file:///c:/Users/sahgy/Downloads/portfolio-insight-Copy/src/components/IPOTable.tsx) with search, status badges (Open Now, Upcoming, Closed), and type filtering.
   - Created [`src/components/HighLowScannerCard.tsx`](file:///c:/Users/sahgy/Downloads/portfolio-insight-Copy/src/components/HighLowScannerCard.tsx) with near 52-week High and near 52-week Low breakout tracking.
   - Embedded into [`src/pages/MarketPage.tsx`](file:///c:/Users/sahgy/Downloads/portfolio-insight-Copy/src/pages/MarketPage.tsx) and [`src/pages/DividendsPage.tsx`](file:///c:/Users/sahgy/Downloads/portfolio-insight-Copy/src/pages/DividendsPage.tsx).

---

## 🧪 Verification & Test Results
- `npm run build`: Build succeeded cleanly in 7.4s with 0 errors.
- `pytest tools/ -v`: 21/21 unit tests passing.
- Smoke tests verified on `http://localhost:8000`:
  - `GET /api/live-market`: 345 stocks in <5ms.
  - `GET /api/stock/NABIL`: Clean fundamentals in ~250ms (`source: hamroshare`).
  - `GET /api/stocks?symbols=NABIL,GBBL`: Concurrent batch resolve in <300ms.
  - `GET /api/nepse/all-stocks`: 951 securities.
  - `GET /api/investment/ipos`: 290 corporate issues.
  - `GET /api/market/high-low-scanner`: 287 breakout rows.
