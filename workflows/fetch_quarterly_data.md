# Workflow: Fetch Quarterly Data via NepseAlpha

## Objective
Extract quarterly financial metrics (EPS, BVPS, ROE, etc.) for a given NEPSE stock symbol from NepseAlpha — **directly over plain HTTP, with no Firecrawl API key or LLM extraction** (same philosophy as the dividend scraper's NepaliPaisa approach).

## Required Inputs
- `symbol`: The stock ticker symbol (e.g., SAHAS, MEN)

## Tools
- `tools/scrape_nepsealpha_direct.py` (**primary, no API key**): Fetches both tables with plain `httpx` GETs:
  1. **Ratios (8 quarters)** — the `/search?isBrk=1&mobile_app=1&q=<SYM>` page is server-rendered (Inertia.js) and embeds the full quarterly dataset as HTML-escaped JSON in the page source (`quartesGrowths`, `otherQuartGrowths`, `masterData`). The script parses that JSON directly — exact values, no LLM.
  2. **Balance sheet (~5 quarters)** — `/ajax/financials-menu/<SYM>` returns `{"html": ...}` with the 'Unaudited Quarterly Financial Report' table, parsed with a stdlib HTMLParser.
  It outputs the same two files as the old pipeline: `.tmp/<SYMBOL>_fundamentals.md` and `.tmp/<SYMBOL>_financials.md`.
- `tools/scrape_nepsealpha.py` (**legacy fallback, needs FIRECRAWL_API_KEY**): The old Firecrawl/LLM-extraction path. Keep for emergencies (e.g., if NepseAlpha changes its page internals and the direct scraper breaks).
- `tools/parse_nepsealpha_md.py`: Unchanged. Parses both markdown tables, merges the data, extracts row sort orders, and upserts everything into `db/quarterly/<SYMBOL>.json`.

## Expected Output
A structured JSON array in `db/quarterly/<SYMBOL>.json` containing up to 8 quarters of historical metrics. The data is upserted, so old data is retained and new data is appended or updated. Balance sheet data typically spans 5 quarters, while ratio data spans 8.

## Process
1. Run `python tools/scrape_nepsealpha_direct.py <SYMBOL> [<SYMBOL2> ...]` to fetch the raw data (supports multiple symbols in one run, 1s polite delay between them).
2. Run `python tools/parse_nepsealpha_md.py <SYMBOL>` to parse the markdown and update the local database.
3. If step 1 fails persistently (site redesign), fall back to `python tools/scrape_nepsealpha.py <SYMBOL>` (Firecrawl) and file an issue to update the direct scraper.

## Edge Cases & Quirks Learned
- **No API key needed**: Both endpoints work without cookies, sessions, or keys (verified 2026-07-19). Keep the polite delay and a browser-like User-Agent.
- **BVPS quirk**: In the embedded JSON, the `bvps` particular is actually *book-close-adjusted total equity*; the displayed BVPS is that value divided by `masterData.shares_outstnading`. The direct scraper replicates NepseAlpha's own front-end math, so its output matches the widget exactly.
- **PE/PB/PS live separately**: They come from `otherQuartGrowths`, keyed by `date`, matched to quarters via each quarter's `financial_date`.
- **Better coverage than broker-widget**: Microfinance/dev-bank symbols (e.g. CBBL) that had no broker-widget table DO have `quartesGrowths` data on the `/search` page, so the financials-only fallback is needed less often.
- **Exact values, not display-rounded**: The embedded JSON carries full-precision values (the old LLM extraction inherited the widget's display rounding). Markdown output is rounded to 2dp for pipeline compatibility.
- **Handling Asymmetric Quarter Data**: NepseAlpha provides 8 quarters of ratio data but only 5 quarters of balance sheet data. Do not drop the older quarters! Parse all 8 and let the UI filter empty columns for the Balance Sheet view.
- **Data Pipeline & Sorting**: To preserve NepseAlpha's original row order, the parser captures `raw_keys_order`. Backend APIs must include this array in payloads or the UI falls back to alphabetically-sorted JSON keys.
- **Symbol not found / 404**: The direct scraper writes placeholder files and the parser fails gracefully with "Error: Could not find data table".
- **Data missing (Delay)**: Sometimes companies publish PDFs but NepseAlpha hasn't updated their UI yet. The parsed data won't include the newest quarter until NepseAlpha updates.
- **Units: every amount is stored in rupees** (fixed 2026-11-15). The source reports amounts in thousands. `tools/harvest_all_quarterly.py` multiplies them by 1,000 unless `is_ratio_or_per_share()` says the field is a ratio or per-share figure. That test must match whole words: the old substring test matched "pe" in "Operating"/"Expenses" and "ratio" in "Operation", so eight amount fields (Operating Profit, Total Operating Income, Revenue from Operation(s), Total Operating Profit, Total Expenses (And Provisions), Management Expenses) were left in thousands. When the source adds a new field name, check it against that function before trusting the stored value.
- **Repairing stored units**: `python tools/fix_quarterly_units.py` reports records whose operating and expense lines are still in thousands; `--apply` converts them after copying the files to `.tmp/`. Converted records carry a `unit_fix` key, so the tool is safe to re-run. `db/quarterly` is the research dataset: any run that changes data needs an entry in the deviation log of `docs/research/PHASE2_PREREGISTRATION.md`.
- **Bank ratios served x100** (found 2026-11-15). HamroShare sometimes serves CAR, NPL, CD ratio, cost of funds, base rate and spread without the decimal point (CAR 11.12 as 1112), for a whole row or a single field. The scorer excludes a bank with NPL above 10%, so one such row drops the company. `tools/harvest_all_quarterly.py` now runs `tools/fix_quarterly_percents.py` on each company file after every upsert, because a re-harvest deep-merges the wrong value back. To check the whole dataset: `python tools/fix_quarterly_percents.py` (report only) and `--apply`. It divides by 100 only when the result agrees with the company's neighbouring quarters; an NPL above 100% that does not fit is removed from `raw` and kept under `pct_invalid`. Values it cannot judge are listed as "in doubt" and left alone (NIFRA's CAR near 300% is real). Log any data change in the PHASE2 deviation log.
