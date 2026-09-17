# Portfolio Insight Custom Project Rules & Agent Instructions

You're working inside the **WAT framework** (Workflows, Agents, Tools) for the NEPSE Portfolio Insight project. This architecture separates concerns so that probabilistic AI handles reasoning while deterministic code handles execution.

---

## 🤖 The WAT Architecture

**Layer 1: Workflows (The Instructions)**
- Markdown SOPs stored in `workflows/`
- Each workflow defines the objective, required inputs, which tools to use, expected outputs, and how to handle edge cases
- Written in plain language, the same way you'd brief someone on your team

**Layer 2: Agents (The Decision-Maker)**
- This is your role. You're responsible for intelligent coordination.
- Read the relevant workflow, run tools in the correct sequence, handle failures gracefully, and ask clarifying questions when needed
- You connect intent to execution without trying to do everything yourself

**Layer 3: Tools (The Execution)**
- Python scripts in `tools/` that do the actual work
- API calls, data transformations, file operations, database queries
- Credentials and API keys are stored in `.env`
- These scripts are consistent, testable, and fast

---

## 🎨 Brand Guidelines & Website Build Protocol (MANDATORY)

### If brand_assets/ exists with BRAND_GUIDELINES.md:
1. Read `brand_assets/BRAND_GUIDELINES.md` fully before any code.
2. List `brand_assets/` to know which logos, icons, and fonts are available.
3. Translate every guideline into CSS custom properties as the very first step.
4. Never override brand values — if something is unclear, ask before assuming.

> **Never default to generic blue/white or placeholder aesthetics when brand guidelines are available.**

### If NO brand guidelines exist (user is starting from zero):
**Run the 5-Phase Build Protocol below. Never skip phases or approval gates.**

#### Phase 0: Discovery — Build the Brand First
Ask questions in 2–3 grouped rounds (never all at once):
- **Round 1 — Product & Audience:** Product purpose, primary user, #1 call-to-action.
- **Round 2 — Aesthetic Direction:** Inspiration sites, mood word, light/dark mode preference, logo presence, primary user device (mobile vs. desktop).
- **Round 3 — Technical:** Framework preferences, page copy sources.

Then:
1. Scrape inspiration URLs using Firecrawl.
2. Generate `brand_assets/BRAND_GUIDELINES.md`.
3. **→ GATE 0: STOP. Show the brand guidelines. Wait for "approved" before writing any HTML/CSS.**

#### Phase 1: Structural Blueprint
1. Read brand assets and confirm logo availability.
2. Present a sitemap: pages, sections per page, components needed.
3. **→ GATE 1: STOP. Show sitemap. Wait for approval before building.**

#### Phase 2: Design System (CSS Only)
Build the full CSS design token system before any HTML. Internal step.
- **Mobile-first (default):** Write base styles for mobile, use `min-width` queries (`640px` -> tablet, `1024px` -> desktop). Use for consumer apps, social, news.
- **Desktop-first:** Write base styles for desktop, use `max-width` queries (`1024px` -> tablet, `640px` -> mobile). Use for dashboards, admin panels, data tools.

#### Phase 3: Minimalist Build (MVP)
Build with brand applied but no complex animations or heavy JS. Focused on layout, typography, color correctness, and responsive structure.
- **→ GATE 3: STOP. Show MVP. Ask: "Does the layout and brand feel right? Approve to continue to full build."** (Max 2 revision rounds)

#### Phase 4: Full Platform Build
Add micro-animations, full JS interactivity, generated images, accessibility pass (WCAG AA minimum), SEO meta/OG tags, dark mode, and performance polish.
- **→ GATE 4: STOP. Present final build. Confirm satisfaction.**

---

## 🔧 How to Operate & Self-Improvement

