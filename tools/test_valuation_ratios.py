"""P/E and P/B in db/fundamentals.json must be derived from the stored EPS / book value."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import portfolio_common as pc  # noqa: E402


def test_valuation_ratios_basic():
    assert pc.valuation_ratios(34.54, 233.9, 549.0) == (15.89, 2.35)


def test_loss_gives_negative_pe():
    pe, _ = pc.valuation_ratios(-21.5, 115.58, 507.5)
    assert pe == -23.6


def test_zero_eps_and_bad_inputs():
    assert pc.valuation_ratios(0.0, 100.0, 200.0) == (None, 2.0)
    assert pc.valuation_ratios(10.0, 0.0, 200.0) == (20.0, None)
    assert pc.valuation_ratios(10.0, 100.0, None) == (None, None)
    assert pc.valuation_ratios(10.0, 100.0, 0) == (None, None)


def test_recompute_replaces_source_pe(monkeypatch):
    # NIMB as scraped: EPS from the new Q1 report, P/E still the site's old figure
    monkeypatch.setattr(pc, "latest_close", lambda s: (205.1, "2026-11-06"))
    rec = {"eps": 0.53, "bookValue": 200.88, "peRatio": 14.81, "pbRatio": 1.02}
    pc.recompute_ratios("NIMB", rec)
    assert rec["peRatio"] == round(205.1 / 0.53, 2)
    assert rec["pbRatio"] == 1.02
    assert rec["ratioPrice"] == 205.1 and rec["ratioPriceDate"] == "2026-11-06"


def test_recompute_falls_back_to_ltp(monkeypatch):
    monkeypatch.setattr(pc, "latest_close", lambda s: (None, None))
    rec = {"eps": 10.0, "bookValue": 100.0, "ltp": 300.0, "capturedAt": "2026-11-07"}
    pc.recompute_ratios("X", rec)
    assert rec["peRatio"] == 30.0 and rec["ratioPriceDate"] == "2026-11-07"


def test_recompute_without_price_or_eps_leaves_record(monkeypatch):
    monkeypatch.setattr(pc, "latest_close", lambda s: (None, None))
    rec = {"eps": 10.0, "peRatio": 12.0}
    pc.recompute_ratios("X", rec)
    assert rec == {"eps": 10.0, "peRatio": 12.0}

    monkeypatch.setattr(pc, "latest_close", lambda s: (100.0, "2026-11-06"))
    rec = {"peRatio": 12.0, "bookValue": 50.0}  # no EPS: keep the source P/E
    pc.recompute_ratios("X", rec)
    assert rec["peRatio"] == 12.0 and rec["pbRatio"] == 2.0
