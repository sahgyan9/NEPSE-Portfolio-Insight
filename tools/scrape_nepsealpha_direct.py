"""
NepseAlpha Direct Scraper (no Firecrawl, no API key)
====================================================
Fetches quarterly fundamentals (8 quarters of TTM ratios) and the unaudited
quarterly financial report (balance sheet, ~5 quarters) for a NEPSE symbol
directly from NepseAlpha, the same way the dividend scraper talks to
NepaliPaisa: plain HTTP requests, structured data, zero LLM extraction.

How it works (discovered by inspecting the site's own network traffic):

1. RATIOS — ``https://nepsealpha.com/search?isBrk=1&mobile_app=1&q=<SYM>``
   is a server-rendered Inertia.js page. The full quarterly dataset is
   embedded in the HTML as an HTML-escaped JSON attribute (``props``):
     - ``quartesGrowths``:   16 particulars x 8 quarters (roe_ttm, eps_ttm,
                             bvps, net_profit_ttm, revenue_ttm, *_yoy_growth...)
     - ``otherQuartGrowths``: PE / PB / PS ratio per quarter
     - ``masterData``:       shares outstanding (used to derive BVPS/share)
     - ``stock_info``:       sector name
2. BALANCE SHEET — ``https://nepsealpha.com/ajax/financials-menu/<SYM>``
   returns ``{"html": ...}`` containing the 'Unaudited Quarterly Financial
   Report' table. Parsed with a small stdlib HTMLParser (no bs4 needed).

Output is written as the SAME two markdown files the Firecrawl pipeline
produced, so the existing ``tools/parse_nepsealpha_md.py`` works unchanged:
    .tmp/<SYMBOL>_fundamentals.md
    .tmp/<SYMBOL>_financials.md

Usage:
    python tools/scrape_nepsealpha_direct.py              # all portfolio symbols
    python tools/scrape_nepsealpha_direct.py NABIL
    python tools/scrape_nepsealpha_direct.py NABIL UPPER CBBL
    (then run: python tools/parse_nepsealpha_md.py <SYMBOL>)
"""

import argparse
import html as html_lib
import json
import os
import re
import sys
import time
from html.parser import HTMLParser

import httpx

# curl_cffi impersonates a real Chrome TLS fingerprint, which reliably gets
# past NepseAlpha's Cloudflare bot-check (plain httpx/requests get 403'd
# because their TLS handshake looks scripted). We prefer it when installed and
# fall back to httpx otherwise.
try:
    from curl_cffi import requests as _cc
    HAVE_CURL_CFFI = True
except ImportError:
    _cc = None
    HAVE_CURL_CFFI = False

IMPERSONATE = "chrome"  # curl_cffi browser profile to mimic

# Anchor paths to the project root so the script works from any directory
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP_DIR = os.path.join(ROOT, ".tmp")
PORTFOLIO_PATH = os.path.join(ROOT, "db", "portfolio.json")

SEARCH_URL = "https://nepsealpha.com/search"
AJAX_URL = "https://nepsealpha.com/ajax/financials-menu/{symbol}"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    # Browser-fidelity headers: NepseAlpha sits behind Cloudflare, which
    # intermittently 403s clients that don't look like real browsers,
    # especially after bursts of requests.
    "Referer": "https://nepsealpha.com/",
    "sec-ch-ua": '"Chromium";v="126", "Google Chrome";v="126", "Not.A/Brand";v="8"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Upgrade-Insecure-Requests": "1",
}
REQUEST_DELAY_SEC = 1.0
TIMEOUT = 30
# Retry on Cloudflare 403/429/5xx: waits between attempts (seconds)
RETRY_WAITS = [0, 5, 15]


def make_client():
    """Return an HTTP client that looks like a real browser to Cloudflare.

    Uses curl_cffi (Chrome TLS impersonation) when available, else httpx.
    Both support .get(...) and a context manager, and both return a response
    exposing .status_code / .text / .json() / .raise_for_status().
    """
    if HAVE_CURL_CFFI:
        return _cc.Session()
    return httpx.Client()


