# Workflow: Sector Leaders forward test (record and evaluate)

## Objective
At each quarterly rebalance date, record the frozen Sector Leaders picks before their returns
are known, and later evaluate completed periods. The rules are fixed in
`docs/research/FORWARD_TEST_PROTOCOL.md`; this workflow is only the routine for following them.

## When
Rebalance dates (quarter end + 60 days): 2026-12-16, 2027-03-15, 2027-06-12, 2027-09-14,
2027-12-15. Later ones: `.venv/Scripts/python.exe tools/forward_test_sector_leaders.py calendar`.

Run the routine 2 to 7 days after each date. The price data must already contain the trading
session after the rebalance date. Records made more than 14 days late are flagged `late`; the
tool refuses on or after the next rebalance date.

## Tools
- `.venv/Scripts/python.exe`: the system Python has a different `nepse` package.
- `tools/fetch_price_history.py`: daily prices into `db/prices/`.
- `tools/harvest_all_quarterly.py`: quarterly reports into `db/quarterly/` (also fills the
  `computed` fields the scorer reads: EPS TTM, BVPS, Graham number).
- `tools/forward_test_sector_leaders.py`: `calendar`, `record`, `evaluate`.

## Steps
1. Start from an up-to-date research branch with a clean working tree.
2. Refresh prices: `.venv/Scripts/python.exe tools/fetch_price_history.py --force`.
   Check `db/prices/_manifest.json`: the last date should be after the rebalance date for
   nearly every symbol.
3. Refresh quarterly reports: `.venv/Scripts/python.exe tools/harvest_all_quarterly.py --all --force`.
   Never change `tools/score_sector_leaders.py`, `quarterly_db.py` or `FROZEN`.
4. Run the tests: `.venv/Scripts/python.exe -m pytest tools/ -q`. All must pass.
5. Commit the refreshed data (`chore(data): refresh prices and quarterly reports for <date>`),
   so the record's git commit points at the exact inputs.
6. Record: `.venv/Scripts/python.exe tools/forward_test_sector_leaders.py record --date <date>`.
   - `REFUSED: price data ends ...`: prices do not reach the entry session yet. Wait a day and
     repeat step 2.
   - `REFUSED: only N symbols ...`: partial price refresh. Repeat step 2.
   - `Frozen algorithm changed`: stop and ask the user; this needs a deviation-log entry.
   - Check the printed line "X of Y companies have <quarter>". If it is far below the Phase 2
     level (about 270 of 314), quarterly data may be stale: a record cannot be redone, so fix
     the refresh before recording.
7. Commit the record on its own (`feat(research): forward test record <date>`) and push it the
   same day. The push time on the remote is a timestamp independent of this machine's clock.
8. Evaluate: `.venv/Scripts/python.exe tools/forward_test_sector_leaders.py evaluate`.
   Output: `.tmp/forward_test_summary.json`. A period is evaluated once the next rebalance
   date's entry session is in the price data; until then it is listed as pending.
9. If anything departed from the protocol (late record, missed date, data problem), add an
   entry to the deviation log in `docs/research/FORWARD_TEST_PROTOCOL.md`.

## Edge cases
- A rebalance date on a non-trading day: the signal session is the last session before it.
- Never edit or delete a record. Corrections go in the deviation log.
- `--out-dir` is for validation runs only (for example a past date); it never counts as a record.
- The first report is due after 4 complete periods (after the entry session following 2027-12-15).
