"""Tests for tools/fix_quarterly_units.py and the ratio test in tools/harvest_all_quarterly.py."""

import copy
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fix_quarterly_units as F  # noqa: E402
from harvest_all_quarterly import is_ratio_or_per_share  # noqa: E402


def quarter(fy, q, raw, computed=None, yoy=None):
    return {"symbol": "TEST", "fy": fy, "quarter": q, "raw": raw, "computed": computed or {}, "yoy": yoy or {}}


BANK = {  # commercial bank: operating lines in thousands, the rest in rupees
    "Total Assets": 734_731_624_000.0,
    "Net Interest Income": 17_009_288_000.0,
    "Total Operating Income": 22_334_361.0,
    "Operating Profit": 11_564_526.0,
    "Net Profit": 7_905_796_000.0,
    "CAR": 12.37,
}
HYDRO_THOUSANDS = {
    "Total Assets": 12_186_987_610.0,
    "Revenue": 1_167_632_060.0,
    "Gross Profit": 912_434_690.0,
    "Operating Profit": 750_550.57,
    "Net Profit": 720_059_190.0,
}
HYDRO_RUPEES = {
    "Total Assets": 2_000_000_000.0,
    "Revenue": 59_822_140.0,
    "Operating Profit": 34_154_570.0,
    "Net Profit": 15_453_230.0,
}


# ---------------------------------------------------------------- harvest ratio test

def test_amount_fields_are_not_ratios():
    for key in ("Operating Profit", "Total Operating Income", "Total Operating Profit", "Revenue from Operation",
                "Revenue from Operations", "Total Expenses And Provisions", "Total Expenses", "Management Expenses",
                "Net Profit", "Total Assets", "Paid Up Capital", "Deposits from Customers", "Interest Income"):
        assert not is_ratio_or_per_share(key), key


def test_ratio_and_per_share_fields_are_recognised():
    for key in ("EPS Reported", "EPS(Rs.)", "Book Value Reported", "Book Value(Rs.)", "ROE Reported", "ROE", "ROA TTM",
                "CAR", "NPL", "Cost of funds", "CD ratio", "Credit To Deposit Ratio", "Base Rate",
                "Interest Spread Rate", "PE Ratio", "PB Ratio", "PS Ratio", "Net Margin TTM", "Solvency Ratio",
                "Dividend Yield", "Growth %"):
        assert is_ratio_or_per_share(key), key


# ---------------------------------------------------------------- unit decision

def test_bank_record_is_in_thousands():
    assert F.stored_in_thousands(BANK) is True
    assert F.fields_to_scale(BANK) == ["Total Operating Income", "Operating Profit"]


def test_hydro_record_in_thousands_and_in_rupees():
    assert F.stored_in_thousands(HYDRO_THOUSANDS) is True
    assert F.stored_in_thousands(HYDRO_RUPEES) is False
    assert F.fields_to_scale(HYDRO_RUPEES) == []


def test_income_below_profit_wins_over_a_wrong_assets_figure():
    raw = dict(BANK, **{"Total Assets": 138_604_950.0, "Total Operating Income": 5_432_857.0,
                        "Operating Profit": 3_509_204.0, "Net Profit": 2_447_122_000.0})
    assert F.stored_in_thousands(raw) is True
    assert set(F.fields_to_scale(raw)) == {"Total Operating Income", "Operating Profit"}


def test_record_mixing_both_units_converts_only_the_small_line():
    raw = {"Total Assets": 74_824_237_350.0, "Total Operating Income": 749_896.51,
           "Operating Profit": 352_079_452.0, "Net Profit": 239_363_860.0}
    assert F.fields_to_scale(raw) == ["Total Operating Income"]


def test_insurer_without_assets_uses_total_revenue():
    raw = {"Total Revenue": 8_607_141_440.0, "Net Premium": 6_000_000_000.0,
           "Total Expenses And Provisions": 7_916_034.78, "Management Expenses": 400_000.0, "Net Profit": 209_844_380.0}
    assert set(F.fields_to_scale(raw)) == {"Total Expenses And Provisions", "Management Expenses"}
    in_rupees = dict(raw, **{"Total Expenses And Provisions": 7_916_034_780.0, "Management Expenses": 400_000_000.0})
    assert F.fields_to_scale(in_rupees) == []