def get_with_retry(client, url: str, *, params=None, headers=None):
    """GET with polite retries for Cloudflare rate-limit style rejections."""
    last_exc = None
    for i, wait in enumerate(RETRY_WAITS):
        if wait:
            time.sleep(wait)
        try:
            if HAVE_CURL_CFFI:
                r = client.get(url, params=params, headers=headers or HEADERS,
                               timeout=TIMEOUT, allow_redirects=True,
                               impersonate=IMPERSONATE)
            else:
                r = client.get(url, params=params, headers=headers or HEADERS,
                               timeout=TIMEOUT, follow_redirects=True)
            if r.status_code in (403, 429) or r.status_code >= 500:
                last_exc = RuntimeError(f"HTTP {r.status_code} (attempt {i + 1})")
                continue
            r.raise_for_status()
            return r
        except Exception as e:
            last_exc = e
    raise last_exc

# Maps quartesGrowths 'particulars' -> (display row label, value kind)
# kinds: pct (x100 + ' %'), num (2dp), cr (/1e7 + ' Cr.'), bvps (/shares)
RATIO_ROWS = [
    ("roe_ttm",            "ROE TTM",            "pct"),
    ("roa_ttm",            "ROA TTM",            "pct"),
    ("net_margin_ttm",     "Net Margin TTM",     "pct"),
    ("asset_turnover_ttm", "Asset Turnover TTM", "pct"),
]
# Rows that carry a paired YOY growth particular (rendered as
# 'val<br> <br> yoy %' exactly like the broker widget / old pipeline)
YOY_ROWS = [
    ("eps_ttm",             "eps_yoy_growth",            "EPS TTM",             "num"),
    ("bvps",                "bvps_yoy_growth",           "BVPS",                "bvps"),
    ("net_profit_till_qtr", "netprofitqtrly_yoy_growth", "Net Profit Till Qtr", "cr"),
    ("revenue_till_qtr",    "revenuetillqtr_yoy_growth", "Revenue Till Qtr",    "cr"),
    ("net_profit_ttm",      "netprofitttmqtrl_yoy_growth", "Net Profit TTM",    "cr"),
    ("revenue_ttm",         "revenuettm_yoy_growth",     "Revenue TTM",         "cr"),
]


# ──────────────────────────────────────────────────────────────────────────────
# Fetch + extract embedded Inertia props JSON from the search page
# ──────────────────────────────────────────────────────────────────────────────

def fetch_props(client: httpx.Client, symbol: str) -> dict:
    params = {"isBrk": 1, "mobile_app": 1, "q": symbol, "theme": "light"}
    r = get_with_retry(client, SEARCH_URL, params=params)
    text = r.text

    marker = "&quot;props&quot;"
    idx = text.find(marker)
    if idx == -1:
        raise RuntimeError("No embedded props JSON found (page layout changed?)")

    attr_start = text.rfind('="', 0, idx) + 2
    attr_end = text.find('"', attr_start)
    payload = html_lib.unescape(text[attr_start:attr_end])
    page = json.loads(payload)
    return page.get("props", {})


def fetch_financials_html(client: httpx.Client, symbol: str) -> str:
    url = AJAX_URL.format(symbol=symbol)
    headers = dict(HEADERS)
    headers["X-Requested-With"] = "XMLHttpRequest"
    headers["Accept"] = "application/json"
    headers["Sec-Fetch-Dest"] = "empty"
    headers["Sec-Fetch-Mode"] = "cors"
    r = get_with_retry(client, url, headers=headers)
    return (r.json() or {}).get("html", "")


# ──────────────────────────────────────────────────────────────────────────────
# Minimal stdlib table extractor for the ajax HTML fragment
# ──────────────────────────────────────────────────────────────────────────────

class _TableExtractor(HTMLParser):
    """Extracts every <table> as a list of rows, each row a list of cell texts."""

    def __init__(self):
        super().__init__()
        self.tables = []
        self._rows = None
        self._cells = None
        self._buf = None
        self._depth = 0

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self._depth += 1
            if self._depth == 1:
                self._rows = []
        elif self._depth == 1 and tag == "tr":
            self._cells = []
        elif self._depth == 1 and tag in ("td", "th"):
            self._buf = []

    def handle_endtag(self, tag):
        if tag == "table":
            if self._depth == 1 and self._rows is not None:
                self.tables.append(self._rows)
                self._rows = None
            self._depth = max(0, self._depth - 1)
        elif self._depth == 1 and tag == "tr":
            if self._cells is not None:
                self._rows.append(self._cells)
            self._cells = None
        elif self._depth == 1 and tag in ("td", "th"):
            if self._buf is not None and self._cells is not None:
                text = re.sub(r"\s+", " ", "".join(self._buf)).strip()
                self._cells.append(text)
            self._buf = None

    def handle_data(self, data):
        if self._buf is not None:
            self._buf.append(data)


