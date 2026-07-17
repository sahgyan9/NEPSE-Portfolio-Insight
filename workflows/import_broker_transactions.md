# Workflow: Import Broker Purchase/Sale History from Gmail

## Objective
Reconstruct real buy/sell transaction history (symbol, quantity, effective price, real trade date) from broker bill emails, so `db/portfolio.json`'s `transactions` array reflects when shares were actually acquired — not just today's aggregate quantity. This fixes dividend calculations that were using current holdings (inflated by later purchases) instead of shares actually held on a past book closure date.

## Data Source
Broker: **Dynamic Money Managers Securities Pvt. Ltd.** (Broker No. 44), emailing `accounts@dynamic44.com` to the user's Gmail.
- `PURCHASE BILL NO <bill-no>` — one or more stock line items bought that day.
- `SELL BILL NO <bill-no>` — same table shape, plus `Base Price`/`CGT` (capital gains tax) columns.
- Other emails from the same sender (Ledger, Broker payment notification, Transaction Alert) are not per-trade bills — skip them.

Each bill's HTML body has a `<table>` with one `<tr><td>...</td></tr>` row per line item: `Transaction No, Script (symbol), Qty, Rate, Amt, Comm Rate, Comm Amt, SEBON Comm, [Base Price, CGT — sell only], Eff Rate, Total Amt`. Multi-symbol bills insert a `<th>Subtotal</th>` row (uses `<th>`, not `<td>` — easy to skip) between groups of same-symbol rows. The real trade date is in `Transaction Date: <BS date> (<AD date> AD)` near the bottom of the email, not the bill date at the top (they can differ by a day or two).

**Important — what this data source does NOT cover:** IPO/FPO allotments and mutual fund unit purchases never generate a bill (no brokerage commission on primary issuance), so symbols acquired that way (mutual funds like NBF3/MMF1/KDBY/NMBSBFE/CSBY/NIBLSF, and some IPO-allotted stocks like BHL/CLI/GCIL/HRL/SGHC/SNLI/SONA, and part of SAHAS's holding) will have no transaction rows from this source. That's expected, not a parsing gap — for those, the existing single quantity is already correct since it was never bought in installments.

## Steps
1. **Find all bill emails**: `mcp__claude_ai_Gmail__search_threads` with query `from:accounts@dynamic44.com`, `pageSize: 50` (covers full history in one page as of 2026-07; raise if it ever hits the estimate). Filter to threads whose subject starts with `PURCHASE BILL` or `SELL BILL`.
2. **Fetch full bodies**: `mcp__claude_ai_Gmail__get_message` with `messageFormat: FULL_CONTENT` for each matching message ID (batch in parallel, several per tool-call message).
3. **Parse into transactions**: `tools/parse_broker_bills.py` takes a JSON file of `[{"id","subject","htmlBody"}, ...]` and emits `[{"type","symbol","quantity","price","date","billNo"}, ...]`. Save the fetched emails to a scratch JSON file first (the tool has no direct Gmail access — fetching is always the agent's job via MCP, parsing is the deterministic tool's job).
4. **Reconcile before merging**: sum net quantity (BUY − SELL) per symbol from parsed transactions, compare against `db/portfolio.json` holdings quantities. Expect:
   - Exact match → full purchase history captured.
   - Small gap → very likely bonus shares received from past dividends (check `db/dividend_data.json` bonus % history for that symbol).
   - Large/total gap → likely IPO/FPO/mutual-fund allotment (no bill ever existed); confirm with the user rather than assuming.
5. **Merge into `db/portfolio.json`**: append new transactions, keep existing manually-entered ones that don't correspond to any bill (likely real IPO/allotment entries — don't delete without asking), and prefer bill-derived date/price over any rough manual duplicate of the same event (match on symbol + quantity + approximate price + nearby date).
6. **Re-run and sanity check**: `python -m pytest tools/test_nepse_server.py -q` and spot-check `nepse_server.compute_portfolio_dividends(fy)` for a symbol you know the real historical answer for.

## How the dividend calc uses this
`nepse_server.py`'s `_shares_held_at(transactions, symbol, as_of_date, fallback_qty)` replays BUY/SELL transactions up to a given date to estimate shares held then. `compute_portfolio_dividends` calls this with the dividend's `bookClosureDateAD` instead of using today's total quantity, so buying more after a book closure no longer inflates that historical dividend. If a symbol has zero transaction rows (IPO/mutual-fund-only), it falls back to today's total quantity, which is already correct for those.

For cases where transaction history still doesn't reach far enough back (pre-dates all bill history, or bonus shares were received without a corresponding logged transaction), use the manual override instead of chasing the exact historical quantity: add `"bonusSharesReceived": N` to the entry in `db/manual_dividends.json` for that symbol + fiscal year. This always wins over the computed estimate.

## Conventions & Edge Cases
- Effective Rate (`Eff Rate` column) is the fee-inclusive per-share cost — use this as `price`, not the raw `Rate` column, to match how existing manual transaction entries were recorded.
- Transaction `date` is the AD trade date only (no time) from the bill; existing manually-entered transactions use a full timestamp (when the user logged it, not the trade date) — both formats coexist fine since only the first 10 characters (`YYYY-MM-DD`) are compared.
- SELL bills have two extra columns (`Base Price`, `CGT`) between `SEBON Comm` and `Eff Rate` that PURCHASE bills don't have — the parser regex treats them as optional.
- Re-running this is idempotent in intent but not automatic — there's no dedup key stored yet beyond `billNo`; check for already-imported bill numbers before re-merging if running this again later.
