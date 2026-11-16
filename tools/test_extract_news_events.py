"""Tests for tools/extract_news_events.py.

Run:  .venv/Scripts/python.exe -m pytest tools/test_extract_news_events.py -q

Headlines are real items from db/news.json. Body snippets are trimmed copies of
ShareSansar article text saved during development, so no test touches the network.
"""
import os
import sys
from datetime import date

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import extract_news_events as x  # noqa: E402
from scrape_sharesansar_news import normalize_date  # noqa: E402

# ---------------------------------------------------------------------------
# classify(): real headlines -> event type
# ---------------------------------------------------------------------------

CLASSIFY_CASES = [
    ("Chhimek Laghubitta Sanstha Proposes 25% Dividend for FY 2082/83", "dividend_proposed"),
    ("Sahas Urja Limited Declares 21% Bonus Shares and 1.1053% Cash Dividend; Plans 100% Right Shares Issue", "dividend_proposed"),
    ("Mid Solu Hydropower Company Proposes 15.789% Dividend for Fiscal Year 2082/83; How Much in Bonus Shares and Cash?", "dividend_proposed"),
    ("Himalayan 80-20 Declares 15% Cash Dividend for FY 2082/83", "dividend_proposed"),
    ("Nabil Mutual Funds Declare Cash Dividends: 3.5% for NBF2 and 2.5% for NBF3; When Is the Book Closure Date?", "dividend_proposed"),
    ("Nabil bank Limited Approves  15.80% Dividend at 42nd AGM", "dividend_approved"),
    ("NIC Asia Capital Approves 50% Cash Dividend at 10th AGM", "dividend_approved"),
    ("Nabil Bank Limited Unveils Book Closure Date for its 15.80% Dividend; Calls AGM on Ashoj 22", "book_closure"),
    ("Sarvottam Paints Industries Limited Unveils Book Closure Date for its 10% Dividend; Calls AGM on Ashwin 25", "book_closure"),
    ("Reminder! Last Trading Day to Secure Dividend of Five Companies", "book_closure"),
    ("Reminder! Last Day to Grab Dividend Proposed by Sahas Urja Limited And Soaltee Hotel Limited", "book_closure"),
    ("21% Bonus Shares of Sahas Urja Limited Listed in NEPSE", "bonus_listed"),
    ("Bonus Shares of SAHAS And SMJC Now Listed in NEPSE", "bonus_listed"),
    ("Three Stocks Get Price Adjustments for Bonus Shares; Here Are the New Rates", "price_adjustment"),
    ("50% Right Shares of NIC Asia Bank Limited Approved By SEBON", "right_share"),
    ("Sahas Urja Limited Receives Preliminary Approval from ERC to Issue Right Shares at the Ratio of 1: 1", "right_share"),
    ("Nabil Investment Banking Calls AGM on Ashwin 20 With These Agendas", "agm"),
    ("Nabil Bank’s Net Profit Surges by 45.43% to Rs. 2.55 Arba in Q1 FY 2083/84; Net Interest Income at Rs. 4.74 Arba", "quarterly_result"),
    ("Sarbottam Cement’s Net Profit Drops 67.95% in Q1; Revenue Grows 11.57%, EPS at Rs. 7.96", "quarterly_result"),
    ("Soaltee Hotel Posts 15.20% Increase in Net Profit with 14.89% Revenue Growth in Q1 2083/84", "quarterly_result"),
    ("ICRA Nepal Upgrades Ratings of Kabeli Hydropower and Sahas Urja", "rating_change"),
    ("ICRA Nepal Reaffirms BBB- Rating for Sahas Urja Limited with Developmental Impact", "rating_change"),
    ("Himalayan Bank is Auctioning 8,50,124.57 Units of Promoter Shares To General Public/ Institutions From Today", "auction"),
    ("Mid Solu Hydropower Basic Shareholder Plans to Sell 100,000 Shares", "promoter_sale"),
    ("Sonapur Minerals and Oil Limited Announces Conclusion of Lock-in Period for Promoters and Employee Shares on Ashwin 23", "lock_in_expiry"),
    ("Nippon Pharmaceuticals to Issue IPO, Appoints Nabil Investment Banking as Issue Manager", "ipo_fpo"),
    ("Public Issue of \"NIC ASIA Equity Opportunity Fund\" Mutual Fund Scheme Opening From Today", "ipo_fpo"),
    ("Nabil Bank Appoints Global IME Capital as Issue Manager for Rs. 4 Arba Debenture", "debenture"),
    ("10% Himalayan Bank Limited Debenture 2083  Delisted From NEPSE", "debenture"),
    ("Chilime Hydropower Plant Damaged by the Flood, Six Employees Missing", "incident"),
    ("Continuous Rain, Floods and Landslides Disrupt Nepal Telecom Services", "incident"),
    ("Sahas Urja Rejects News of Damage to Solu Khola Hydro Project", "incident"),
    ("NIC Asia Bank contributes Rs 2.21 crore to PM Disaster Relief Fund", "csr"),
    ("Nepal Telecom Extends Free Services to Flood Affected Area Until Further Notice", "csr"),
    ("Dipendra Kumar Mishra Appointed Chairman of Himalayan Reinsurance", "management_change"),
    ("Chairman of Himalayan Reinsurance Limited Resigns", "management_change"),
    ("Balephi Hydropower to Invest Rs. 2 Crore in BHL Investment", "investment_or_expansion"),
    ("Nabil Bank Launches Virtual Credit Card for Fonepay QR Payments", "business_update"),
    ("Syakar Trading Signs Agreement With NIC ASIA Bank for Auto Loan for Honda Cars", "business_update"),
    ("Heavy Accumulation Recorded in NEPSE: Top 10 Most Bought Stocks of the Week", "market_roundup"),
    ("10 NEPSE Stocks Trading Below Rs 220: Where Do They Stand Against Their 52 Week Highs and Lows?", "market_roundup"),
    ("Hydropower Index Falls More Than 2.5%, as Rasuwa Flood Damages Hydropower Infrastructure", "market_roundup"),
    ("Know How Did The Mutual Funds Perform in Ashwin, A Complete Analysis of Multiple Factors", "market_roundup"),
    ("Unveiling Q1 2083/84: A Comprehensive Analysis of Leading Commercial Banks and Key Financial Insights", "market_roundup"),
    ("Prabhu Leads Deposit Rates as Average Bank Interest Rates Decline in Ashwin", "market_roundup"),
]


