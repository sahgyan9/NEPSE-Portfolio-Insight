"""Tests for tools/fix_quarterly_percents.py."""

import copy
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fix_quarterly_percents as F  # noqa: E402


def q(fy, n, raw, yoy=None):
    return {"fy": fy, "quarter": n, "raw": raw, "yoy": yoy or {}}


def bank_series(rows):
    """rows: list of (fy, quarter, CAR, NPL, Base Rate)."""
    return [q(fy, n, {"CAR": car, "NPL": npl, "Base Rate": base}) for fy, n, car, npl, base in rows]


def test_whole_row_scaled_is_divided():
    qs = bank_series([("2081-82", 1, 12.0, 4.0, 6.0), ("2081-82", 2, 12.2, 4.1, 6.1),
                      ("2081-82", 3, 1112.0, 981.0, 555.0), ("2081-82", 4, 12.5, 4.3, 5.9)])
    changes = F.fix_quarters(qs)
    assert qs[2]["raw"] == {"CAR": 11.12, "NPL": 9.81, "Base Rate": 5.55}
    assert qs[2][F.MARK] == ["Base Rate", "CAR", "NPL"]
    assert len(changes) == 1


def test_single_field_scaled_is_divided_and_rest_untouched():
    qs = bank_series([("2081-82", 1, 12.0, 4.0, 6.0), ("2081-82", 2, 1496.0, 4.1, 6.1),
                      ("2081-82", 3, 12.4, 4.2, 6.0)])
    F.fix_quarters(qs)
    assert qs[1]["raw"] == {"CAR": 14.96, "NPL": 4.1, "Base Rate": 6.1}


def test_persistently_high_real_value_is_left_alone():
    # A new infrastructure bank with CAR near 300% for several quarters.
    qs = bank_series([("2077-78", i, v, 0.0, 9.0) for i, v in enumerate([324.0, 344.0, 249.0, 296.0], 1)])
    before = copy.deepcopy(qs)
    doubtful = []
    assert F.fix_quarters(qs, doubtful) == []
    assert qs == before
    assert {d["field"] for d in doubtful} == {"CAR"}


def test_impossible_npl_not_explained_by_x100_is_removed():
    qs = bank_series([("2081-82", 1, 13.0, 5.8, 9.0), ("2081-82", 2, 13.1, 110.61, 9.1),
                      ("2081-82", 3, 13.2, 6.0, 9.0)])
    changes = F.fix_quarters(qs)
    assert "NPL" not in qs[1]["raw"]
    assert qs[1][F.INVALID_MARK] == {"NPL": 110.61}
    assert changes[0]["removed"] == {"NPL": 110.61}


def test_unconfirmed_candidate_divided_when_row_is_confirmed():
    qs = bank_series([("2079-80", 1, 12.0, 18.0, 15.0), ("2079-80", 2, 12.1, 17.5, 15.2),
                      ("2079-80", 3, 1385.0, 481.0, 1701.0), ("2079-80", 4, 12.3, 18.2, 15.1)])
    F.fix_quarters(qs)
    assert qs[2]["raw"]["NPL"] == 4.81  # 4.81 is far from 18, but the row is shown to be x100


def test_second_run_changes_nothing():
    qs = bank_series([("2081-82", 1, 12.0, 4.0, 6.0), ("2081-82", 2, 1200.0, 410.0, 600.0),
                      ("2081-82", 3, 12.5, 4.3, 5.9)])
    F.fix_quarters(qs)
    after = copy.deepcopy(qs)
    assert F.fix_quarters(qs) == []
    assert qs == after


def test_yoy_recomputed_in_changed_and_following_year_record():
    qs = [q("2081-82", 1, {"CAR": 12.0}),
          q("2081-82", 2, {"CAR": 12.0}),
          q("2082-83", 1, {"CAR": 1300.0}, {"CAR": 10733.33}),
          q("2082-83", 2, {"CAR": 12.5}),
          q("2083-84", 1, {"CAR": 13.0}, {"CAR": -99.0})]
    F.fix_quarters(qs)
    assert qs[2]["raw"]["CAR"] == 13.0
    assert qs[2]["yoy"]["CAR"] == round((13.0 - 12.0) / 12.0 * 100, 2)
    assert qs[4]["yoy"]["CAR"] == 0.0


def test_run_report_only_writes_nothing(tmp_path):
    qdir, tdir = tmp_path / "q", tmp_path / "t"
    qdir.mkdir()
    doc = {"symbol": "X", "quarters": bank_series([("2081-82", 1, 12.0, 4.0, 6.0),
                                                   ("2081-82", 2, 1200.0, 410.0, 600.0)])}
    (qdir / "X.json").write_text(json.dumps(doc), encoding="utf-8")
    rep = F.run(apply=False, quarterly_dir=str(qdir), tmp_dir=str(tdir))
    assert rep["records_changed"] == 1
    assert json.loads((qdir / "X.json").read_text(encoding="utf-8")) == doc
    rep = F.run(apply=True, quarterly_dir=str(qdir), tmp_dir=str(tdir))
    assert json.loads((qdir / "X.json").read_text(encoding="utf-8"))["quarters"][1]["raw"]["CAR"] == 12.0
    assert os.path.isdir(rep["backup_dir"])
