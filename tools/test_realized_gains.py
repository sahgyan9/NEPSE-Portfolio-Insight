"""Realized gains: cost basis, fees flag, FIFO holding period, fiscal year. Synthetic data only."""

import os
import sys
from datetime import date

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import realized_gains as rg  # noqa: E402


def buy(d, q, price, sym="ABC"):
    return {"type": "BUY", "symbol": sym, "quantity": q, "price": price, "date": d}


def sell(d, q, price, sym="ABC", **extra):
    return {"type": "SELL", "symbol": sym, "quantity": q, "price": price, "date": d, **extra}


def test_weighted_average_cost_and_profit():
    rows = rg.compute_sales([buy("2025-01-01", 10, 100), buy("2025-02-01", 10, 200), sell("2025-03-01 10:00:00", 20, 180)])
    s = rows[0]
    assert s["costPerShare"] == 150
    assert s["profit"] == pytest.approx(600)
    assert s["profitPct"] == pytest.approx(20)
    assert s["costBasis"] == "estimated"
    assert s["fees"] == "not_included"


def test_recorded_cost_wins_over_replay():
    rows = rg.compute_sales([buy("2025-01-01", 10, 100), sell("2025-03-01", 10, 120, costPerShare=110)])
    assert rows[0]["costBasis"] == "recorded"
    assert rows[0]["profit"] == pytest.approx(100)


def test_net_received_from_bill_is_used():
    rows = rg.compute_sales([buy("2025-01-01", 10, 100), sell("2025-03-01", 10, 120, netReceived=1150)])
    assert rows[0]["fees"] == "bill"
    assert rows[0]["profit"] == pytest.approx(150)


def test_bill_no_without_net_received_is_not_included():
    # Broker bill rate is gross market price; without netReceived, fees are not deducted
    rows = rg.compute_sales([buy("2025-01-01", 10, 100), sell("2025-03-01", 10, 120, billNo="KTM-S1")])
    assert rows[0]["fees"] == "not_included"


def test_explicit_fees_included_flag():
    rows = rg.compute_sales([buy("2025-01-01", 10, 100), sell("2025-03-01", 10, 120, fees="included")])
    assert rows[0]["fees"] == "included"


def test_mutual_fund_bonus_counts_at_ten_rupees():
    # KDBY is in SYMBOL_SECTOR as Mutual Fund; bonus face value is Rs 10
    rows = rg.compute_sales([
        buy("2025-01-01", 100, 10, sym="KDBY"),
        buy("2025-02-01", 10, 0, sym="KDBY"),
        sell("2025-03-01", 110, 12, sym="KDBY"),
    ])
    assert rows[0]["costPerShare"] == 10.0  # (100*10 + 10*10) / 110


def test_zero_cost_basis_is_preserved():
    # When costPerShare is explicitly 0, it must be kept as 'recorded' (not fallback to estimated/unknown)
    rows = rg.compute_sales([sell("2025-03-01", 10, 120, costPerShare=0.0)])
    assert rows[0]["costBasis"] == "recorded"
    assert rows[0]["costPerShare"] == 0.0
    assert rows[0]["profit"] == pytest.approx(1200)


def test_float_precision_balance_deduction():
    # Deducting small fractional share increments without IEEE 754 precision residue issues
    rows = rg.compute_sales([
        buy("2025-01-01", 0.3, 100),
        sell("2025-02-01", 0.1, 120),
        sell("2025-02-02", 0.2, 120),
    ])
    assert len(rows) == 2
    assert rows[1]["costBasis"] == "estimated"
    assert rows[1]["costPerShare"] == 100.0


def test_bonus_shares_count_at_face_value():
    rows = rg.compute_sales([buy("2025-01-01", 10, 300), buy("2025-02-01", 10, 0), sell("2025-03-01", 20, 250)])
    assert rows[0]["costPerShare"] == 200  # (10*300 + 10*100) / 20


def test_partial_sell_keeps_average_for_later_sale():
    rows = rg.compute_sales([
        buy("2025-01-01", 10, 100), sell("2025-02-01", 5, 120),
        buy("2025-03-01", 5, 160), sell("2025-04-01", 10, 150),
    ])
    assert rows[1]["costPerShare"] == 130  # (5*100 + 5*160) / 10


def test_missing_buy_history_is_unknown_not_zero():
    rows = rg.compute_sales([buy("2025-01-01", 5, 100), sell("2025-02-01", 10, 120)])
    assert rows[0]["costBasis"] == "unknown"
    assert rows[0]["profit"] is None


def test_fifo_short_term_quantity():
    rows = rg.compute_sales([buy("2024-01-01", 10, 100), buy("2025-06-01", 10, 100), sell("2025-09-01", 15, 120)])
    s = rows[0]
    assert s["heldFrom"] == "2024-01-01"
    assert s["heldTo"] == "2025-06-01"
    assert s["shortTermQty"] == 5


def test_fiscal_year_boundary():
    # 1 Shrawan 2083 BS is 17 July 2026 AD.
    assert rg.fiscal_year(date(2026, 7, 16)) == "2082/83"
    assert rg.fiscal_year(date(2026, 7, 17)) == "2083/84"


def test_summary_splits_current_year_and_skips_unknown():
    txs = [
        buy("2024-01-01", 10, 100), sell("2024-03-01", 10, 150),
        buy("2026-08-01", 10, 100), sell("2026-09-01", 10, 90),
        sell("2026-10-01", 5, 100, sym="XYZ"),
    ]
    out = rg.summarize(txs, today=date(2026, 11, 17))
    assert out["currentFiscalYear"] == "2083/84"
    assert out["thisYear"]["profit"] == pytest.approx(-100)
    assert out["thisYear"]["uncounted"] == 1
    assert out["allTime"]["profit"] == pytest.approx(400)
    assert out["sales"][0]["symbol"] == "XYZ"  # newest first