@pytest.mark.parametrize("headline,expected", CLASSIFY_CASES)
def test_classify_real_headlines(headline, expected):
    assert x.classify(headline) == expected


def test_unknown_headline_is_other():
    assert x.classify("Company Releases Annual Calendar") == "other"


# ---------------------------------------------------------------------------
# extract_fields(): numbers
# ---------------------------------------------------------------------------

def test_dividend_bonus_and_cash_sum_to_total():
    f = x.extract_fields("Sahas Urja Limited Declares 21% Bonus Shares and 1.1053% Cash Dividend; Plans 100% Right Shares Issue")
    assert f["bonus_pct"] == 21.0
    assert f["cash_pct"] == 1.1053
    assert f["total_pct"] == pytest.approx(22.1053)


def test_dividend_total_only_leaves_parts_null():
    f = x.extract_fields("Chhimek Laghubitta Sanstha Proposes 25% Dividend for FY 2082/83")
    assert f["total_pct"] == 25.0
    assert f["bonus_pct"] is None and f["cash_pct"] is None
    assert f["fiscal_year"] == "2082/83"


def test_cash_only_headline_does_not_invent_total_or_bonus():
    f = x.extract_fields("Himalayan 80-20 Declares 15% Cash Dividend for FY 2082/83")
    assert f["cash_pct"] == 15.0
    assert f["bonus_pct"] is None
    assert f["total_pct"] is None


