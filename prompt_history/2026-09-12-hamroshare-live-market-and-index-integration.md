# Prompt Refinement Log: HamroShare Live Market & Index Architecture Integration

- **Date:** 2026-09-12
- **Target Agent/Model:** Antigravity / Gemini 2.5
- **Goal/Objective:** Transition NEPSE live market indices, sector indices, market turnover, and live stock prices to HamroShare Next.js RSC streams as the primary provider with official `AsyncNepse` as fallback, and document the architecture across workflows, agent instructions, and learning registries.

---

## 🔄 Refinement History

### 1. Initial Prompt (V1)
```text
from where are we fetching NEPSE Changes or Maket index changes? what is its performance, can we leverge hamroshare for this as well?
```

#### Output Summary (V1)
- Analyzed `nepse_server.py` and discovered index data was fetched from official NEPSE NOTS API via `AsyncNepse` (`nepalstock.com/api/nots/...`), taking 2.7s–3.4s, and individual stock prices were fetched via 27 separate HTTP requests to `sharebazaar.vercel.app`.
- Prototyped and benchmarked HamroShare endpoints (`https://hamroshare.com.np/` and `/nepse/live-market`) using Next.js App Router RSC streams (`RSC: 1` header).
- Benchmarks showed:
  - NEPSE Index & 13 sector sub-indices fetched in **~300ms** (vs 2.7s–3.4s on NOTS).
  - All 345 listed NEPSE equities fetched in **~400ms in a single request** (vs 27+ sequential calls).
  - 24/7 availability via HamroShare Edge CDN even during market close when official NEPSE servers return HTTP 504.
- User requested: "yes go ahead and document the same".

#### Key Adjustments Made (V2)
- Implemented `HamroShareMarketFetcher` inside `nepse_server.py` with parsing for `nepseIndices`, `sectorIndices`, `marketSummary`, and `marketData`.
- Implemented a 30-second thread-safe in-memory cache to serve repeated frontend calls in < 1ms.
- Integrated `HamroShareMarketFetcher` as primary in `NepseDataFetcher`, keeping `AsyncNepse` as automatic fallback.
- Added `/api/live-market` delivering all 345 stocks in one JSON object.
- Enriched `/api/stocks` to merge live HamroShare quotes with `db/fundamentals.json` records.
- Maintained backward compatibility for all existing frontend API contracts (`/api/index`, `/api/indices`, `/api/market-summary`, `/api/stocks`).

---

## 🏆 Final Implementation & Verification
- Endpoint checks on port 8000:
  - `GET /api/index`: returned NEPSE 2559.49 (+27.94, +1.1%) with `source: live`.
  - `GET /api/indices`: returned main index + 13 sub-indices.
  - `GET /api/market-summary`: returned market status (CLOSE), top 5 gainers, top 5 losers, and indices.
  - `GET /api/live-market`: returned all 345 traded companies with LTP, point/pct change, and volume.
  - `GET /api/stocks?symbols=NABIL,GBBL`: returned enriched fundamentals merged with real-time quotes.
- Test Suite: 18/18 pytest tests passing (`pytest tools/ -v`).

---

## 💡 Derived Learnings

1. **Rule:** For high-speed live market data in NEPSE, prioritize Next.js RSC streaming from `HamroShare` (`https://hamroshare.com.np/` and `/nepse/live-market`, `RSC: 1` header).
2. **Context/Reason:** Official NEPSE servers (`nepalstock.com`) are slow (2.7s–3.4s) and shut down / return 504 outside market hours. HamroShare Edge CDN caches the latest closing session data, ensuring 24/7 availability in 300ms–400ms and batching all 345 stocks into one request.
3. **Rule:** Always maintain a dual-engine architecture with `AsyncNepse` as automatic fallback and a 30-second server cache.
