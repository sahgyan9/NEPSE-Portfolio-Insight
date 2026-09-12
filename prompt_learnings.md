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

---

## 🎨 UI/UX and Aesthetics
*Design choices, layout preferences, color harmonies, and interactive states.*

- 

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

---


*To add new learnings, follow the process in [prompt_learning.md](file:///c:/Users/sahgy/Downloads/portfolio-insight-Copy/workflows/prompt_learning.md).*