def test_no_number_means_null_fields():
    f = x.extract_fields("Bonus Shares of SAHAS And SMJC Now Listed in NEPSE")
    assert f["bonus_pct"] is None
    f = x.extract_fields("Reminder! Last Trading Day to Secure Dividend of Five Companies")
    assert f["book_close_date"] is None
    assert f["total_pct"] is None
    f = x.extract_fields("Nepal Investment Mega Bank Reports Q1 Results")
    assert f["profit_change_pct"] is None and f["profit_direction"] is None


def test_per_symbol_percent_in_multi_fund_headline():
    h = "Nabil Mutual Funds Declare Cash Dividends: 3.5% for NBF2 and 2.5% for NBF3; When Is the Book Closure Date?"
    assert x.extract_fields(h, symbol="NBF3")["cash_pct"] == 2.5
    other = x.extract_fields(h, symbol="NABIL")
    assert other["cash_pct"] is None and other["symbol_listed_in_headline"] is False


def test_quarterly_profit_up_with_fy():
    f = x.extract_fields("Nabil Bank’s Net Profit Surges by 45.43% to Rs. 2.55 Arba in Q1 FY 2083/84; Net Interest Income at Rs. 4.74 Arba")
    assert f == {"quarter": 1, "fiscal_year": "2083/84", "profit_change_pct": 45.43,
                 "profit_direction": "up", "eps": None}


def test_quarterly_profit_down_ignores_revenue_growth():
    f = x.extract_fields("Sarbottam Cement’s Net Profit Drops 67.95% in Q1; Revenue Grows 11.57%, EPS at Rs. 7.96")
    assert f["profit_direction"] == "down"
    assert f["profit_change_pct"] == 67.95
    assert f["eps"] == 7.96


def test_quarterly_profit_clause_before_despite():
    f = x.extract_fields("Sahas Urja Achieves 16.07% Rise in Q1 Net Profit Despite Decline in Core Revenue; Annualized EPS Reaches Rs. 45.74")
    assert (f["profit_direction"], f["profit_change_pct"], f["eps"]) == ("up", 16.07, 45.74)


def test_right_share_ratio_and_stage():
    f = x.extract_fields("Sahas Urja Limited Receives Preliminary Approval from ERC to Issue Right Shares at the Ratio of 1: 1")
    assert f["ratio"] == "1:1" and f["stage"] == "proposed"
    f = x.extract_fields("50% Right Shares of NIC Asia Bank Limited Approved By SEBON")
    assert f["ratio_pct"] == 50.0 and f["stage"] == "approved" and f["ratio"] is None


def test_rating_direction_and_grade():
    f = x.extract_fields("ICRA Nepal Reaffirms BBB- Rating for Sahas Urja Limited with Developmental Impact")
    assert f["direction"] == "reaffirm" and f["rating"] == "BBB-"
    assert x.extract_fields("ICRA Nepal Upgrades Ratings of Kabeli Hydropower and Sahas Urja")["direction"] == "upgrade"


def test_auction_promoter_units():
    f = x.extract_fields("Himalayan Bank is Auctioning 8,50,124.57 Units of Promoter Shares To General Public/ Institutions From Today")
    assert f["share_kind"] == "promoter" and f["units"] == "8,50,124.57"


def test_incident_denial_flag():
    f = x.extract_fields("Sahas Urja Rejects News of Damage to Solu Khola Hydro Project")
    assert f["denied"] is True and f["kind"] == "damage"


# ---------------------------------------------------------------------------
# Dates: both stored formats, BS conversion
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("raw,iso", [
    ("2026-11-05", "2026-11-05"),
    ("Tuesday, April 28, 2026", "2026-04-28"),
    ("Wednesday, January 22, 2025", "2025-01-22"),
    ("Apr 28, 2026", "2026-04-28"),
    ("not a date", None),
])
def test_parse_any_date_both_formats(raw, iso):
    assert x.parse_any_date(raw) == iso