def test_record_without_any_anchor_is_undecided():
    assert F.stored_in_thousands({"Operating Profit": 5000.0}) is None
    assert F.stored_in_thousands({"Net Profit": 5000.0}) is None


# ---------------------------------------------------------------- document fix

def test_fix_converts_amounts_and_leaves_everything_else():
    doc = {"symbol": "TEST", "quarters": [quarter("2082-83", 4, dict(BANK))]}
    changes = F.fix_document(doc)
    raw = doc["quarters"][0]["raw"]
    assert raw["Operating Profit"] == 11_564_526_000.0
    assert raw["Total Operating Income"] == 22_334_361_000.0
    for key in ("Total Assets", "Net Interest Income", "Net Profit", "CAR"):
        assert raw[key] == BANK[key]
    assert len(changes) == 1
    assert doc["quarters"][0][F.MARKER]["fields"] == ["Operating Profit", "Total Operating Income"]


def test_fix_is_safe_to_run_twice_even_for_small_genuine_amounts():
    # First-quarter income so small that it still looks like "thousands" after conversion.
    raw = {"Total Assets": 3_048_777_770.0, "Total Operating Income": 6304.75, "Net Profit": -12_468_350.0}
    doc = {"symbol": "TEST", "quarters": [quarter("2081-82", 1, raw)]}
    assert F.fix_document(doc)
    once = copy.deepcopy(doc)
    assert F.fix_document(doc) == []
    assert doc == once
    assert doc["quarters"][0]["raw"]["Total Operating Income"] == 6_304_750.0


def test_revenue_copy_is_corrected_only_when_it_came_from_an_affected_field():
    hotel = {"Total Assets": 3_839_072_930.0, "Revenue from Operation": 2_249_778.82,
             "Operating Profit": 680_837.14, "Net Profit": 550_732_620.0}
    doc = {"symbol": "TEST", "quarters": [
        quarter("2082-83", 3, dict(hotel), computed={"revenue_ttm": 2_249_778.82, "net_profit_ttm": 550_732_620.0}),
        quarter("2082-83", 4, dict(HYDRO_THOUSANDS), computed={"revenue_ttm": 1_167_632_060.0}),
    ]}
    F.fix_document(doc)
    assert doc["quarters"][0]["computed"]["revenue_ttm"] == 2_249_778_820.0
    assert doc["quarters"][0]["computed"]["net_profit_ttm"] == 550_732_620.0
    assert doc["quarters"][1]["computed"]["revenue_ttm"] == 1_167_632_060.0  # came from "Revenue", untouched


def test_undecided_record_follows_the_same_quarter_of_the_next_year():
    old = {"Total Revenue": None, "Total Expenses And Provisions": 5_000_000.0}        # no anchor at all
    new = {"Total Revenue": 9_000_000_000.0, "Total Expenses And Provisions": 8_000_000.0, "Net Profit": 300_000_000.0}
    doc = {"symbol": "TEST", "quarters": [quarter("2079-80", 2, dict(old)), quarter("2080-81", 2, dict(new))]}
    F.fix_document(doc)
    assert doc["quarters"][0]["raw"]["Total Expenses And Provisions"] == 5_000_000_000.0
    assert doc["quarters"][1]["raw"]["Total Expenses And Provisions"] == 8_000_000_000.0


def test_undecided_record_of_a_different_size_is_left_and_reported():
    old = {"Total Expenses And Provisions": 169.0}
    new = {"Total Revenue": 9_000_000_000.0, "Total Expenses And Provisions": 8_000_000.0, "Net Profit": 300_000_000.0}
    doc = {"symbol": "TEST", "quarters": [quarter("2079-80", 2, dict(old)), quarter("2080-81", 2, dict(new))]}
    unresolved = []
    F.fix_document(doc, unresolved)
    assert doc["quarters"][0]["raw"]["Total Expenses And Provisions"] == 169.0
    assert any(u["fy"] == "2079-80" and u["reason"].startswith("undecided") for u in unresolved)


