# Workflow: Fetch Live Market Indices & Stock Prices

## Objective
Provide ultra-low latency (<400ms), resilient live market indices (NEPSE Index, Sensitive, Float), 13 sector sub-indices (Banking, Hydropower, etc.), market summary (turnover, transactions, status, top gainers/losers), and real-time pricing for all 345+ listed NEPSE equities to power dashboard widgets, tickers, and portfolio valuation.

---

## Architecture & Data Providers

```
Frontend (React/Vite)
       │
       ▼
nepse_server.py (Port 8000)
       │
       ├─► In-Memory Cache (30s TTL, serves in <1ms)
       │
       ├─► [PRIMARY] HamroShare Next.js RSC Fetcher
       │     • GET https://hamroshare.com.np/ (RSC: 1) -> Indices & Market Summary (~300ms)
       │     • GET https://hamroshare.com.np/nepse/live-market (RSC: 1) -> 345 Stocks (~400ms)
       │
       └─► [FALLBACK] AsyncNepse (Official NEPSE NOTS API)
             • nepalstock.com/api/nots/... (~3000ms, prone to off-hours 504 timeouts)
```

### 1. Primary Provider: HamroShare RSC Streaming
- **Endpoints:**
  - `https://hamroshare.com.np/` with header `{"RSC": "1"}`
  - `https://hamroshare.com.np/nepse/live-market` with header `{"RSC": "1"}`
- **Mechanism:** Next.js App Router React Server Component (RSC) streaming format (`text/x-component`). Server chunks contain embedded JSON state objects (`nepseIndices`, `sectorIndices`, `marketSummary`, `marketData`).
- **Advantages:**
  - **Single Request Batching:** Returns all 345 active stocks in 1 request instead of dozens of per-symbol queries.
  - **Extreme Speed:** 300ms–400ms total latency compared to 3,000ms+ for official NEPSE NOTS.
  - **24/7 Availability:** HamroShare Edge CDN serves the latest close session data even when official NEPSE shuts down outside trading hours.
  - **Zero Bot Friction:** Standard HTTP clients with proper User-Agent can ingest without Cloudflare CAPTCHA blocks.

### 2. Secondary Provider (Fallback): AsyncNepse
- **Package:** `nepse` (`AsyncNepse` client)
- **Target:** Official NEPSE NOTS API (`nepalstock.com/api/nots/...`)
- **Behavior:** Activated automatically if HamroShare requests fail, time out, or return empty payloads.

---

## Server Endpoints (`nepse_server.py`)

All endpoints feature 30-second in-memory caching to eliminate redundant remote calls:

1. **`GET /api/index`**
   - Returns core NEPSE index data: `value`, `change`, `change_pct`, `high`, `low`, `previous_close`, `source`.
2. **`GET /api/indices`**
   - Returns `main_indices` (NEPSE) and 13 `sub_indices` (Banking, Hydropower, Life Insurance, Microfinance, Manufacturing, etc.).
3. **`GET /api/market-summary`**
   - Comprehensive dashboard payload: `nepse_index`, `market_status` (is_open, status), `top_gainers` (top 5), `top_losers` (top 5), `main_indices`, and `sub_indices`.
4. **`GET /api/live-market`**
   - Live prices, point change, % change, volume, high, and low for all 345+ traded stocks in NEPSE.
5. **`GET /api/stocks?symbols=NABIL,GBBL,...`**
   - Merges fundamental records from `db/fundamentals.json` with real-time HamroShare live market quotes (`last_traded_price`, `point_change`, `percentage_change`, `volume`).

---

## Edge Cases & Error Handling

- **Strict Timeouts:** All remote calls are wrapped in `asyncio.wait_for(..., timeout=5.0)` to ensure backend threads never hang indefinitely.
- **Graceful Fallback:** If HamroShare fails, the system logs a warning, attempts `AsyncNepse`, and if both fail, serves stale cached data or last known fundamentals with `"source": "cache"` / `"source": "stale"`.
- **Trading Hours vs. Off-Hours:** During market close, HamroShare preserves the final closing session index and stock prices. The server flags `"is_open": false` and `"status": "CLOSE"`.
- **Non-Destructive Fundamentals Merging:** Live market prices update the active display quote without altering historical fundamentals or user-entered holdings.