def test_scraper_normalizes_to_iso():
    assert normalize_date("Friday, November 14, 2025") == "2025-11-14"
    assert normalize_date("2026-09-16") == "2026-09-16"
    assert normalize_date("", "https://www.sharesansar.com/newsdetail/x-2026-09-16") == "2026-09-16"


def test_bs_numeric_date_conversion_keeps_original():
    d = x.find_bs_dates("Book closure on 2082-07-25 for the AGM")
    assert d[0]["iso"] == "2025-11-11"
    assert d[0]["bs"] == "2082-07-25"


def test_bs_month_day_uses_article_year():
    # Kartik 25 near an article dated 2026-11-05 is Kartik 25, 2083
    d = x.find_bs_dates("AGM on Kartik 25", "2026-11-05")
    assert d[0]["iso"] == x.bs_to_iso(2083, 7, 25)
    assert d[0]["bs"] == "Kartik 25"


def test_bs_day_first_with_year():
    d = x.find_bs_dates("has called its 42nd AGM on 22nd Ashoj, 2083.")
    assert d[0]["iso"] == x.bs_to_iso(2083, 6, 22) == "2026-10-08"


def test_bs_month_spelling_variants():
    for txt in ("Ashwin 25", "Ashoj 25", "Asoj 25"):
        assert x.find_bs_dates(txt, "2026-09-18")[0]["iso"] == x.bs_to_iso(2083, 6, 25)


def test_invalid_bs_date_is_dropped():
    assert x.find_bs_dates("Ashwin 45", "2026-09-18") == []


def test_agm_date_from_headline():
    f = x.extract_fields("Nabil Investment Banking Calls AGM on Ashwin 20 With These Agendas", ref_date="2026-09-09")
    assert f["agm_date"] == "2026-10-06" and f["agm_date_bs"] == "Ashwin 20"


def test_lock_in_expiry_date_far_from_keyword():
    h = ("Mid Solu Hydropower Announces Conclusion of Lock-in Period for Promoters Local Residents "
         "of the Project Affected Area And Employees Shares on Ashwin 10")
    f = x.extract_fields(h, ref_date="2026-08-18")
    assert f["expiry_date_bs"] == "Ashwin 10"
    assert f["holder_groups"] == ["promoter", "employee", "local"]


# ---------------------------------------------------------------------------
# Bodies (saved snippets, no network)
# ---------------------------------------------------------------------------

NABIL_BODY = """Nabil Bank Limited (NABIL)
has called its 42nd AGM on 22nd Ashoj, 2083. The meeting will be held in the Tribhuwan Army Office, Bhadrakali, Kathmandu starting at 9:30 am that day.
Among the other agendas, the AGM will endorse a 15.80% dividend for the fiscal year 2082/83. The 712th board of directors meeting decided to distribute the dividend on the paid-up capital of Rs. 27.05 Arba. A 5% bonus share worth Rs. 1.35 Arba and a 10.80% cash dividend worth Rs. 2.92 Arba (for tax purposes) has been proposed.
The book closure date is on Ashoj 14 will remain closed for one day for the purpose of distributing cash dividends on Nabil 8% Irredeemable Non-Cumulative Preference Shares.. Therefore, the shareholders who maintained before that day are entitled to dividend payout, and can attend this AGM."""

REMINDER_BODY = """Today is the last day to grab the dividend proposed by
Shangri-la Development Bank Limited (SADBL)
. The company has called its 22nd AGM on Ashwin 22, 2083.
4% bonus shares and 6.5263% cash dividend (for tax purposes) have been proposed.
Ashwin 08 is the book closure date. Thus, shareholders who maintained that day are entitled to the dividend payout and can also attend the AGM.
Today is the last day to grab the dividend proposed by
Nabil Investment Banking Limited (NABILINV)
. The company has called its 17th AGM on Ashwin 20, 2083.
The meeting of the board of directors decided to distribute a 10% bonus shares worth Rs. 40.50 crores and a 11.05263158% cash dividend (for tax purposes) worth Rs. 44.76 crores have been proposed.
Ashwin 08 is the book closure date. Thus, shareholders who maintained that day are entitled to the dividend payout and can also attend the AGM."""