def parse_financials_table(fragment_html: str):
    """Returns (header_cells, data_rows) for the 'Particular' table, or None."""
    parser = _TableExtractor()
    parser.feed(fragment_html)
    for rows in parser.tables:
        hdr_i = next((i for i, r in enumerate(rows)
                      if r and "Particular" in r[0]), None)
        if hdr_i is None:
            continue
        header = rows[hdr_i]
        # Drop trailing 'Chart' column if present
        drop_last = bool(header) and header[-1].strip().lower() == "chart"
        if drop_last:
            header = header[:-1]
        data = []
        for r in rows[hdr_i + 1:]:
            if not r or not r[0]:
                continue
            row = r[:-1] if drop_last and len(r) == len(header) + 1 else r
            data.append(row)
        return header, data
    return None


# ──────────────────────────────────────────────────────────────────────────────
# Markdown generation (byte-compatible with what parse_nepsealpha_md.py expects)
# ──────────────────────────────────────────────────────────────────────────────

def _fy_q_key(fy: str, q) -> tuple:
    return (fy, int(q))


def _fmt(value, kind, shares):
    if value is None:
        return "-"
    if kind == "pct":
        # NepseAlpha stores an exact 0.0 as a sentinel for "not applicable"
        # (e.g. ROE of loss-making companies) — its own widget renders '-'.
        # A real ratio is never exactly 0.0 at full float precision.
        if value == 0:
            return "-"
        return f"{value * 100:.2f} %"
    if kind == "cr":
        return f"{value / 1e7:,.2f} Cr."
    if kind == "bvps":
        if not shares:
            return "-"
        return f"{value / shares:.2f}"
    return f"{value:.2f}"


def build_fundamentals_md(props: dict, symbol: str) -> str:
    growths = props.get("quartesGrowths") or []
    pepbps = props.get("otherQuartGrowths") or []
    master = props.get("masterData") or {}
    stock_info = props.get("stock_info") or {}
    shares = master.get("shares_outstnading") or 0
    sector = stock_info.get("formatted_sector") or stock_info.get("sector") or "unknown"

    if not growths:
        return ""

    # index values: {(fy, q): {particular: value}}, quarters sorted oldest→newest
    by_quarter = {}
    date_to_quarter = {}
    for item in growths:
        key = _fy_q_key(item.get("fiscal_year", ""), item.get("quarter", 0))
        by_quarter.setdefault(key, {})[item.get("particulars")] = item.get("value")
        if item.get("financial_date"):
            date_to_quarter[item["financial_date"]] = key

    quarters = sorted(by_quarter.keys())

    # PE/PB/PS come as a separate array keyed by financial date
    ratios_by_quarter = {}
    for row in pepbps:
        key = date_to_quarter.get(row.get("date"))
        if key:
            ratios_by_quarter[key] = row

    def header_label(key):
        return f"{key[0]}Q{key[1]}"

    lines = []
    lines.append(f"# {stock_info.get('full_name') or symbol} ({symbol})")
    lines.append("")
    lines.append(f"Sector:<br>_{sector}_")
    lines.append("")
    lines.append("| Particular | " + " | ".join(header_label(k) for k in quarters) + " |")
    lines.append("| --- |" + " --- |" * len(quarters))

    for attr, label in (("pe_ratio", "PE Ratio"), ("pb_ratio", "PB Ratio"), ("ps", "PS Ratio")):
        cells = []
        for k in quarters:
            v = (ratios_by_quarter.get(k) or {}).get(attr)
            cells.append(f"{v:.2f}" if isinstance(v, (int, float)) else "-")
        lines.append(f"| {label} | " + " | ".join(cells) + " |")

    for particular, label, kind in RATIO_ROWS:
        cells = [_fmt(by_quarter[k].get(particular), kind, shares) for k in quarters]
        lines.append(f"| {label} | " + " | ".join(cells) + " |")

    for particular, yoy_particular, label, kind in YOY_ROWS:
        cells = []
        for k in quarters:
            val = _fmt(by_quarter[k].get(particular), kind, shares)
            yoy = by_quarter[k].get(yoy_particular)
            # same sentinel rule: exact 0.0 growth means "not available"
            yoy_txt = (f"{yoy * 100:.2f} %"
                       if isinstance(yoy, (int, float)) and yoy != 0 else "-")
            cells.append(f"{val}<br> <br> {yoy_txt}")
        lines.append(f"| {label}<br> <br> YOY | " + " | ".join(cells) + " |")

    lines.append("")
    return "\n".join(lines)


