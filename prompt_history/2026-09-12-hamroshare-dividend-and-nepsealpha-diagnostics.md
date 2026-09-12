# Prompt Refinement Log: HamroShare Dividend Ingestion & NepseAlpha Diagnostics

- **Date:** 2026-09-12
- **Target Agent/Model:** Gemini 3.8 Flash (High) / Antigravity Agent
- **Goal/Objective:** Run workspace diagnostics, verify financial statement & dividend ingestion, explore `https://hamroshare.com.np/investment/proposed-dividend`, and establish priority data sources.

---

## 🔄 Refinement History

### 1. Initial Prompt (V1)
```text
run this workspace and see everything is working. The financial statement of each company is being fetched, the dividend is being fetched and recorded

See from where we are scrapping the data from and I found a new source from where its easy to scrape data (https://hamroshare.com.np/investment/proposed-dividend) explore this and see if we can leverage this
```

#### Output Summary (V1)
The agent:
1. Ran environment and unit test diagnostics (`pytest tools/ -v`), finding that `tools/test_data_integrity.py` failed due to missing `db/quarterly/SAPIL.json`.
2. Diagnosed that NepseAlpha direct scraping received `HTTP 403` from Cloudflare because `curl_cffi` was missing from `.venv` despite being in `requirements.txt`.
3. Installed `curl_cffi==0.15.0`, successfully scraped SAPIL, and verified that all 18 unit tests passed.
4. Tested all three background services (Portfolio DB on 5001, NEPSE Server on 8000, Vite Dev Server on 5173).
5. Explored `https://hamroshare.com.np/investment/proposed-dividend`, discovering that it runs on Next.js App Router with React Server Components (RSC). Passing `RSC: 1` returns 838+ announcements across 6 fiscal years covering 320+ NEPSE companies in ~1 second in a single HTTP GET.
6. Presented a comparison between NepaliPaisa and HamroShare and proposed leveraging HamroShare as primary bulk scraper with NepaliPaisa fallback.

#### What Went Well / User Feedback
User approved the plan: "yes go ahead".
Follow-up instruction: "document this as that future AI agents have context of these changes and priority".

---

### 2. Refined & Implemented Pipeline (V2)
```text
Implement HamroShare bulk dividend fetching as primary with NepaliPaisa fallback in tools/scrape_dividends.py. Document the priority and context for future AI agents.
```

#### Key Adjustments Made
1. **Primary Bulk Source:** Added `fetch_hamroshare_bulk()` to [`tools/scrape_dividends.py`](file:///c:/Users/sahgy/Downloads/portfolio-insight-Copy/tools/scrape_dividends.py) using Next.js RSC header (`{"RSC": "1"}`).
2. **Secondary Fallback Source:** Maintained `fetch_symbol_nepalipaisa()` per symbol for any missing tickers and for Bikram Sambat (`bookClosureDateBS`) preservation.
3. **CLI & Automation:** Added `--source {auto,hamroshare,nepalipaisa}` (default `auto`).
4. **Data Model Enrichment:** Added `announcementDateAD`, `bonusListingDateAD`, and `closePrice` without breaking existing fields.
5. **Non-Destructive Merging:** Enforced preservation of existing `notes` and `bookClosureDateBS` fields.

#### Output Summary & Verification (V2)
- CLI testing:
  - `python tools/scrape_dividends.py NABIL GBBL --source hamroshare` -> 10 entries in 1.4s.
  - `python tools/scrape_dividends.py NABIL GBBL --source nepalipaisa` -> 32 entries.
  - `python tools/scrape_dividends.py` -> 17 symbols resolved via HamroShare, 10 via NepaliPaisa fallback; 53 entries updated; 0 failures.
- Server API:
  - `POST http://localhost:8000/api/dividends/refresh` returned `200 OK` in ~1.5s with zero errors.

---

## 🏆 Final Architecture & Source Priorities

```text
Dividend Announcement Ingestion:
1. Primary Bulk Source: HamroShare (Next.js RSC Stream, RSC: 1 header) -> ~1s full market sync (830+ announcements, 320+ companies).
2. Fallback / Detail Source: NepaliPaisa Public API (per-symbol) -> fills missing symbols & provides bookClosureDateBS.
3. Overrides: db/manual_dividends.json -> absolute priority over scraped data.

Financial Statement Ingestion:
1. Primary Direct Scraper: tools/scrape_nepsealpha_direct.py -> requires curl_cffi==0.15.0 in .venv for Chrome TLS impersonation against Cloudflare.
2. Direct Markdown Parser: tools/parse_nepsealpha_md.py -> parses TTM ratios and balance sheet to db/quarterly/<SYMBOL>.json.
```

---

## 💡 Derived Learnings for Future Agents

1. **Rule (Dividend Multi-Source Hierarchy):** For dividend ingestion, always prioritize bulk HamroShare fetch (`tools/scrape_dividends.py --source auto`). Use NepaliPaisa only as a targeted fallback for missing tickers or when Bikram Sambat dates are explicitly needed.
2. **Rule (NepseAlpha Cloudflare TLS Impersonation):** When scraping NepseAlpha directly, standard HTTP clients (`httpx`, `requests`) trigger `HTTP 403`. Ensure `curl_cffi` is installed and used with `impersonate="chrome"`.
3. **Rule (Next.js RSC Ingestion):** When interacting with Next.js App Router applications that server-render data (like HamroShare), pass header `{"RSC": "1"}` to retrieve pure `text/x-component` streams directly rather than parsing bloated HTML.