CBBL_BODY = """Chhimek Laghubitta Bittiya Sanstha Limited (CBBL)
has proposed a 25% dividend worth Rs. 90.43 crores for the fiscal year 2082/83.
The 345th meeting of the board of directors, held on Kartik 18, decided to distribute the dividend on the paid-up capital of Rs. 3.61 Arba. 11.9631% bonus shares, worth Rs 43.27 crores, and a 13.0369% cash dividend (including tax), also worth Rs 47.15 crores, have been proposed.
The dividend will be distributed only after approval by the central bank and endorsement by the company's upcoming AGM."""


def test_body_gives_book_closure_and_split():
    h = "Nabil Bank Limited Unveils Book Closure Date for its 15.80% Dividend; Calls AGM on Ashoj 22"
    f = x.extract_fields(h, NABIL_BODY, ref_date="2026-09-16", symbol="NABIL")
    assert f["book_close_date"] == "2026-09-30" and f["book_close_date_bs"] == "Ashoj 14"
    assert f["agm_date"] == "2026-10-08"
    assert (f["bonus_pct"], f["cash_pct"], f["total_pct"]) == (5.0, 10.8, 15.8)
    assert f["last_buy_date"] is None  # not stated anywhere in this source


def test_board_meeting_date_is_not_a_book_closure():
    f = x.extract_fields("Chhimek Laghubitta Sanstha Proposes 25% Dividend for FY 2082/83", CBBL_BODY,
                         ref_date="2026-11-05", symbol="CBBL")
    assert f["book_close_date"] is None
    assert (f["bonus_pct"], f["cash_pct"], f["total_pct"]) == (11.9631, 13.0369, 25.0)


def test_multi_company_body_segment():
    seg, found = x.body_segment_for_symbol(REMINDER_BODY, "NABILINV")
    assert found is True and "17th AGM" in seg and "SADBL" not in seg
    seg, found = x.body_segment_for_symbol(REMINDER_BODY, "NABIL")
    assert seg is None and found is False


def test_reminder_last_day_from_source_text():
    h = "Reminder! Last Trading Day to Secure Dividend of Five Companies"
    seg, _ = x.body_segment_for_symbol(REMINDER_BODY, "NABILINV")
    f = x.extract_fields(h, seg, ref_date="2026-09-23", symbol="NABILINV")
    assert f["last_buy_date"] == "2026-09-23" and f["last_buy_date_source"] == "article_date"
    assert f["book_close_date"] == x.bs_to_iso(2083, 6, 8)
    assert f["bonus_pct"] == 10.0


def test_parse_article_body_html():
    html = '<html><body><div id="newsdetail-content"><p>Line one</p><script>x()</script><p>Ashwin 08 is the book closure date.</p></div></body></html>'
    assert x.parse_article_body(html) == "Line one\nAshwin 08 is the book closure date."


# ---------------------------------------------------------------------------
# Roundups, subject matching, records
# ---------------------------------------------------------------------------

def test_roundup_and_popularity_flags():
    h = "Heavy Accumulation Recorded in NEPSE: Top 10 Most Bought Stocks of the Week"
    assert x.is_roundup(h) and x.is_popularity_list(h)
    assert x.extract_fields(h)["popularity_list"] is True
    assert not x.is_roundup("Bonus Shares of Two Companies Listed on NEPSE")
    assert not x.is_popularity_list("10 NEPSE Stocks Trading Below Rs 220: Where Do They Stand Against Their 52 Week Highs and Lows?")


ALIASES = {
    "NABIL": ["nabil bank limited"], "NICA": ["nic asia bank ltd.", "nic asia bank"],
    "HBL": ["himalayan bank limited"], "SHL": ["soaltee hotel limited"],
    "NIMB": ["nepal investment mega bank limited"], "CBBL": ["chhimek laghubitta bittiya sanstha limited"],
}


