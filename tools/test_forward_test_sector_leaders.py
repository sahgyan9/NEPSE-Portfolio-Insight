"""Tests for tools/forward_test_sector_leaders.py: calendar, append-only records, stale-price refusal.

Every test writes only under pytest's tmp_path. The autouse fixture also points the live record
folder and the summary path at tmp_path, so a mistake cannot write into the real db/ or .tmp/.
"""
import hashlib
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone

import pytest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools import backtest_sector_leaders as BT
from tools import forward_test_sector_leaders as FWD

REAL_FORWARD_DIR = FWD.FORWARD_DIR
NOW = datetime(2026, 12, 20, 9, 0, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def isolate_outputs(tmp_path, monkeypatch):
    monkeypatch.setattr(FWD, "FORWARD_DIR", str(tmp_path / "live_records"))
    monkeypatch.setattr(FWD, "SUMMARY_PATH", str(tmp_path / "summary.json"))
    before = sorted(os.listdir(REAL_FORWARD_DIR)) if os.path.isdir(REAL_FORWARD_DIR) else None
    yield
    after = sorted(os.listdir(REAL_FORWARD_DIR)) if os.path.isdir(REAL_FORWARD_DIR) else None
    assert before == after, "a test wrote into the real db/research/forward_test"


# ---------------------------------------------------------------- fixtures: tiny dataset

COMPANIES = {  # symbol -> (eps_ttm, daily drift of the adjusted close)
    "HYA": (30.0, 0.004), "HYB": (20.0, 0.002), "HYC": (10.0, 0.000), "HYD": (5.0, -0.002),
}


def _quarter(fy, q, eps):
    return {"fy": fy, "quarter": q,
            "computed": {"eps_ttm": eps, "bvps": 150.0, "roe_ttm": eps / 1.5, "net_profit_ttm": eps,
                         "revenue_ttm": eps * 5},
            "raw": {"Total Assets": 1000.0, "Total Equity": 300.0, "Borrowings": 100.0},
            "yoy": {}}


def write_dataset(root, price_end: date, price_start=date(2026, 11, 1), skip_on=None):
    """Writes quarterly/, prices/ and dividends.json under root. Returns the three paths.
    skip_on: a date on which only one symbol has a row (simulates a partial price refresh)."""
    qdir, pdir = root / "quarterly", root / "prices"
    qdir.mkdir(parents=True, exist_ok=True)
    pdir.mkdir(parents=True, exist_ok=True)
    for i, (sym, (eps, drift)) in enumerate(COMPANIES.items()):
        (qdir / f"{sym}.json").write_text(json.dumps({
            "symbol": sym, "company_name": f"{sym} Hydro Ltd", "sector": "Hydro Power",
            "quarters": [_quarter("2082-83", 4, eps * 0.9), _quarter("2083-84", 1, eps)]}),
            encoding="utf-8")
        rows, d, px = [], price_start, 100.0
        while d <= price_end:
            if not (skip_on and d == skip_on and i > 0):
                rows.append([d.isoformat(), px, px, px, px, 10_000.0])
            px *= 1 + drift
            d += timedelta(days=1)
        (pdir / f"{sym}.json").write_text(json.dumps({
            "symbol": sym, "adjusted": {"rows": rows}, "raw": {"rows": rows}}), encoding="utf-8")
    div = root / "dividends.json"
    div.write_text("{}", encoding="utf-8")
    return str(qdir), str(pdir), str(div)


def record_into(tmp_path, out_dir, rebalance=date(2026, 12, 16), now=NOW, price_end=date(2026, 12, 20), **kw):
    q, p, d = write_dataset(tmp_path / "data", price_end, **kw)
    return FWD.record(rebalance, str(out_dir), quarterly_dir=q, prices_dir=p, dividends_path=d, now=now)


def sha(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


# ---------------------------------------------------------------- calendar

def test_forward_calendar_dates():
    got = [(fy, q, d.isoformat()) for fy, q, d in FWD.forward_calendar(5)]
    assert got == [("2083-84", 1, "2026-12-16"), ("2083-84", 2, "2027-03-15"),
                   ("2083-84", 3, "2027-06-12"), ("2083-84", 4, "2027-09-14"),
                   ("2084-85", 1, "2027-12-15")]
    assert FWD.FIRST_FORWARD_DATE == date(2026, 12, 16)


def test_fiscal_quarter_lookup_and_next_quarter():
    assert FWD.fiscal_quarter_for(date(2026, 12, 16)) == ("2083-84", 1)
    assert FWD.fiscal_quarter_for(date(2026, 6, 12)) == ("2082-83", 3)
    assert FWD.fiscal_quarter_for(date(2026, 12, 15)) is None
    assert FWD.next_quarter("2083-84", 4) == ("2084-85", 1)
    assert FWD.next_quarter("2083-84", 2) == ("2083-84", 3)


def test_backtest_calendar_unchanged_by_refactor():
    dates = [d.isoformat() for d in BT.rebalance_dates()]
    assert len(dates) == 16 and dates[0] == "2022-12-16" and dates[-1] == "2026-09-14"


# ---------------------------------------------------------------- record

def test_record_writes_expected_fields(tmp_path):
    path = record_into(tmp_path, tmp_path / "out")
    doc = json.loads(open(path, encoding="utf-8").read())
    assert os.path.basename(path) == "2026-12-16.json"
    assert doc["mode"] == "validation" and doc["fiscal_year"] == "2083-84" and doc["quarter"] == 1
    assert doc["signal_session"] == "2026-12-16" and doc["entry_session"] == "2026-12-17"
    assert doc["next_rebalance"] == "2027-03-15"
    assert doc["frozen_hashes"] == BT.FROZEN
    assert doc["created_at"] == "2026-12-20T09:00:00+00:00" and doc["late"] is False
    assert doc["counts"] == {"universe": 4, "eligible": 4, "excluded": 0, "holdings": 3}
    assert len(doc["eligible"]) == 4 and all("score" in e for e in doc["eligible"])
    assert [h["sector_rank"] for h in doc["holdings"]] == [1, 2, 3]
    assert doc["data_coverage"]["universe_with_latest_quarter"] == 4
    assert len(doc["data_fingerprint"]["combined"]) == 64


def test_record_refuses_to_overwrite(tmp_path):
    path = record_into(tmp_path, tmp_path / "out")
    before = sha(path)
    with pytest.raises(FWD.Refused, match="append-only"):
        record_into(tmp_path, tmp_path / "out")
    assert sha(path) == before


def test_record_refuses_when_prices_do_not_reach_entry_session(tmp_path):
    # Data ends on the rebalance date itself: the entry session is not known yet.
    with pytest.raises(FWD.Refused, match="entry session"):
        record_into(tmp_path, tmp_path / "out", price_end=date(2026, 12, 16))
    # Data ends before the rebalance date.
    with pytest.raises(FWD.Refused, match="price data ends 2026-12-10"):
        record_into(tmp_path, tmp_path / "out2", price_end=date(2026, 12, 10))
    assert not os.path.exists(tmp_path / "out" / "2026-12-16.json")
    assert not os.path.exists(tmp_path / "out2" / "2026-12-16.json")


def test_record_refuses_partial_price_refresh(tmp_path):
    # Only 1 of 4 symbols has a close on the signal session.
    with pytest.raises(FWD.Refused, match="partial"):
        record_into(tmp_path, tmp_path / "out", skip_on=date(2026, 12, 16))


def test_record_refuses_non_calendar_date(tmp_path):
    with pytest.raises(FWD.Refused, match="not a rebalance date"):
        record_into(tmp_path, tmp_path / "out", rebalance=date(2026, 12, 15))


def test_live_folder_rejects_past_and_too_late_dates(tmp_path):
    live = FWD.FORWARD_DIR                       # tmp path, set by the autouse fixture
    with pytest.raises(FWD.Refused, match="before the first forward date"):
        record_into(tmp_path, live, rebalance=date(2026, 6, 12))
    with pytest.raises(FWD.Refused, match="too late"):
        record_into(tmp_path, live, now=datetime(2027, 3, 15, tzinfo=timezone.utc))
    path = record_into(tmp_path, live)
    assert json.loads(open(path, encoding="utf-8").read())["mode"] == "live"


def test_late_record_is_flagged(tmp_path):
    path = record_into(tmp_path, tmp_path / "out", now=datetime(2027, 1, 5, tzinfo=timezone.utc),
                       price_end=date(2027, 1, 4))
    assert json.loads(open(path, encoding="utf-8").read())["late"] is True


# ---------------------------------------------------------------- evaluate

def test_evaluate_matches_backtest_period_code(tmp_path):
    out = tmp_path / "out"
    path = record_into(tmp_path, out)
    rec = json.loads(open(path, encoding="utf-8").read())

    _, pdir, _ = write_dataset(tmp_path / "later", price_end=date(2027, 3, 20))
    prices = BT.Prices.load(None, pdir)
    summary = FWD.evaluate(str(out), str(tmp_path / "s.json"), prices=prices)
    assert summary["evaluated"] == 1 and summary["pending"] == []
    p = summary["periods"][0]
    assert p["entry"] == "2026-12-17" and p["exit"] == "2027-03-16"

    expected, _ = BT.evaluate_period(rec["universe"], {e["symbol"]: (e["sector"], e["score"]) for e in rec["eligible"]},
                                     [h["symbol"] for h in rec["holdings"]], "2026-12-17", "2027-03-16", prices, {})
    for k, v in expected.items():
        assert p[k] == v
    assert p["cost"] == pytest.approx(0.005)       # first forward period starts from cash
    assert os.path.exists(tmp_path / "s.json")


def test_evaluate_leaves_incomplete_period_pending(tmp_path):
    out = tmp_path / "out"
    record_into(tmp_path, out)
    _, pdir, _ = write_dataset(tmp_path / "later", price_end=date(2027, 2, 1))
    summary = FWD.evaluate(str(out), str(tmp_path / "s.json"), prices=BT.Prices.load(None, pdir))
    assert summary["evaluated"] == 0 and summary["pending"] == ["2026-12-16"] and summary["summary"] is None
