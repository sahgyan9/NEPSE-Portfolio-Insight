"""SIP summary: XIRR, row classification, totals. Synthetic data only."""

import os
import sys
from datetime import date

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sip_summary as ss  # noqa: E402


def buy(d, units, price, source=""):
    return {"type": "BUY", "symbol": "NIBLSF", "quantity": units, "price": price, "date": d, "source": source}


def test_xirr_single_year_gain():
    rate = ss.xirr([(date(2024, 1, 1), -1000.0), (date(2025, 1, 1), 1100.0)])
    assert rate == pytest.approx(0.10, abs=0.002)


def test_xirr_loss_is_negative():
    rate = ss.xirr([(date(2024, 1, 1), -1000.0), (date(2025, 1, 1), 900.0)])
    assert rate == pytest.approx(-0.10, abs=0.002)


def test_xirr_weights_later_instalments_less():
    # Second 1,000 was invested for half the time, so the yearly rate is above the simple 5% gain.
    rate = ss.xirr([(date(2024, 1, 1), -1000.0), (date(2024, 7, 1), -1000.0), (date(2025, 1, 1), 2100.0)])
    assert rate > 0.05
    assert rate == pytest.approx(0.0667, abs=0.003)


@pytest.mark.parametrize("flows", [
    [],
    [(date(2024, 1, 1), -1000.0)],
    [(date(2024, 1, 1), -1000.0), (date(2025, 1, 1), -500.0)],     # nothing received
    [(date(2024, 1, 1), -1000.0), (date(2024, 2, 1), 1010.0)],     # span too short
])
def test_xirr_returns_none_when_undefined(flows):
    assert ss.xirr(flows) is None


def test_rows_classified_and_amount_recovered():
    tx = [
        buy("2024-01-07", 296.53, 10.1169, "SIP statement #1 (NAV 10.1, incl. Rs. 5 charge)"),
        buy("2026-05-18", 290, 0, "dividend-reinvestment DREP 2081-82"),
        {"type": "SELL", "symbol": "NIBLSF", "quantity": 100, "price": 11.0, "date": "2026-06-01"},
        buy("2024-01-07", 10, 500, "other") | {"symbol": "NABIL"},
    ]
    rows = ss._rows_for("NIBLSF", tx)
    assert [r["kind"] for r in rows] == ["instalment", "dividend_units", "redemption"]
    assert rows[0]["amount"] == 2999.95  # 296.53 x 10.10 + 5, as on the statement
    assert rows[0]["navPaid"] == 10.1
    assert rows[0]["charge"] == 5.0
    assert rows[1]["amount"] == 0.0 and rows[1]["navPaid"] is None
    assert rows[2]["amount"] == 1100.0


def test_summary_totals_use_demat_balance():
    tx = [
        buy("2024-01-01", 300.5, 9.9834, "(NAV 9.97, incl. Rs. 5 charge)"),
        buy("2025-01-01", 250.4, 11.9808, "(NAV 11.96, incl. Rs. 5 charge)"),
        buy("2025-06-01", 20, 0, "DREP"),
    ]
    fund = ss.summarise_fund("NIBLSF", "Fund", tx, {"quantity": 570}, {"nav": 12.0, "navDate": "01/07/2025"})
    assert fund["totalPaid"] == pytest.approx(300.5 * 9.97 + 5 + 250.4 * 11.96 + 5, abs=0.01)
    assert fund["statementUnits"] == pytest.approx(570.9)
    assert fund["units"] == 570 and fund["dematUnits"] == 570
    assert fund["value"] == 6840.0
    assert fund["gain"] == pytest.approx(6840.0 - fund["totalPaid"], abs=0.01)
    assert fund["gainPct"] == pytest.approx(fund["gain"] / fund["totalPaid"])
    assert fund["navDate"] == "2025-07-01"
    assert fund["instalmentCount"] == 2 and round(fund["usualAmount"]) in (3001, 3000)
    assert fund["dividendUnits"] == 20
    assert fund["lowestNavPaid"] == 9.97 and fund["highestNavPaid"] == 11.96
    assert fund["yearlyReturn"] is not None and fund["yearlyReturn"] > 0
    assert fund["rows"][0]["navChange"] == pytest.approx(12.0 / 9.97 - 1)


def test_summary_without_holding_or_nav():
    tx = [buy("2024-01-01", 300.5, 9.9834)]
    fund = ss.summarise_fund("NIBLSF", "Fund", tx, None, None)
    assert fund["units"] == 300.5 and fund["dematUnits"] is None
    assert fund["value"] is None and fund["gain"] is None and fund["yearlyReturn"] is None


def test_redemption_counts_as_money_received():
    tx = [
        buy("2024-01-01", 1000, 10.0),
        {"type": "SELL", "symbol": "NIBLSF", "quantity": 400, "price": 12.0, "date": "2025-01-01"},
    ]
    fund = ss.summarise_fund("NIBLSF", "Fund", tx, None, {"nav": 12.0, "navDate": "01/01/2026"})
    assert fund["units"] == 600
    assert fund["totalRedeemed"] == 4800.0
    assert fund["gain"] == pytest.approx(600 * 12.0 + 4800.0 - 10000.0)


def test_build_summary_skips_funds_with_no_rows():
    out = ss.build_summary({"holdings": [], "transactions": []}, {}, date(2026, 1, 1))
    assert out == {"asOf": "2026-01-01", "funds": []}


def test_dividend_units_listed_with_declared_percent_and_value():
    tx = [
        buy("2024-01-01", 1000, 10.0),
        buy("2026-05-18", 290, 0, "dividend-reinvestment DREP 2081-82 (units credited, no cash paid)"),
    ]
    declared = [{"fiscalYear": "081-082", "cashPercent": 7.0}, {"fiscalYear": "079-080", "cashPercent": 4.0}]
    fund = ss.summarise_fund("NIBLSF", "Fund", tx, None, {"nav": 10.0, "navDate": "01/06/2026"}, declared=declared)
    assert fund["dividendValue"] == 2900.0
    assert fund["dividends"] == [
        {"date": "2026-05-18", "units": 290, "fiscalYear": "2081/82", "declaredPercent": 7.0, "valueNow": 2900.0}
    ]
    assert all("_fyKey" not in r for r in fund["rows"])


def test_dividend_units_without_fiscal_year_or_nav():
    tx = [buy("2024-01-01", 1000, 10.0), buy("2025-01-01", 20, 0, "DREP")]
    fund = ss.summarise_fund("NIBLSF", "Fund", tx, None, None)
    assert fund["dividends"] == [
        {"date": "2025-01-01", "units": 20, "fiscalYear": None, "declaredPercent": None, "valueNow": None}
    ]
    assert fund["dividendValue"] is None