1. **Look for existing tools first:** Before building anything new, check `tools/` based on what your workflow requires. Only create new scripts when nothing exists for that task.
2. **Learn and adapt when things fail:** When you hit an error, read the full traceback, fix the script, and retest. Document rate limits, timing quirks, or unexpected behavior in the workflow.
3. **Keep workflows current:** Workflows should evolve as you learn. Update them when you find better methods or encounter constraints. Do not create or overwrite workflows without asking first.
4. **Enforce Prompt Learning:** Always read `prompt_learnings.md` at the start of any new session or task to load past rules. If the user provides feedback on your outputs or you refine your prompt approach, log the refinement history in `prompt_history/` and update the master `prompt_learnings.md` following `workflows/prompt_learning.md`.
5. **Bootstrap Prompt Learning System:** At the beginning of any workspace setup, check if the prompt learning files exist. If they do not, automatically initialize them:
   - Create `prompt_learnings.md` in the root directory.
   - Create the directory `prompt_history/` and write `prompt_history/TEMPLATE.md` to define the history template.
   - Create `workflows/prompt_learning.md` containing the SOP for prompt refinements.

   Initialize these files using the standard templates defined globally in your system-injected instructions. If you need reference files, you can read the live master blueprints from the source workspace:
   - Log: [prompt_learnings.md](file:///c:/Users/sahgy/Downloads/10hrs%20Video%20on%20Claude%20Code/prompt_learnings.md)
   - Template: [TEMPLATE.md](file:///c:/Users/sahgy/Downloads/10hrs%20Video%20on%20Claude%20Code/prompt_history/TEMPLATE.md)
   - Workflow: [prompt_learning.md](file:///c:/Users/sahgy/Downloads/10hrs%20Video%20on%20Claude%20Code/workflows/prompt_learning.md)
6. **The Self-Improvement Loop:** Every failure or user course-correction is a chance to make the system stronger:
   1. Identify what broke or what the user disliked in the prompt/execution.
   2. Fix the tool or refine the prompt.
   3. Verify the fix works.
   4. Update the workflow with the new approach.
   5. Log prompt adjustments in `prompt_history/` and update `prompt_learnings.md`.
   6. Move on with a more robust system.

   This loop is how the framework improves over time.

### File Structure & Directory Layout
- **Deliverables:** Final outputs go to cloud services (Google Sheets, Slides, etc.) where the user can access them directly.
- **Intermediates:** Temporary processing files that can be regenerated live in `.tmp/` and are disposable.
- **Layout:**
  - `brand_assets/` - Brand guidelines, logos, fonts, icons.
  - `.tmp/` - Temporary files, scraped data.
  - `tools/` - Python scripts for execution.
  - `workflows/` - Markdown SOPs.
  - `.env` - API keys and environment variables (NEVER store secrets elsewhere).
  - `db/` - JSON databases (fundamentals, portfolio, news).

---

## 🔑 Custom NEPSE Project Rules & Constraints

### 🔑 External API & Scraper Fallbacks
- **Multi-Key Fallback:** When writing or editing scraping scripts that require external services with credit limits (such as Firecrawl), always check the local `.env` file for secondary key entries (e.g., `FIRECRAWL_API_KEY_2`). 
- **Sequential Key Rotation:** Implement a sequential fallback loop at the execution block/runner level so that the script automatically retries with the next available key if the primary key returns a process error or credit exhaustion error.

### 💾 Database Data Merging (No Overwrites)
- **Field Merging:** Scraping scripts that update JSON databases (e.g., `db/fundamentals.json`) must merge newly scraped fields into the existing record rather than doing a full dictionary overwrite (`db[symbol] = scraped_data`). Wiping out the existing dictionary causes data loss for keys scraped by other scripts (such as promoter holdings, volume, or quarterly values).

### 📊 Financial Valuation & Scoring Constraints
- **Negative Valuation Multiples:** Negative P/E or P/B ratios signify a loss-making or insolvent company. They must always be evaluated as `critical` (or scored low) and never categorized under "lower is better" rules that award them an "excellent" rating.
- **Mutual Fund Exemption:** Mutual funds have different financial structures and do not report standard corporate EPS/Book Value. Always exempt holdings in the `Mutual Fund` sector from standard corporate fundamental valuation metrics, returning a "Mutual Fund (Not Rated)" status and recommending Net Asset Value (NAV) analysis instead.

### 🎨 Dashboard Design & Educational UX
- **Dynamic Sector-Specific Filtering:** When displaying metric tables or comparisons, always dynamically hide or filter out rows that are not applicable to the company's active sector (e.g., hide banking NIM or efficiency ratios for Hydropower/Manufacturing stocks, and hide underwriting ratios for general firms). This keeps dashboards clean and prevents empty placeholder entries.
- **Structured Tooltips:** Educational tooltips on financial metrics should use a structured layout:
  1. **Definition:** Core meaning of the ratio.
  2. **Ranges & Benchmarks:** Explicit values showing what constitutes a "Good Range" vs. a "Warning Threshold".
  3. **Trend & Growth Guide:** Clear advice on how to evaluate the direction of growth or change (e.g., whether growth is positive or indicates warning signs).
- **Interactive Text Signifiers:** Any text or table cells that trigger page transitions or navigation (such as company names in the holdings table) must be styled with a dashed bottom border by default to signify their clickability. On hover, the border must transition to a solid line and highlight in the primary brand color to confirm interactivity.
- **Dual Y-Axis Scaling:** When plotting metrics with vastly different ranges (such as scale metrics in Millions/Crores and ratio metrics in Rupees or Percentages) on the same chart, implement a dual Y-axis layout. This prevents smaller values from being flat-lined and rendered unreadable. Dynamically hide the secondary axis if no metrics mapped to it are active.
- **Cache Validity Checking:** In-memory or persistent cache checks on the frontend must check for object completeness rather than relying solely on timestamps. If the cached record contains null values for critical metrics (such as the last traded price), invalidate the cache entry and force a new API fetch.
- **Query Parameter Routing:** Detail pages that show data for a selected item must synchronize their active state (such as the selected stock symbol) with query parameters in the URL. This supports persistence on browser reload and enables deep linking directly from dashboards or table links.

### 🚀 Git Workflow
- **Incremental Commits:** When syncing changes to GitHub, make separate, logical commits for each component or feature changed (e.g., commit navigation changes, ticker changes, and server changes separately). Do not package multiple distinct tasks into a single monolithic commit.

### 📰 News & Ticker Freshness
- **Lookback Cutoff:** Active real-time components (such as the news ticker marquee) must exclude news articles older than 90 days to prevent stale or irrelevant historical context from cluttering current views.

### ⚡ Strict Async Timeouts (No Indefinite Hangs)
- **Timeouts on External Requests:** When writing or modifying backend server code that fetches data from third-party APIs or scrapers (e.g., NEPSE, ShareBazaar), NEVER rely on default timeout behavior. All `await` calls to external fetchers must be explicitly wrapped with a strict timeout (e.g., `asyncio.wait_for(..., timeout=3.0)`) to ensure the server gracefully falls back to cached data or returns an error payload without freezing the entire application thread.

### 🗑️ Deletion & State Management Scoping
- **Superficial vs. Core Deletions:** If a user requests to "delete" or "remove" an item in the context of an annoying UI element, mislabeled text, or news ticker, assume the scope of deletion is strictly limited to that superficial data layer (e.g., `db/news.json`). NEVER delete core user state records (like financial holdings in `db/portfolio.json` or core configurations) without explicitly confirming the destructive action with the user first, as this causes catastrophic drops in calculated metrics.

### 💰 Dividend Scraping Multi-Source Architecture & Priority
- **Primary Bulk Source:** Always prioritize `HamroShare` (`https://hamroshare.com.np/investment/proposed-dividend`) via Next.js RSC streaming (pass header `{"RSC": "1"}`). A single request yields 830+ announcements across 6 fiscal years covering 320+ NEPSE companies in ~1 second. It also enriches data with `announcementDateAD`, `bonusListingDateAD`, and `closePrice`.
- **Secondary Fallback Source:** Use `NepaliPaisa` (`https://nepalipaisa.com/api/GetDividends?stockSymbol=...`) as an automatic per-symbol fallback when a symbol is absent from HamroShare (such as specific mutual funds or recent restructuring), or when Bikram Sambat (`bookClosureDateBS`) is specifically needed.
- **Non-Destructive Merging:** Never overwrite user `notes` or existing NepaliPaisa `bookClosureDateBS` dates when ingesting HamroShare data. Always preserve `db/manual_dividends.json` as the highest-priority override.

### 🛡️ NepseAlpha Cloudflare & TLS Impersonation
- **Cloudflare Bot Challenge:** NepseAlpha endpoints (`https://nepsealpha.com/search`, `/ajax/financials-menu/...`) sit behind Cloudflare bot protection. Standard Python HTTP libraries (`httpx`, `requests`) trigger `HTTP 403` due to scripted TLS fingerprints.
- **curl_cffi Prerequisite:** All direct NepseAlpha scrapers (`tools/scrape_nepsealpha_direct.py`, `tools/scrape_fundamentals_direct.py`, `tools/archive_fundamentals.py`) MUST have `curl_cffi` installed in `.venv` to mimic Chrome's TLS fingerprint (`impersonate="chrome"`). If missing, install `curl_cffi==0.15.0`.

### 📈 Live Market & Index Scraping Priority (HamroShare Primary, AsyncNepse Fallback)
- **Primary Source:** Use `HamroShare` Next.js RSC streaming (`https://hamroshare.com.np/` and `/nepse/live-market` with header `{"RSC": "1"}`) for live NEPSE index, 13 sub-indices, market summary, and real-time equity prices. It returns all 345+ active stocks in a single ~400ms request and is available 24/7 via CDN caching even when official NEPSE servers 504.
- **Secondary Fallback:** Retain official `AsyncNepse` (`nepalstock.com/api/nots/...`) as an automated fallback if HamroShare fails or times out.
- **30-Second TTL Caching:** `nepse_server.py` must maintain an in-memory cache of market index and live stock snapshots for at least 30 seconds to serve concurrent UI requests in <1ms without excessive network traffic.

### 🎯 Unified Portfolio Dividend Pipeline & Fiscal Year Scoping
- **Single Source of Truth:** All dividend calculations across the entire application (Home Page holdings table, summary cards, and Dividends Page) MUST consume from `GET /api/dividends/portfolio` in `nepse_server.py` via `src/services/receivedDividendsApi.ts`. Never re-implement separate client-side dividend parsing or ad-hoc calculations in frontend hooks.
- **Default to Active Distribution Year:** When computing or displaying stock dividends, default to the current active distribution fiscal year (`082-083`). Do not default to an unconstrained all-time `latest`, which improperly displays historical distributions from 3-4 years ago as current income.
- **Explicit Header & Period Selection:** Holdings tables displaying dividends must explicitly label the column with the active fiscal year (e.g., `Dividend (082-083)`) and provide interactive segmented toggle buttons (`082-083 (Current)` | `081-082`) to switch between active distributions and past years seamlessly.

### 🔍 Demat Statement Audit Trail Reconciliation
- **Clearing Record Verification:** When a user reports that a sell or buy order did not execute (e.g., "I tried to sell but it wasn't sold"), never perform a superficial deletion or overwrite without verifying against the official MeroShare Demat statement CSV clearing records (`SET:...`, `TD:...`). Transactions that cleared at the depository level must be preserved, and ledger discrepancies must be resolved by identifying missing buy or corporate action bonus lots to ensure mathematically rigorous reconciliation with depository holdings.

### 🛡️ Strict Typechecking & Import Verification (Vite SWC)
- **Non-Checking Transpiler:** This project uses `@vitejs/plugin-react-swc`. Vite build and dev commands only strip TypeScript types and do NOT typecheck. After making any edits to hooks, services, or data modules, ALWAYS run `npx tsc -p tsconfig.app.json --noEmit` to catch missing imports, undefined variables, or typing mismatches before concluding work.

### 🚫 Error Attribution & No Silent Demo Portfolio Substitution
- **Differentiate Code vs Network Errors:** Never wrap orchestration hooks in generic try/catch blocks that label all failures as "Failed to fetch data / network error". Code errors (`ReferenceError`, `TypeError`) must be logged with stack traces (`console.error`) and isolated from external network outages.
- **Never Overwrite Real Holdings with Demo Scrips:** An API or metadata failure must NEVER silently replace the user's authentic portfolio positions in `db/portfolio.json` with hardcoded demo data (`fallbackPortfolioData`). Doing so generates phantom metrics (such as misleading underperforming stock percentages) on assets the user does not own. Use cached prices on real positions instead.




