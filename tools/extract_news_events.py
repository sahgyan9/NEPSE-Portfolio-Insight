"""
News event extractor (rule-based, no LLM, no paid API)
======================================================
Reads db/news.json (headlines + links per symbol, written by
tools/scrape_sharesansar_news.py) and works out WHAT HAPPENED in each item:
dividend proposed, book closure, right share, quarterly result, and so on.
It pulls the numbers and dates out of the text and writes db/news_events.json.

Everything here is deterministic: keyword and regex patterns only. If a number
or date is not in the text, the field stays null. Nothing is guessed.

Headlines often leave out the book closure date. For the event types where a
date matters (dividend_proposed, book_closure, right_share, agm) the tool can
fetch the article page and read the body, politely:
  - only items newer than 60 days
  - at most 1 request per second
  - bodies are cached under .tmp/news_bodies/<id>.txt and never fetched twice
  - --no-fetch disables fetching, --max-fetch caps requests per run (default 25)

Usage:
    python tools/extract_news_events.py
    python tools/extract_news_events.py --no-fetch
    python tools/extract_news_events.py --max-fetch 5
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from datetime import date, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEWS_PATH = os.path.join(ROOT, "db", "news.json")
OUT_PATH = os.path.join(ROOT, "db", "news_events.json")
SYMBOL_MAP_PATH = os.path.join(ROOT, "db", "company_symbol_map.json")
BODY_CACHE_DIR = os.path.join(ROOT, ".tmp", "news_bodies")

FETCH_MAX_AGE_DAYS = 60
FETCH_MIN_INTERVAL_S = 1.0
DATE_SENSITIVE_TYPES = {"dividend_proposed", "book_closure", "right_share", "agm"}

EVENT_TYPES = [
    "dividend_proposed", "dividend_approved", "book_closure", "bonus_listed",
    "price_adjustment", "right_share", "agm", "quarterly_result", "rating_change",
    "ipo_fpo", "debenture", "auction", "promoter_sale", "merger_acquisition",
    "lock_in_expiry", "incident", "csr", "management_change",
    "investment_or_expansion", "business_update", "market_roundup", "other",
]

# ---------------------------------------------------------------------------
# Dates
# ---------------------------------------------------------------------------

_EN_MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august",
     "september", "october", "november", "december"], start=1)}
_EN_MONTHS.update({k[:3]: v for k, v in list(_EN_MONTHS.items())})
_EN_MONTHS["sept"] = 9

_LONG_DATE_RE = re.compile(
    r"(?:[A-Za-z]+,\s*)?([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})")


def parse_any_date(value: str | None) -> str | None:
    """'2026-11-05', '2026-11-05T10:00', 'Tuesday, April 28, 2026', 'Apr 28, 2026' -> ISO."""
    if not value:
        return None
    s = str(value).strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        try:
            return date(int(m[1]), int(m[2]), int(m[3])).isoformat()
        except ValueError:
            return None
    m = _LONG_DATE_RE.search(s)
    if m:
        month = _EN_MONTHS.get(m[1].lower())
        if month:
            try:
                return date(int(m[3]), month, int(m[2])).isoformat()
            except ValueError:
                return None
    return None


# Bikram Sambat month names as they appear in English-language Nepali news.
_BS_MONTH_ALIASES = {
    1: ["baisakh", "baishakh", "baishak", "vaisakh", "vaishakh"],
    2: ["jestha", "jeth", "jeshtha", "jyestha"],
    3: ["ashadh", "asar", "ashar", "asadh", "aashadh", "ashad"],
    4: ["shrawan", "sharawan", "shravan", "saun", "sawan", "srawan"],
    5: ["bhadra", "bhadau", "bhadra"],
    6: ["ashwin", "ashoj", "asoj", "aswin", "ashwoj", "aswhin"],
    7: ["kartik", "kartika", "kartick"],
    8: ["mangsir", "mansir", "mangshir", "marga", "margashirsha"],
    9: ["poush", "paush", "pus", "push", "pous"],
    10: ["magh", "mag"],
    11: ["falgun", "phalgun", "fagun", "phagun"],
    12: ["chaitra", "chait", "chaitr"],
}
_BS_MONTH = {alias: num for num, aliases in _BS_MONTH_ALIASES.items() for alias in aliases}
_BS_MONTH_PATTERN = "|".join(sorted(_BS_MONTH, key=len, reverse=True))

# "Ashoj 22", "Ashwin 08, 2083", "Mangsir 24"
_BS_MD_RE = re.compile(
    rf"\b({_BS_MONTH_PATTERN})\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?\b(?:,?\s*(20[6-9]\d)\b)?",
    re.IGNORECASE)
# "22nd Ashoj, 2083", "14 Ashwin"
_BS_DM_RE = re.compile(
    rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?({_BS_MONTH_PATTERN})\b(?:,?\s*(20[6-9]\d)\b)?",
    re.IGNORECASE)
# "2082-07-25", "2082/07/25", "2082.07.25" (BS years run 2060-2099 in this era)
_BS_NUMERIC_RE = re.compile(r"\b(20[6-9]\d)[-/.](\d{1,2})[-/.](\d{1,2})\b")


def bs_to_iso(year: int, month: int, day: int) -> str | None:
    """Convert a Bikram Sambat date to an ISO Gregorian date, or None if invalid."""
    try:
        import nepali_datetime
        return nepali_datetime.date(int(year), int(month), int(day)).to_datetime_date().isoformat()
    except Exception:
        return None


def iso_to_bs_year(iso: str) -> int | None:
    try:
        import nepali_datetime
        return nepali_datetime.date.from_datetime_date(date.fromisoformat(iso)).year
    except Exception:
        return None


def _resolve_bs(month: int, day: int, year: int | None, ref_iso: str | None) -> str | None:
    """BS month/day (+ optional year) to ISO. Without a year, pick the BS year
    that puts the date nearest to the article date (news talks about dates
    within a few months of publication)."""
    if year:
        return bs_to_iso(year, month, day)
    ref_year = iso_to_bs_year(ref_iso) if ref_iso else None
    if not ref_year:
        return None
    ref = date.fromisoformat(ref_iso)
    best, best_gap = None, None
    for y in (ref_year - 1, ref_year, ref_year + 1):
        iso = bs_to_iso(y, month, day)
        if not iso:
            continue
        gap = abs((date.fromisoformat(iso) - ref).days)
        if best_gap is None or gap < best_gap:
            best, best_gap = iso, gap
    return best


def find_bs_dates(text: str, ref_iso: str | None = None) -> list[dict]:
    """All BS dates in the text, in order: [{iso, bs, start, end}]. Keeps the original string."""
    if not text:
        return []
    found: list[dict] = []
    taken: list[tuple[int, int]] = []

    def add(start: int, end: int, iso: str | None, original: str):
        if iso is None:
            return
        if any(not (end <= a or start >= b) for a, b in taken):
            return
        taken.append((start, end))
        found.append({"iso": iso, "bs": original.strip(" ,"), "start": start, "end": end})

    for m in _BS_NUMERIC_RE.finditer(text):
        add(m.start(), m.end(), bs_to_iso(int(m[1]), int(m[2]), int(m[3])), m[0])
    for m in _BS_DM_RE.finditer(text):
        month = _BS_MONTH[m[2].lower()]
        add(m.start(), m.end(),
            _resolve_bs(month, int(m[1]), int(m[3]) if m[3] else None, ref_iso), m[0])
    for m in _BS_MD_RE.finditer(text):
        month = _BS_MONTH[m[1].lower()]
        add(m.start(), m.end(),
            _resolve_bs(month, int(m[2]), int(m[3]) if m[3] else None, ref_iso), m[0])
    found.sort(key=lambda d: d["start"])
    return found


def _date_near(text: str, keyword_re: re.Pattern, ref_iso: str | None, window: int = 90) -> dict | None:
    """First BS date in the same sentence as a keyword, closest to it."""
    if not text:
        return None
    for sentence in re.split(r"(?<=[.!?;])\s+|\n", text):
        kms = list(keyword_re.finditer(sentence))
        if not kms:
            continue
        dates = find_bs_dates(sentence, ref_iso)
        if not dates:
            continue

        def gap(d):
            return min(min(abs(d["start"] - k.end()), abs(d["end"] - k.start())) for k in kms)

        best = min(dates, key=gap)
        if gap(best) <= window:
            return best
    return None


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

_POPULARITY_RE = re.compile(
    r"most bought|most sold|most traded|heavy (accumulation|buying)|top \d+ (bought|traded)|"
    r"top gainers?|top losers?|highest (volume|turnover)|bought most", re.I)

_ROUNDUP_RE = re.compile(
    r"\btop \d+\b|top gainers?|top losers?|most bought|most sold|most traded|heavy accumulation|"
    r"highest volume|bought most|"
    r"\b\d+ (?:nepse |listed )?(?:stocks|companies|scrips|banks|hydropowers?)\b|"
    r"comprehensive (?:analysis|data)|data compilation|\bdecoding\b|"
    r"mutual funds? (?:perform|paid)|which mutual funds|"
    r"\bindex (?:falls|rises|gains|drops|declines|surges|plunges)|"
    r"\binterest rates? (?:decline|rise|increase|fall)|leads deposit rates|"
    r"industry profit|sector (?:wise|analysis)|market (?:summary|wrap|roundup)", re.I)


def is_roundup(headline: str) -> bool:
    """Multi-company list or sector/index move: noise for a single holding."""
    return bool(_ROUNDUP_RE.search(headline or ""))


def is_popularity_list(headline: str) -> bool:
    return bool(_POPULARITY_RE.search(headline or ""))


# Ordered: first match wins. Specific corporate actions before generic buckets.
_RULES: list[tuple[str, re.Pattern]] = [
    ("book_closure", re.compile(
        r"(?:unveil\w*|announc\w*|fix\w*|set\w*|publish\w*)\b.{0,20}\bbook[- ]?clos|"
        r"last (?:trading )?day to (?:secure|grab|get|buy)", re.I)),
    ("price_adjustment", re.compile(r"price adjust", re.I)),
    ("dividend_approved", re.compile(
        r"(?:approves?|approved|endorses?|endorsed|passes|passed)\b.*\bdividend|"
        r"dividend\b.*\b(?:approved|endorsed)\b", re.I)),
    ("dividend_proposed", re.compile(
        r"(?:propos|declar|announc|recommend|distribut)\w*\b.*\b(?:dividend|bonus)|"
        r"(?:dividend|bonus shares?)\b.*\b(?:proposed|declared|announced)", re.I)),
    ("auction", re.compile(r"\bauction", re.I)),
    ("right_share", re.compile(r"\bright(?:s)? (?:share|issue)|\bhakprad", re.I)),
    ("book_closure", re.compile(r"book[- ]?clos", re.I)),
    ("bonus_listed", re.compile(r"bonus shares?\b.*\blisted|listed\b.*\bbonus", re.I)),
    ("agm", re.compile(r"\bagm\b|\bsgm\b|annual general meeting|general meeting", re.I)),
    ("quarterly_result", re.compile(
        r"(?:\bq[1-4]\b|quarter|annuali[sz]ed eps).*(?:profit|loss|eps|revenue|income|result|report)|"
        r"(?:profit|loss|eps|revenue)\b.*(?:\bq[1-4]\b|quarter)", re.I)),
    ("rating_change", re.compile(
        r"\b(?:icra|care ratings?|care nepal|india ratings)\b|"
        r"\brating\b.*\b(?:upgrade|downgrade|reaffirm|assign)|"
        r"\b(?:upgrade|downgrade|reaffirm|assign)\w*\b.*\brating", re.I)),
    ("promoter_sale", re.compile(
        r"(?:promoter|basic shareholder|founder)\b.*\b(?:sell|sale|selling)\b", re.I)),
    ("lock_in_expiry", re.compile(r"lock[- ]?in|locking period", re.I)),
    ("merger_acquisition", re.compile(
        r"\bmerg(?:e|er|ers|ing)\b|acqui(?:re|res|red|sition)|amalgamat|\bswap ratio", re.I)),
    ("debenture", re.compile(r"\bdebentures?\b|\bbonds?\b", re.I)),
    ("ipo_fpo", re.compile(
        r"\bipo\b|\bfpo\b|public issue|initial public offering|further public offering|"
        r"mutual fund scheme|units? mutual fund|issue\b.*\bunits\b|fund (?:has|have) been listed|"
        r"fund\b.*\blisted on nepse", re.I)),
    ("csr", re.compile(
        r"contribut\w*|donat\w*|relief|\bcsr\b|flood (?:victims|affected)|awareness program|"
        r"fellowship|scholarship|hosts? .*students|tree plantation|blood donation", re.I)),
    ("incident", re.compile(
        r"\bflood\w*|\bfire\b|damage\w*|landslide\w*|\bmissing\b|disrupt\w*|"
        r"\bcourt\b|\blawsuit\b|\bpenalt\w*|\bfined\b|\bsuspend\w*|\bban(?:ned|s)?\b|"
        r"investigation|fraud|\barrest\w*|action against|\bdirective\b.*\b(?:nrb|sebon)\b|"
        r"\b(?:nrb|sebon|cib)\b.*\b(?:action|penal|fine|warn)", re.I)),
    ("management_change", re.compile(
        r"\b(?:appoint\w*|resign\w*|elected|named|takes charge|steps down)\b.*"
        r"\b(?:chairman|chairperson|ceo|chief executive|director|deputy|board|manager|gm)\b|"
        r"\b(?:chairman|chairperson|ceo|chief executive|director)\b.*\b(?:appoint\w*|resign\w*)\b", re.I)),
    ("investment_or_expansion", re.compile(
        r"\bto invest\b|\binvests?\b(?! ?banking)|\bexpansion\b|\bexpand\w*\b|new branch|"
        r"\bconsortium\b|\bloan for\b.*\bproject\b|\bmw\b.*\bproject\b|capacity|new plant|new factory|subsidiary", re.I)),
    ("business_update", re.compile(
        r"\blaunch\w*|\bunveil\w*|\bpartner\w*|\bagreement\b|\bsigns?\b|\bmou\b|"
        r"\baccept\w*\b.*\bpay|\bcertification\b|\biso\b|calls? applications|\bregistrar\b|"
        r"\bhonou?rs?\b|\bintroduc\w*|\bservice\w*\b|\bopens? applications\b|\bappoints?\b|"
        r"\bdelisted\b|\blisted\b", re.I)),
]


def classify(headline: str) -> str:
    """Return the event_type for a headline. Pure function."""
    h = headline or ""
    if is_roundup(h):
        return "market_roundup"
    for event_type, pattern in _RULES:
        if pattern.search(h):
            return event_type
    return "other"


# ---------------------------------------------------------------------------
# Field extraction
# ---------------------------------------------------------------------------

_NUM = r"(\d+(?:\.\d+)?)"
_FY_RE = re.compile(r"(?:\bFY|fiscal year|f\.y\.)\s*[:\-]?\s*((?:20)?[6-9]\d)\s*/\s*(\d{2,4})\b|"
                    r"\b(20[6-9]\d)\s*/\s*(\d{2})\b", re.I)


def _num(s: str | None) -> float | None:
    if s is None:
        return None
    try:
        return float(s.replace(",", ""))
    except ValueError:
        return None


def _fiscal_year(text: str) -> str | None:
    m = _FY_RE.search(text or "")
    if not m:
        return None
    start, end = (m[1], m[2]) if m[1] else (m[3], m[4])
    if len(start) == 2:
        start = f"20{start}"
    if not start.startswith("20") or int(start) < 2060:
        return None
    return f"{start}/{end[-2:]}"


def _pct_before(text: str, word_re: str) -> float | None:
    m = re.search(rf"{_NUM}[^\S\r\n]*%[^\S\r\n]*(?:{word_re})", text, re.I)
    return _num(m[1]) if m else None


def _dividend_parts(text: str) -> dict:
    """bonus_pct, cash_pct, total_pct from a headline or body sentence."""
    bonus = _pct_before(text, r"(?:stock )?bonus")
    if bonus is None:
        m = re.search(rf"(?:stock\s+)?bonus\s*(?:shares?)?\s*[:\-]\s*{_NUM}\s*%", text, re.I)
        if m:
            bonus = _num(m[1])

    cash = _pct_before(text, r"cash")
    if cash is None:
        m = re.search(rf"cash\s*(?:dividend)?\s*[:\-]\s*{_NUM}\s*%", text, re.I)
        if m:
            cash = _num(m[1])

    total = None
    m = re.search(rf"{_NUM}[^\S\r\n]*%[^\S\r\n]*(?:total\s+)?dividend", text, re.I)
    if m and _num(m[1]) not in (bonus, cash):
        total = _num(m[1])
    if total is None:
        m = re.search(rf"total\s*(?:dividend)?\s*[:\-]\s*{_NUM}\s*%", text, re.I)
        if m and _num(m[1]) not in (bonus, cash):
            total = _num(m[1])

    # "15.80% Dividend" also appears in "Book Closure Date for its 15.80% Dividend"
    if total is None and bonus is not None and cash is not None:
        total = round(bonus + cash, 6)
    return {"bonus_pct": bonus, "cash_pct": cash, "total_pct": total}


def _per_symbol_pct(headline: str, symbol: str | None) -> dict | None:
    """'3.5% for NBF2 and 2.5% for NBF3': return the share for this symbol, or
    {'mentioned': False} when the headline lists tickers but not this one."""
    pairs = re.findall(rf"{_NUM}\s*%\s*for\s+([A-Z][A-Z0-9]{{2,9}})\b", headline or "")
    if len(pairs) < 2 or not symbol:
        return None
    for pct, sym in pairs:
        if sym == symbol:
            return {"pct": float(pct), "mentioned": True}
    return {"pct": None, "mentioned": False}


_PROFIT_UP = r"surge\w*|rise\w*|rose|increase\w*|grow\w*|growth|jump\w*|up\b|climb\w*|soar\w*|improve\w*"
_PROFIT_DOWN = r"drop\w*|declin\w*|fall\w*|fell|decreas\w*|plung\w*|down\b|slump\w*|dip\w*|shrink\w*"


def _quarterly(text: str) -> dict:
    out = {"quarter": None, "fiscal_year": _fiscal_year(text), "profit_change_pct": None,
           "profit_direction": None, "eps": None}
    qm = re.search(r"\bQ([1-4])\b|\b(first|second|third|fourth)\s+quarter", text, re.I)
    if qm:
        out["quarter"] = int(qm[1]) if qm[1] else ["first", "second", "third", "fourth"].index(qm[2].lower()) + 1
    for clause in re.split(r";|,|\bwith\b|\bdespite\b|\bwhile\b|\bbut\b", text, flags=re.I):
        if not re.search(r"profit|loss", clause, re.I):
            continue
        pm = re.search(rf"{_NUM}\s*%", clause)
        up = re.search(_PROFIT_UP, clause, re.I)
        down = re.search(_PROFIT_DOWN, clause, re.I)
        if up and not down:
            out["profit_direction"] = "up"
        elif down and not up:
            out["profit_direction"] = "down"
        if re.search(r"turns? (?:to )?loss|into loss|net loss|\bpost(?:s|ed)? loss|\bincur(?:s|red)? loss", clause, re.I):
            out["profit_direction"] = "loss"
        elif not out["profit_direction"] and re.search(r"\b(?:net )?loss\b", clause, re.I) and not up:
            out["profit_direction"] = "loss"
        if pm and out["profit_direction"] in ("up", "down"):
            out["profit_change_pct"] = _num(pm[1])
        break
    em = re.search(rf"\bEPS\b[^0-9;]{{0,25}}?(?:Rs\.?|NPR)\s*{_NUM}", text, re.I)
    if em:
        out["eps"] = _num(em[1])
    return out


def _right_share(text: str) -> dict:
    ratio = None
    rm = re.search(r"\b(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\b", text)
    if rm and re.search(r"ratio|right", text, re.I):
        ratio = f"{rm[1]}:{rm[2]}"
    ratio_pct = _pct_before(text, r"right")
    h = text.lower()
    if re.search(r"allot", h):
        stage = "allotted"
    elif re.search(r"\blisted\b", h):
        stage = "listed"
    elif re.search(r"open\w*|from today|issue start|applications? (?:open|from)", h):
        stage = "issue_open"
    elif re.search(r"preliminary", h):
        stage = "proposed"
    elif re.search(r"approv|approval", h):
        stage = "approved"
    elif re.search(r"propos|plan\w*|to issue|decid|announc|recommend", h):
        stage = "proposed"
    else:
        stage = None
    return {"ratio": ratio, "ratio_pct": ratio_pct, "stage": stage}


def _rating(text: str) -> dict:
    h = text.lower()
    if "upgrade" in h:
        direction = "upgrade"
    elif "downgrade" in h:
        direction = "downgrade"
    elif "reaffirm" in h or "maintain" in h or "retain" in h:
        direction = "reaffirm"
    elif "assign" in h:
        direction = "assigned"
    else:
        direction = None
    rm = re.search(r"(?<![A-Za-z])((?:\[ICRANP\]\s*)?(?:AAA|AA|A|BBB|BB|B|C|D)[+-]?)\s+(?:[Rr]ating|[Gg]rade)|"
                   r"[Rr]ating of\s+((?:AAA|AA|A|BBB|BB|B|C|D)[+-]?)(?![A-Za-z])", text)
    rating = (rm[1] or rm[2]).strip() if rm else None
    am = re.search(r"\b(ICRA Nepal|CARE Ratings Nepal|CARE Nepal|ICRA|CARE)\b", text, re.I)
    return {"direction": direction, "rating": rating, "agency": am[1] if am else None}


def _ipo(text: str) -> dict:
    h = text.lower()
    if re.search(r"\bfpo\b|further public", h):
        instrument = "fpo"
    elif re.search(r"mutual fund|\bfund\b.*\bunits?\b|\bunits?\b.*\bfund\b|equity .*fund", h):
        instrument = "mutual_fund"
    elif re.search(r"\bipo\b|initial public|public issue", h):
        instrument = "ipo"
    else:
        instrument = None
    if re.search(r"\blisted\b", h):
        stage = "listed"
    elif re.search(r"closing|closes|last day", h):
        stage = "closing"
    elif re.search(r"opening|opens|from today|\bfrom\b\s+(?:" + _BS_MONTH_PATTERN + r")", h):
        stage = "open"
    elif re.search(r"approv", h):
        stage = "approved"
    elif re.search(r"issue manager|propos|plan|to issue|appoint", h):
        stage = "planned"
    else:
        stage = None
    um = re.search(r"([\d.,]+)\s*(crore|lakh|arba)?\s*units", text, re.I)
    units = f"{um[1]} {um[2]}".strip() if um and um[2] else (um[1] if um else None)
    return {"instrument": instrument, "stage": stage, "units": units}


def _incident(text: str) -> dict:
    h = text.lower()
    kind = None
    for k, pat in [("flood", r"flood|landslide|rain"), ("fire", r"\bfire\b"),
                   ("legal", r"court|lawsuit|arrest|fraud|investigation"),
                   ("regulatory", r"\bnrb\b|sebon|penalt|fined|suspend|\bban"),
                   ("damage", r"damage"), ("disruption", r"disrupt|missing")]:
        if re.search(pat, h):
            kind = k
            break
    denied = bool(re.search(r"\b(?:rejects?|denies|denied|refutes?|clarif\w*)\b", h))
    return {"kind": kind, "denied": denied}


def extract_fields(headline: str, body: str | None = None, event_type: str | None = None,
                   ref_date: str | None = None, symbol: str | None = None) -> dict:
    """Pull numbers and dates for the event out of the headline (and body when given).
    Pure function: never guesses, missing values stay None. ref_date (ISO article date)
    is used only to pick the BS year when the text gives month and day without a year."""
    h = headline or ""
    b = body or ""
    et = event_type or classify(h)
    both = f"{h}\n{b}" if b else h
    f: dict = {}

    def add_date(name: str, keyword_re: str, sources: list[str]):
        if f.get(f"{name}_date"):
            return
        kre = re.compile(keyword_re, re.I)
        for src in sources:
            d = _date_near(src, kre, ref_date)
            if d:
                f[f"{name}_date"] = d["iso"]
                f[f"{name}_date_bs"] = d["bs"]
                return
        f.setdefault(f"{name}_date", None)
        f.setdefault(f"{name}_date_bs", None)

    if et in ("dividend_proposed", "dividend_approved", "book_closure"):
        parts = _dividend_parts(h)
        per = _per_symbol_pct(h, symbol)
        if per is not None:
            if per["mentioned"]:
                key = "cash_pct" if re.search(r"cash", h, re.I) else "total_pct"
                parts = {"bonus_pct": None, "cash_pct": None, "total_pct": None, key: per["pct"]}
                if key == "cash_pct" and not re.search(r"bonus", h, re.I):
                    parts["total_pct"] = None
            else:
                parts = {"bonus_pct": None, "cash_pct": None, "total_pct": None}
                f["symbol_listed_in_headline"] = False
        if b and (parts["bonus_pct"] is None or parts["cash_pct"] is None):
            body_parts = _dividend_parts(b)
            for k in ("bonus_pct", "cash_pct"):
                if parts[k] is None and body_parts[k] is not None:
                    parts[k] = body_parts[k]
            if parts["total_pct"] is None:
                parts["total_pct"] = body_parts["total_pct"]
        f.update(parts)
        f["fiscal_year"] = _fiscal_year(h) or (_fiscal_year(b) if b else None)
        add_date("book_close", r"book[- ]?clos", [h, b])
        add_date("agm", r"\bagm\b|general meeting", [h, b])
        if et == "book_closure":
            f["last_buy_date"] = None
            f["last_buy_date_source"] = None
            lb = _date_near(both, re.compile(r"last (?:trading )?day", re.I), ref_date)
            if lb:
                f["last_buy_date"], f["last_buy_date_bs"] = lb["iso"], lb["bs"]
                f["last_buy_date_source"] = "text"
            elif ref_date and re.search(
                    r"today is the last (?:trading )?day|^reminder!?\s*last (?:trading )?day", both, re.I | re.M):
                # The source itself says the publication day is the last day.
                f["last_buy_date"] = ref_date
                f["last_buy_date_source"] = "article_date"
            f["purpose"] = ("right_share" if re.search(r"right", h, re.I)
                            else "agm" if re.search(r"\bagm\b", h, re.I) and not re.search(r"dividend", h, re.I)
                            else "dividend" if re.search(r"dividend|bonus", both, re.I) else None)

    elif et == "bonus_listed":
        f["bonus_pct"] = _pct_before(h, r"bonus")

    elif et == "price_adjustment":
        f["reason"] = ("bonus" if re.search(r"bonus", h, re.I)
                       else "right_share" if re.search(r"right", h, re.I) else None)

    elif et == "right_share":
        f.update(_right_share(h))
        if b:
            rb = _right_share(b)
            for k in ("ratio", "ratio_pct"):
                if f[k] is None:
                    f[k] = rb[k]
        add_date("book_close", r"book[- ]?clos", [h, b])
        add_date("open", r"\bopen\w*|from\b", [h, b])
        add_date("close", r"\bclos(?:e|es|ing)\b(?! date)|\buntil\b|\btill\b|last day", [h, b])

    elif et == "agm":
        add_date("agm", r"\bagm\b|\bsgm\b|general meeting", [h, b])
        f["meeting"] = "sgm" if re.search(r"\bsgm\b|special general", h, re.I) else "agm"

    elif et == "quarterly_result":
        f.update(_quarterly(h))

    elif et == "rating_change":
        f.update(_rating(h))

    elif et == "ipo_fpo":
        f.update(_ipo(h))
        add_date("open", r"\bfrom\b|open\w*", [h])
        add_date("close", r"\bclos\w*|\buntil\b|\btill\b", [h])

    elif et == "debenture":
        stage = ("delisted" if re.search(r"delist", h, re.I) else "maturity" if re.search(r"matur", h, re.I)
                 else "issue" if re.search(r"issue|appoint|open", h, re.I) else None)
        f["stage"] = stage
        add_date("maturity", r"matur", [h])

    elif et == "auction":
        f["share_kind"] = ("promoter" if re.search(r"promoter", h, re.I)
                           else "ordinary" if re.search(r"ordinary|public|right|fractional", h, re.I) else None)
        um = re.search(r"([\d,]+(?:\.\d+)?)\s*(?:units|kitta|shares)", h, re.I)
        f["units"] = um[1] if um else None
        add_date("open", r"\bfrom\b", [h])

    elif et == "promoter_sale":
        um = re.search(r"([\d,]+(?:\.\d+)?)\s*(?:units|kitta|shares)", h, re.I)
        f["units"] = um[1] if um else None

    elif et == "lock_in_expiry":
        add_date("expiry", r"lock|conclu|end|expir|\bon\b", [h, b])
        groups = [g for g, pat in [("promoter", r"promoter"), ("employee", r"employee"),
                                   ("local", r"local|project affected"), ("public", r"\bpublic\b")]
                  if re.search(pat, h, re.I)]
        f["holder_groups"] = groups or None

    elif et == "merger_acquisition":
        f["kind"] = "acquisition" if re.search(r"acqui", h, re.I) else "merger"
        sm = re.search(r"swap ratio[^0-9]{0,15}(\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?)", both, re.I)
        f["swap_ratio"] = sm[1].replace(" ", "") if sm else None

    elif et == "incident":
        f.update(_incident(h))

    elif et == "market_roundup":
        f["popularity_list"] = is_popularity_list(h)

    return f


# Fields whose presence means "a specific pattern matched with its fields".
_KEY_FIELDS = {
    "dividend_proposed": ["bonus_pct", "cash_pct", "total_pct"],
    "dividend_approved": ["bonus_pct", "cash_pct", "total_pct"],
    "book_closure": ["book_close_date", "last_buy_date", "total_pct"],
    "right_share": ["stage", "ratio", "ratio_pct"],
    "agm": ["agm_date"],
    "quarterly_result": ["profit_change_pct", "profit_direction", "quarter"],
    "rating_change": ["direction"],
    "ipo_fpo": ["stage"],
    "debenture": ["stage"],
    "auction": ["share_kind"],
    "incident": ["kind"],
    "price_adjustment": ["reason"],
    "merger_acquisition": ["kind"],
    # these carry no numbers; the pattern match itself is the evidence
    "bonus_listed": [], "lock_in_expiry": [], "promoter_sale": [], "csr": [],
    "management_change": [], "investment_or_expansion": [], "business_update": [],
}


def action_for(event_type: str, fields: dict) -> tuple[str | None, str | None]:
    """(action_date, action_kind): the date the investor must act by or be aware of."""
    g = fields.get
    if event_type == "book_closure":
        if g("last_buy_date"):
            return g("last_buy_date"), "last_buy_day"
        if g("book_close_date"):
            return g("book_close_date"), "book_closure"
    if event_type in ("dividend_proposed", "dividend_approved"):
        if g("book_close_date"):
            return g("book_close_date"), "book_closure"
    if event_type == "right_share":
        if g("close_date"):
            return g("close_date"), "issue_close"
        if g("book_close_date"):
            return g("book_close_date"), "book_closure"
        if g("open_date"):
            return g("open_date"), "issue_open"
    if event_type == "agm" and g("agm_date"):
        return g("agm_date"), "agm"
    if event_type == "ipo_fpo":
        if g("close_date"):
            return g("close_date"), "issue_close"
        if g("open_date"):
            return g("open_date"), "issue_open"
    if event_type == "lock_in_expiry" and g("expiry_date"):
        return g("expiry_date"), "lock_in_end"
    if event_type == "auction" and g("open_date"):
        return g("open_date"), "auction_open"
    return None, None


# ---------------------------------------------------------------------------
# Is the item about this symbol's company at all?
# ---------------------------------------------------------------------------

_GENERIC_NAME_WORDS = {"limited", "ltd", "ltd.", "company", "co.", "co", "public", "pvt", "private", "the"}
_SUBSIDIARY_WORDS = {"capital", "investment", "foundation", "securities", "mutual", "fund", "80-20",
                     "microfinance", "merchant", "asset", "equity", "growth", "balanced", "ace"}
_EXTRA_ALIASES = {"NTC": ["nepal telecom", "ntc"], "NICA": ["nic asia bank"], "NIMB": ["nimb bank"]}


def load_aliases(path: str = SYMBOL_MAP_PATH) -> dict[str, list[str]]:
    """symbol -> lowercase company name variants, from db/company_symbol_map.json."""
    aliases: dict[str, set[str]] = {}
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError):
        data = {}
    for section in data.values():
        if not isinstance(section, dict):
            continue
        for name, sym in section.items():
            if isinstance(sym, str):
                aliases.setdefault(sym.upper(), set()).add(name.lower())
    for sym, extra in _EXTRA_ALIASES.items():
        aliases.setdefault(sym, set()).update(extra)
    return {k: sorted(v) for k, v in aliases.items()}


def _clean_name(name: str) -> list[str]:
    words = [w for w in re.split(r"[\s,]+", name.lower()) if w]
    while words and words[-1] in _GENERIC_NAME_WORDS:
        words.pop()
    return words


def subject_matches(text: str, symbol: str, aliases: dict[str, list[str]]) -> bool | None:
    """True when the text names this company (symbol, full name, or its first two
    name words not followed by a subsidiary word such as 'Capital'). None when no
    name is known for the symbol."""
    if not text or not symbol:
        return None
    low = re.sub(r"[’']s\b", "", text.lower())
    low = re.sub(r"\s+", " ", low)

    def not_subsidiary(end: int) -> bool:
        # "NIC Asia Capital", "NIMB Ace Capital": a group company, not the listed one
        nxt = [w.strip(".,;:'\"“”") for w in low[end:].split()[:2]]
        return not any(w in _SUBSIDIARY_WORDS for w in nxt)

    names = aliases.get(symbol.upper(), [])
    for name in names:
        words = _clean_name(name)
        if words and len(words) >= 2 and re.search(rf"\b{re.escape(' '.join(words))}\b", low):
            return True
    for m in re.finditer(rf"(?<![a-z0-9]){re.escape(symbol.lower())}(?![a-z0-9])", low):
        if not_subsidiary(m.end()):
            return True
    if not names:
        return None
    for name in names:
        words = _clean_name(name)
        if not words:
            continue
        if len(words) >= 2:
            for m in re.finditer(rf"\b{re.escape(' '.join(words[:2]))}\b", low):
                if not_subsidiary(m.end()):
                    return True
        elif len(words[0]) >= 4:
            for m in re.finditer(rf"\b{re.escape(words[0])}\b", low):
                if not_subsidiary(m.end()):
                    return True
    return False


def named_company(text: str, aliases: dict[str, list[str]]) -> str | None:
    """The one listed company whose full name (two or more words, 'Limited' etc.
    dropped) appears in the text. The longest name wins, so 'Mid Solu Hydropower'
    beats 'Solu Hydropower'. None when no name matches or two different companies
    tie for the longest match."""
    if not text:
        return None
    low = re.sub(r"\s+", " ", re.sub(r"[’']s\b", "", text.lower()))
    best_len, best = 0, set()
    for sym, names in aliases.items():
        for name in names:
            words = _clean_name(name)
            if len(words) < 2:
                continue
            phrase = " ".join(words)
            if re.search(rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])", low):
                if len(phrase) > best_len:
                    best_len, best = len(phrase), {sym}
                elif len(phrase) == best_len:
                    best.add(sym)
    return next(iter(best)) if len(best) == 1 else None


_TICKER_RE = re.compile(r"\(([A-Z][A-Z0-9]{1,9})\)")
_NON_TICKER_ACRONYMS = {
    "AGM", "SGM", "BOD", "CEO", "NEPSE", "SEBON", "NRB", "EPS", "NAV", "IPO", "FPO", "CSR"
}


def body_segment_for_symbol(body: str, symbol: str) -> tuple[str | None, bool | None]:
    """Multi-company articles ('Last trading day to secure dividend of five
    companies') describe each company after its '(TICKER)'. Return the part of
    the body about this symbol and whether the symbol appears at all.
    (None, False) when the body covers other companies only."""
    if not body:
        return None, None
    marks = [(m.start(), m[1]) for m in _TICKER_RE.finditer(body) if m[1] not in _NON_TICKER_ACRONYMS]
    tickers = {t for _, t in marks}
    if not tickers:
        return body, None
    if symbol not in tickers:
        return None, False
    if len(tickers) == 1:
        return body, True
    start = next(pos for pos, t in marks if t == symbol)
    nxt = next((pos for pos, t in marks if pos > start and t != symbol), len(body))
    # start from the beginning of the line holding the marker
    line_start = body.rfind("\n", 0, start) + 1
    return body[line_start:nxt], True


# ---------------------------------------------------------------------------
# Article bodies (polite fetching with a cache)
# ---------------------------------------------------------------------------

def article_id(link: str) -> str:
    return hashlib.sha1((link or "").strip().encode("utf-8")).hexdigest()[:16]


def parse_article_body(html: str) -> str:
    """ShareSansar article text lives in #newsdetail-content (first one)."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "lxml")
    el = soup.select_one("#newsdetail-content")
    if el is None:
        return ""
    for tag in el(["script", "style"]):
        tag.decompose()
    lines = [ln.strip() for ln in el.get_text("\n").split("\n")]
    return "\n".join(ln for ln in lines if ln)


class BodyFetcher:
    def __init__(self, enabled: bool, max_fetch: int, cache_dir: str = BODY_CACHE_DIR):
        self.enabled = enabled
        self.max_fetch = max_fetch
        self.cache_dir = cache_dir
        self.fetched = 0
        self.failed = 0
        self._last = 0.0
        self._client = None

    def cached(self, aid: str) -> str | None:
        path = os.path.join(self.cache_dir, f"{aid}.txt")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as fh:
                return fh.read()
        return None

    def get(self, aid: str, link: str) -> str | None:
        cached = self.cached(aid)
        if cached is not None:
            return cached
        if not self.enabled or self.fetched >= self.max_fetch or not link:
            return None
        import httpx
        from scrape_sharesansar_news import HEADERS
        wait = FETCH_MIN_INTERVAL_S - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        self._last = time.monotonic()
        self.fetched += 1
        try:
            if self._client is None:
                self._client = httpx.Client(headers=HEADERS, timeout=20, follow_redirects=True)
            resp = self._client.get(link)
            resp.raise_for_status()
            text = parse_article_body(resp.text)
        except Exception as e:  # network or layout problem: skip this item, keep going
            self.failed += 1
            print(f"  body fetch failed for {link}: {e}")
            return None
        os.makedirs(self.cache_dir, exist_ok=True)
        with open(os.path.join(self.cache_dir, f"{aid}.txt"), "w", encoding="utf-8") as fh:
            fh.write(text)
        return text

    def close(self):
        if self._client is not None:
            self._client.close()


# ---------------------------------------------------------------------------
# Build records
# ---------------------------------------------------------------------------

def _needs_body(event_type: str, fields: dict) -> bool:
    if event_type not in DATE_SENSITIVE_TYPES:
        return False
    if event_type == "agm":
        return not fields.get("agm_date")
    if event_type == "book_closure":
        return not fields.get("book_close_date")
    if event_type == "right_share":
        return not (fields.get("book_close_date") or fields.get("close_date"))
    return not fields.get("book_close_date")


def build_record(symbol: str, item: dict, aliases: dict, fetcher: BodyFetcher | None,
                 today: date) -> dict:
    """Builds the event record. The news scraper searches by ticker, so an item can be
    filed under the wrong company (Mid Solu Hydropower news under SHL because 'MSHL'
    contains 'SHL'). When the headline is not about `symbol` but names exactly one
    other listed company, the record is moved to that company and `filed_under`
    keeps the original symbol."""
    rec = _build_record(symbol, item, aliases, fetcher, today)
    if rec["subject_match"] is False and not rec["is_roundup"]:
        other = named_company(rec["headline"], aliases)
        if other and other != symbol:
            moved = _build_record(other, item, aliases, fetcher, today)
            if moved["subject_match"] is True:
                moved["filed_under"] = symbol
                return moved
    return rec


def _build_record(symbol: str, item: dict, aliases: dict, fetcher: BodyFetcher | None,
                  today: date) -> dict:
    headline = (item.get("headline") or "").strip()
    link = (item.get("link") or "").strip()
    iso = parse_any_date(item.get("date"))
    if iso is None:
        m = re.search(r"-(\d{4}-\d{2}-\d{2})/?$", link)
        iso = m[1] if m else None
    aid = article_id(link or headline)
    event_type = classify(headline)
    roundup = event_type == "market_roundup"
    fields = extract_fields(headline, None, event_type, iso, symbol)
    subject = None if roundup else subject_matches(headline, symbol, aliases)
    body_used = False

    if fetcher and _needs_body(event_type, fields):
        recent = iso and (today - date.fromisoformat(iso)).days <= FETCH_MAX_AGE_DAYS
        body = fetcher.cached(aid) if not recent else fetcher.get(aid, link)
        if body:
            segment, in_body = body_segment_for_symbol(body, symbol)
            if in_body is False:
                subject = False
            elif segment:
                if in_body:
                    subject = True
                fields = extract_fields(headline, segment, event_type, iso, symbol)
                body_used = True

    if fields.get("symbol_listed_in_headline") is False:
        subject = False

    action_date, action_kind = action_for(event_type, fields)
    keys = _KEY_FIELDS.get(event_type)
    has_fields = keys is not None and (not keys or any(fields.get(k) is not None for k in keys))
    confidence = "high" if (has_fields and subject is not False and event_type != "other") else "low"
    if confidence == "low":
        action_date, action_kind = None, None

    return {
        "id": aid,
        "symbol": symbol,
        "event_type": event_type,
        "headline": headline,
        "date": iso,
        "link": link,
        "fields": fields,
        "action_date": action_date,
        "action_kind": action_kind,
        "is_roundup": roundup,
        "subject_match": subject,
        "body_used": body_used,
        "confidence": confidence,
    }


def build_events(news: dict, aliases: dict, fetcher: BodyFetcher | None, today: date) -> list[dict]:
    records, seen = [], set()
    for symbol, items in news.items():
        if not isinstance(items, list):
            continue
        for item in items:
            if isinstance(item, dict) and item.get("headline"):
                rec = build_record(symbol.upper(), item, aliases, fetcher, today)
                key = (rec["id"], rec["symbol"])
                if key in seen:  # a moved item the correct company already had
                    continue
                seen.add(key)
                records.append(rec)
    records.sort(key=lambda r: (r["date"] or "", r["symbol"]), reverse=True)
    return records


def summarize(records: list[dict]) -> dict:
    counts: dict[str, int] = {}
    for r in records:
        counts[r["event_type"]] = counts.get(r["event_type"], 0) + 1
    non_roundup = [r for r in records if not r["is_roundup"]]
    other = sum(1 for r in non_roundup if r["event_type"] == "other")
    return {
        "total": len(records),
        "by_type": dict(sorted(counts.items(), key=lambda kv: -kv[1])),
        "non_roundup": len(non_roundup),
        "other": other,
        "other_share": round(other / len(non_roundup), 4) if non_roundup else 0.0,
        "high_confidence": sum(1 for r in records if r["confidence"] == "high"),
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Extract structured events from db/news.json (rule-based).")
    ap.add_argument("--no-fetch", action="store_true", help="Do not fetch article bodies (cache still used)")
    ap.add_argument("--max-fetch", type=int, default=25, help="Max article pages fetched per run (default 25)")
    ap.add_argument("--input", default=NEWS_PATH)
    ap.add_argument("--output", default=OUT_PATH)
    args = ap.parse_args(argv)

    try:
        with open(args.input, "r", encoding="utf-8") as fh:
            news = json.load(fh)
    except (OSError, json.JSONDecodeError) as e:
        print(f"Cannot read {args.input}: {e}")
        return 1

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    fetcher = BodyFetcher(enabled=not args.no_fetch, max_fetch=max(args.max_fetch, 0))
    try:
        records = build_events(news, load_aliases(), fetcher, date.today())
    finally:
        fetcher.close()

    stats = summarize(records)
    out = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "stats": {**stats, "bodies_fetched": fetcher.fetched, "body_fetch_failures": fetcher.failed},
        "events": records,
    }
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    tmp = args.output + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2, ensure_ascii=False)
    os.replace(tmp, args.output)

    print(f"Wrote {stats['total']} events to {args.output}")
    print(f"  other: {stats['other']}/{stats['non_roundup']} non-roundup items "
          f"({stats['other_share'] * 100:.1f}%), high confidence: {stats['high_confidence']}, "
          f"bodies fetched: {fetcher.fetched}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