def build_financials_md(fragment_html: str) -> str:
    parsed = parse_financials_table(fragment_html)
    if not parsed:
        return ""
    header, rows = parsed
    lines = []
    lines.append("| " + " | ".join(header) + " |")
    lines.append("| --- |" + " --- |" * (len(header) - 1))
    for row in rows:
        # pad/truncate to header width so the table stays rectangular
        cells = (row + [""] * len(header))[:len(header)]
        cells = [c if c.strip() else "-" for c in cells]
        lines.append("| " + " | ".join(cells) + " |")
    lines.append("")
    return "\n".join(lines)


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def scrape_symbol(client: httpx.Client, symbol: str) -> bool:
    symbol = symbol.upper()
    os.makedirs(TMP_DIR, exist_ok=True)
    out_fund = os.path.join(TMP_DIR, f"{symbol}_fundamentals.md")
    out_fin = os.path.join(TMP_DIR, f"{symbol}_financials.md")

    ok = True

    # ── Fundamentals / ratios ────────────────────────────────────────────────
    try:
        props = fetch_props(client, symbol)
        md = build_fundamentals_md(props, symbol)
        if md:
            with open(out_fund, "w", encoding="utf-8") as f:
                f.write(md)
            print(f"  {symbol}: fundamentals table written ({out_fund})")
        else:
            with open(out_fund, "w", encoding="utf-8") as f:
                f.write(f"# No fundamentals table available for {symbol}\n")
            print(f"  {symbol}: no ratio data on NepseAlpha — parser will use financials-only fallback")
    except Exception as e:
        ok = False
        print(f"  {symbol}: fundamentals FAILED ({e})")
        with open(out_fund, "w", encoding="utf-8") as f:
            f.write(f"# No fundamentals table available for {symbol}\n")

    # ── Balance sheet / quarterly financial report ───────────────────────────
    try:
        fragment = fetch_financials_html(client, symbol)
        md = build_financials_md(fragment)
        if md:
            with open(out_fin, "w", encoding="utf-8") as f:
                f.write(md)
            print(f"  {symbol}: financials table written ({out_fin})")
        else:
            with open(out_fin, "w", encoding="utf-8") as f:
                f.write("# No financials data available\n")
            print(f"  {symbol}: no financials table (non-fatal)")
    except Exception as e:
        print(f"  {symbol}: financials FAILED ({e}) — non-fatal, skipping balance sheet")
        with open(out_fin, "w", encoding="utf-8") as f:
            f.write("# No financials data available\n")

    return ok


def load_portfolio_symbols():
    try:
        with open(PORTFOLIO_PATH, "r", encoding="utf-8-sig") as f:
            portfolio = json.load(f)
        return sorted({h["symbol"].upper() for h in portfolio.get("holdings", [])})
    except Exception as e:
        print(f"Could not read portfolio ({e}).")
        return []


def main():
    parser = argparse.ArgumentParser(
        description="Scrape NepseAlpha quarterly data directly (no Firecrawl/API key).")
    parser.add_argument("symbols", nargs="*",
                        help="Stock symbols (e.g. NABIL UPPER). Default: all portfolio holdings.")
    args = parser.parse_args()

    symbols = [s.upper() for s in args.symbols] or load_portfolio_symbols()
    if not symbols:
        print("No symbols to fetch. Pass symbols explicitly, e.g.: "
              "python tools/scrape_nepsealpha_direct.py NABIL")
        sys.exit(1)

    failures = []
    with make_client() as client:
        for i, symbol in enumerate(symbols):
            print(f"Scraping {symbol.upper()} from NepseAlpha (direct)...")
            if not scrape_symbol(client, symbol):
                failures.append(symbol.upper())
            if i < len(symbols) - 1:
                time.sleep(REQUEST_DELAY_SEC)

    if failures:
        print(f"\nFailed symbols: {', '.join(failures)}")
    sys.exit(0 if not failures else 2)


if __name__ == "__main__":
    main()