def test_yoy_kept_when_both_years_converted_and_recomputed_when_one_was():
    prev_thousands = dict(HYDRO_THOUSANDS, **{"Operating Profit": 700_000.0})
    doc = {"symbol": "TEST", "quarters": [
        quarter("2081-82", 4, prev_thousands),
        quarter("2082-83", 4, dict(HYDRO_THOUSANDS), yoy={"Operating Profit": 7.22}),
    ]}
    F.fix_document(doc)
    assert doc["quarters"][1]["yoy"]["Operating Profit"] == 7.22

    prev_rupees = dict(HYDRO_THOUSANDS, **{"Operating Profit": 700_000_000.0})
    stored = F._yoy(750_550.57, 700_000_000.0)  # what the harvest tool computed from mixed units: about -99.9%
    doc = {"symbol": "TEST", "quarters": [
        quarter("2081-82", 4, prev_rupees),
        quarter("2082-83", 4, dict(HYDRO_THOUSANDS), yoy={"Operating Profit": stored, "Net Profit": 5.0}),
    ]}
    F.fix_document(doc)
    assert doc["quarters"][1]["yoy"]["Operating Profit"] == 7.22
    assert doc["quarters"][1]["yoy"]["Net Profit"] == 5.0


def test_yoy_from_the_source_is_not_touched():
    prev_rupees = dict(HYDRO_THOUSANDS, **{"Operating Profit": 700_000_000.0})
    doc = {"symbol": "TEST", "quarters": [
        quarter("2081-82", 4, prev_rupees),
        quarter("2082-83", 4, dict(HYDRO_THOUSANDS), yoy={"Operating Profit": -6.35}),  # not what the pair gives
    ]}
    F.fix_document(doc)
    assert doc["quarters"][1]["yoy"]["Operating Profit"] == -6.35


def test_stored_derived_ratio_is_recomputed_and_missing_one_is_not_added():
    doc = {"symbol": "TEST", "quarters": [
        quarter("2082-83", 4, dict(HYDRO_THOUSANDS), computed={"operating_profit_margin": 0.06}),
        quarter("2081-82", 4, dict(HYDRO_THOUSANDS)),
    ]}
    F.fix_document(doc)
    assert doc["quarters"][0]["computed"]["operating_profit_margin"] == round(750_550_570.0 / 1_167_632_060.0 * 100, 2)
    assert "operating_profit_margin" not in doc["quarters"][1]["computed"]


# ---------------------------------------------------------------- run()

def test_run_reports_without_writing_then_applies_with_backup(tmp_path):
    qdir, tdir = tmp_path / "quarterly", tmp_path / "tmp"
    qdir.mkdir()
    doc = {"symbol": "TEST", "quarters": [quarter("2082-83", 4, dict(BANK))]}
    path = qdir / "TEST.json"
    path.write_text(json.dumps(doc), encoding="utf-8")
    (qdir / "OK.json").write_text(json.dumps({"symbol": "OK", "quarters": [quarter("2082-83", 4, dict(HYDRO_RUPEES))]}),
                                  encoding="utf-8")

    report = F.run(apply=False, quarterly_dir=str(qdir), tmp_dir=str(tdir))
    assert report["files_changed"] == 1 and report["records_changed"] == 1
    assert json.loads(path.read_text(encoding="utf-8")) == doc

    report = F.run(apply=True, quarterly_dir=str(qdir), tmp_dir=str(tdir))
    fixed = json.loads(path.read_text(encoding="utf-8"))
    assert fixed["quarters"][0]["raw"]["Operating Profit"] == 11_564_526_000.0
    assert json.loads((qdir / "OK.json").read_text(encoding="utf-8"))["quarters"][0]["raw"] == HYDRO_RUPEES
    backup = os.path.join(report["backup_dir"], "TEST.json")
    assert json.loads(open(backup, encoding="utf-8").read()) == doc

    assert F.run(apply=True, quarterly_dir=str(qdir), tmp_dir=str(tdir))["files_changed"] == 0