@pytest.mark.parametrize("headline,symbol,expected", [
    ("Nabil Bank Limited Proposes 15.80% Dividend for FY 2082/83", "NABIL", True),
    ("Nabil Investment Banking Calls AGM on Ashwin 20 With These Agendas", "NABIL", False),
    ("NIC Asia Capital Approves 50% Cash Dividend at 10th AGM", "NICA", False),
    ("Himalayan 80-20 Declares 15% Cash Dividend for FY 2082/83", "HBL", False),
    ("Mid Solu Hydropower Company Proposes 15.789% Dividend for Fiscal Year 2082/83", "SHL", False),
    ("NIMB Ace Capital Holds Investor Awareness Programs in Kathmandu, Pokhara", "NIMB", False),
    ("NIMB Partners with Sajha Yatayat for Digital Ticketing", "NIMB", True),
    ("Chhimek Laghubitta Sanstha Proposes 25% Dividend for FY 2082/83", "CBBL", True),
    ("Some Headline", "ZZZZ", None),
])
def test_subject_matches(headline, symbol, expected):
    assert x.subject_matches(headline, symbol, ALIASES) is expected


def test_record_schema_and_confidence(tmp_path):
    fetcher = x.BodyFetcher(enabled=False, max_fetch=0, cache_dir=str(tmp_path))
    item = {"headline": "Nabil Bank Limited Proposes 15.80% Dividend for FY 2082/83", "date": "2026-09-07",
            "link": "https://www.sharesansar.com/newsdetail/nabil-bank-limited-proposes-1580-dividend-for-fy-208283-2026-09-07"}
    r = x.build_record("NABIL", item, ALIASES, fetcher, date(2026, 11, 15))
    for key in ("id", "symbol", "event_type", "headline", "date", "link", "fields",
                "action_date", "is_roundup", "confidence"):
        assert key in r
    assert r["id"] == x.article_id(item["link"])
    assert r["event_type"] == "dividend_proposed" and r["confidence"] == "high"
    assert r["action_date"] is None  # no book closure date in the text

    wrong = dict(item, headline="Nabil Investment Banking Calls AGM on Ashwin 20 With These Agendas")
    r2 = x.build_record("NABIL", wrong, ALIASES, fetcher, date(2026, 11, 15))
    assert r2["confidence"] == "low" and r2["action_date"] is None


def test_record_uses_cached_body_and_sets_action_date(tmp_path):
    link = "https://www.sharesansar.com/newsdetail/nabil-bank-limited-unveils-book-closure-date-2026-09-16"
    (tmp_path / f"{x.article_id(link)}.txt").write_text(NABIL_BODY, encoding="utf-8")
    fetcher = x.BodyFetcher(enabled=False, max_fetch=0, cache_dir=str(tmp_path))
    item = {"headline": "Nabil Bank Limited Unveils Book Closure Date for its 15.80% Dividend; Calls AGM on Ashoj 22",
            "date": "Wednesday, September 16, 2026", "link": link}
    r = x.build_record("NABIL", item, ALIASES, fetcher, date(2026, 9, 20))
    assert r["date"] == "2026-09-16"
    assert r["body_used"] is True
    assert r["action_date"] == "2026-09-30" and r["action_kind"] == "book_closure"


def test_old_items_are_never_fetched(tmp_path, monkeypatch):
    fetcher = x.BodyFetcher(enabled=True, max_fetch=5, cache_dir=str(tmp_path))
    monkeypatch.setattr(fetcher, "get", lambda *a, **k: pytest.fail("must not fetch old items"))
    item = {"headline": "Sahas Urja Limited Unveils Book Closure Date for its 22.1053% Dividend; Calls AGM on Mangsir 24",
            "date": "2025-11-14", "link": "https://www.sharesansar.com/newsdetail/sahas-2025-11-14"}
    x.build_record("SAHAS", item, {"SAHAS": ["sahas urja limited"]}, fetcher, date(2026, 11, 15))
