"""
pdf_parser.py
=============
Sector-aware quarterly PDF extractor for NEPSE company reports.

Supports: Hydro Power (NFRS format — Sahas Urja style)
Future:   Banks, Microfinance, Manufacturing

Key design decisions:
- Detection is ENTIRELY text-based. Filename is IGNORED.
- Quarter and FY extracted from PDF body text patterns
- Company name matched against db/company_symbol_map.json
- All extracted values stored in raw NRs (no unit conversion ambiguity)
- Computed metrics (EPS TTM, ROE, etc.) calculated at parse time
"""

import re
import os
import json
import pdfplumber
from datetime import datetime

# ── Path helpers ──────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SYMBOL_MAP_PATH = os.path.join(BASE_DIR, "db", "company_symbol_map.json")

# ── Nepali month → fiscal quarter mapping ────────────────────────────────────
# Nepal FY runs Shrawan (Jul) to Ashad (Jun)
NEPALI_MONTH_TO_QUARTER = {
    "shrawan": 1, "bhadra": 1, "ashwin": 1,
    "kartik": 2, "mangsir": 2, "poush": 2,
    "magh": 3, "falgun": 3, "chaitra": 3,
    "baisakh": 4, "jestha": 4, "ashad": 4,
}

# English quarter ordinals
QUARTER_ORDINALS = {
    "first": 1, "1st": 1,
    "second": 2, "2nd": 2,
    "third": 3, "3rd": 3,
    "fourth": 4, "4th": 4,
}


# ── Symbol map loader ─────────────────────────────────────────────────────────
def _load_symbol_map():
    try:
        with open(SYMBOL_MAP_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        # Flatten all sectors into one lookup
        combined = {}
        for sector, mapping in data.items():
            if isinstance(mapping, dict):
                for name_key, sym in mapping.items():
                    combined[name_key.lower()] = {"symbol": sym, "sector": sector}
        return combined
    except Exception as e:
        print(f"[pdf_parser] Warning: Could not load symbol map: {e}")
        return {}


# ── Text extraction ───────────────────────────────────────────────────────────
def extract_full_text(pdf_path: str) -> str:
    """Extract all text from all pages of a PDF."""
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text


# ── Company detection ─────────────────────────────────────────────────────────
def detect_company(text: str) -> dict:
    """
    Identify company symbol and sector from PDF text.
    Looks at the first few lines for the company name.
    Returns: {"symbol": "SAHAS", "sector": "hydro", "company_name": "Sahas Urja Ltd."}
    """
    symbol_map = _load_symbol_map()
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    # Check first 5 non-empty lines for company name
    company_name = lines[0] if lines else "Unknown"
    name_lower = company_name.lower()

    for key, info in symbol_map.items():
        if key in name_lower:
            return {
                "symbol": info["symbol"],
                "sector": info["sector"],
                "company_name": company_name,
                "detected": True,
            }

    # Fallback: try broader search in first 200 chars
    snippet = text[:200].lower()
    for key, info in symbol_map.items():
        if key in snippet:
            return {
                "symbol": info["symbol"],
                "sector": info["sector"],
                "company_name": company_name,
                "detected": True,
            }

    return {
        "symbol": None,
        "sector": "hydro",  # default assumption
        "company_name": company_name,
        "detected": False,
    }


# ── Quarter / FY detection ────────────────────────────────────────────────────
def detect_quarter_and_fy(text: str) -> dict:
    """
    Auto-detect fiscal year and quarter number from PDF body text.

    Patterns handled:
    1. "2nd Quarter FY 2082/83"
    2. "3rd Quarter FY 2082/83"
    3. "30th Chaitra, 2082 … 3rd Quarter"
    4. "As on 30th Poush, 2082 … 2nd Quarter FY 2082/83"

    Returns: {"fy": "2082-83", "quarter": 3, "quarter_label": "Q3 FY 2082/83",
              "period_end_date": "2026-04-13", "period_end_text": "30th Chaitra, 2082"}
    """
    result = {
        "fy": None,
        "quarter": None,
        "quarter_label": None,
        "period_end_date": None,
        "period_end_text": None,
    }

    # Pattern 1: "Xnd/rd/st/th Quarter FY YYYY/YY" anywhere in text
    m = re.search(
        r"(\d+(?:st|nd|rd|th)|first|second|third|fourth)\s+quarter\s+fy\s+(\d{4})/(\d{2,4})",
        text, re.IGNORECASE
    )
    if m:
        q_str = m.group(1).lower().replace("st","").replace("nd","").replace("rd","").replace("th","").strip()
        try:
            q_num = int(q_str)
        except ValueError:
            q_num = QUARTER_ORDINALS.get(q_str, None)
        fy_start = m.group(2)
        fy_end = m.group(3)
        if len(fy_end) == 2:
            fy_label = f"{fy_start}-{fy_end}"
        else:
            fy_label = f"{fy_start}-{fy_end[2:]}"
        result["fy"] = fy_label
        result["quarter"] = q_num
        result["quarter_label"] = f"Q{q_num} FY {fy_start}/{fy_end}"

    # Pattern 2: Nepali month name in "As on Xth MonthName, YYYY"
    m2 = re.search(
        r"as on\s+\d+(?:st|nd|rd|th)\s+([A-Za-z]+),?\s+(\d{4})",
        text, re.IGNORECASE
    )
    if m2:
        month = m2.group(1).lower()
        nep_year = int(m2.group(2))
        result["period_end_text"] = m2.group(0).replace("As on ", "").replace("as on ", "").strip()
        # Derive quarter from month
        q_from_month = NEPALI_MONTH_TO_QUARTER.get(month)
        if q_from_month and result["quarter"] is None:
            result["quarter"] = q_from_month
        # Derive FY: if month is Q1-Q3, FY start = nep_year; if Q4, FY start = nep_year-1... actually
        # Nepal FY 2082/83 starts Shrawan 2082 (Q1) ends Ashad 2083 (Q4)
        # So FY label = {nep_year}/{nep_year+1-2000} for Q1-Q3
        if q_from_month and q_from_month <= 3:
            fy_start = nep_year
        else:
            fy_start = nep_year - 1
        fy_end_2d = str(fy_start + 1)[-2:]
        if result["fy"] is None:
            result["fy"] = f"{fy_start}-{fy_end_2d}"

    # Build quarter_label if not already set
    if result["fy"] and result["quarter"] and not result["quarter_label"]:
        fy_parts = result["fy"].split("-")
        result["quarter_label"] = f"Q{result['quarter']} FY {fy_parts[0]}/{fy_parts[1]}"

    return result


# ── Value extractor helper ────────────────────────────────────────────────────
def _find_value_after(text: str, label: str, column: int = 0) -> float | None:
    """
    Find a numeric value on the same line as 'label' in the text.
    column=0 → first number (current quarter)
    column=1 → second number (prior quarter)
    column=2 → third number (prior year same quarter)

    SAHAS PDF text layout: label followed by 3 numbers on the same or next line.
    Example: "Total Assets 18,536,828,261 18,843,694,386 17,737,851,455"
    """
    # Build pattern: label followed by space(s) and numbers
    pattern = re.compile(
        re.escape(label.strip()) + r"[\s\n]*([\d,]+(?:\.\d+)?)",
        re.IGNORECASE
    )
    matches = list(re.finditer(pattern, text))
    if not matches:
        return None

    # Get all numbers after the first match of this label
    first_match = matches[0]
    # Find all numbers in a window of ~200 chars after the label
    window = text[first_match.start(): first_match.start() + 300]
    nums = re.findall(r"[\d,]+(?:\.\d+)?", window)
    nums = [float(n.replace(",", "")) for n in nums if len(n.replace(",", "")) >= 3]

    if column < len(nums):
        return nums[column]
    return None


def _find_value_strict(text: str, label: str, next_labels: list = None) -> list:
    """
    Extract the row of numbers for a given label line.
    Returns up to 3 column values: [current, prior_quarter, prior_year_same_quarter]
    next_labels: labels that mark the end of this section (to avoid grabbing wrong numbers)
    """
    # Find the line containing this label
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if re.search(re.escape(label), line, re.IGNORECASE):
            # Collect numbers from this line and potentially the next
            combined = line
            if i + 1 < len(lines):
                combined += " " + lines[i + 1]
            nums = re.findall(r"[\d,]+(?:\.\d+)?", combined)
            nums = [float(n.replace(",", "")) for n in nums
                    if len(n.replace(",", "").replace(".", "")) >= 3]
            return nums[:3]  # Max 3 columns
    return []


# ── Hydro-specific field extractor ────────────────────────────────────────────
def extract_hydro_fields(text: str) -> dict:
    """
    Extract all financial fields from a NEPSE hydro company quarterly PDF.
    Returns raw NRs values. Three columns: [current_q, prior_q, prior_year_same_q]
    """
    def get(label, col=0):
        vals = _find_value_strict(text, label)
        if col < len(vals):
            return vals[col]
        return None

    raw = {}

    # ── Balance Sheet ──────────────────────────────────────────────────────
    share_capital = [get("Share Capital", c) for c in range(3)]
    
    raw["reserve_surplus"] = [get("Reserve and Accumulated", c) for c in range(3)]
    
    raw["total_equity"] = [get("Total Shareholder", c) for c in range(3)]
    raw["share_capital"] = share_capital

    lt_loan = [get("Medium & Long Term Loan", c) or get("Medium .amp. Long Term Loan", c) or 0 for c in range(3)]
    bridge_loan = [get("Bridge Gap Loan", c) or 0 for c in range(3)]
    
    # Borrowings = Long Term Loan + Bridge Gap Loan (Consistently applied in portal)
    raw["lt_loan"] = [
        (lt_loan[i] + bridge_loan[i]) if (lt_loan[i] or bridge_loan[i]) else None
        for i in range(3)
    ]

    raw["current_liab"]         = [get("Total Current Liabilities", c) for c in range(3)]
    raw["current_assets"]       = [get("Total Current Assets", c) for c in range(3)]
    raw["total_assets"]         = [get("Total Assets", c) for c in range(3)]

    # ── P&L ───────────────────────────────────────────────────────────────
    rev_elec = [get("Revenue from Sale of Electricity", c) or 0 for c in range(3)]
    finance_inc = [get("Finance income", c) or 0 for c in range(3)]
    other_inc = [get("Other Income", c) or 0 for c in range(3)]
    
    # Total Revenue = Electricity + Finance + Other (Consistently applied in portal)
    raw["revenue"] = [
        (rev_elec[i] + finance_inc[i] + other_inc[i]) if rev_elec[i] else None
        for i in range(3)
    ]

    raw["gross_profit"]         = [get("Gross Profit", c) for c in range(3)]
    raw["operating_profit"]     = [get("Operating Profit", c) for c in range(3)]
    raw["finance_costs"]        = [get("Finance costs", c) or get("Finance Costs", c) for c in range(3)]
    raw["profit_before_tax"]    = [get("Profit Before Tax", c) for c in range(3)]
    raw["net_profit"]           = [get("Total Comprehensive Income", c) for c in range(3)]

    # Fallback: if Total Comprehensive Income not found, use Profit Before Tax
    for i in range(3):
        if raw["net_profit"][i] is None and raw["profit_before_tax"][i]:
            raw["net_profit"][i] = raw["profit_before_tax"][i]

    # ── Shares: derived from Share Capital (face value Rs 100) ────────────
    raw["shares"] = []
    for i in range(3):
        sc = raw["share_capital"][i]
        raw["shares"].append(round(sc / 100) if sc else None)

    return raw


# ── Metric computation ────────────────────────────────────────────────────────
def compute_metrics(raw: dict, quarter_num: int) -> dict:
    """
    Compute all derived metrics for column 0 (current quarter).
    quarter_num: 1, 2, 3, or 4 (number of quarters elapsed in FY)
    """
    def v(field):
        vals = raw.get(field, [None, None, None])
        return vals[0] if vals else None

    computed = {}
    np_ = v("net_profit")
    rev = v("revenue")
    eq  = v("total_equity")
    ast = v("total_assets")
    sh  = v("shares")
    gp  = v("gross_profit")
    op  = v("operating_profit")

    if np_ and quarter_num and quarter_num > 0:
        ann_np  = np_ * (4 / quarter_num)
        ann_rev = (rev * (4 / quarter_num)) if rev else None
    else:
        ann_np  = np_
        ann_rev = rev

    # EPS TTM (annualized)
    computed["eps_ttm"] = round(ann_np / sh, 2) if ann_np and sh else None
    # EPS reported (YTD, not annualized)
    computed["eps_reported"] = round(np_ / sh, 2) if np_ and sh else None
    # BVPS
    computed["bvps"] = round(eq / sh, 2) if eq and sh else None
    # ROE TTM
    computed["roe_ttm"] = round(ann_np / eq * 100, 2) if ann_np and eq else None
    # ROA TTM
    computed["roa_ttm"] = round(ann_np / ast * 100, 2) if ann_np and ast else None
    # Net Margin (YTD, ratio of two YTD figures – no annualization needed)
    computed["net_margin"] = round(np_ / rev * 100, 2) if np_ and rev else None
    # Gross Margin
    computed["gross_margin"] = round(gp / rev * 100, 2) if gp and rev else None
    # Operating Margin
    computed["operating_margin"] = round(op / rev * 100, 2) if op and rev else None
    # Asset Turnover TTM
    computed["asset_turnover"] = round(ann_rev / ast * 100, 2) if ann_rev and ast else None
    # Revenue TTM
    computed["revenue_ttm"] = round(ann_rev, 0) if ann_rev else None
    # Net Profit TTM
    computed["net_profit_ttm"] = round(ann_np, 0) if ann_np else None
    # ROE Reported (YTD, not annualized)
    computed["roe_reported"] = round(np_ / eq * 100, 2) if np_ and eq else None

    return computed


def compute_yoy(raw: dict) -> dict:
    """
    Compute YoY % change for column 0 (current Q) vs column 2 (prior year same Q).
    """
    yoy = {}
    fields = [
        "share_capital", "reserve_surplus", "total_equity", "lt_loan",
        "current_liab", "current_assets", "total_assets",
        "revenue", "gross_profit", "operating_profit", "net_profit", "shares",
    ]
    for field in fields:
        vals = raw.get(field, [None, None, None])
        curr = vals[0] if len(vals) > 0 else None
        prev = vals[2] if len(vals) > 2 else None
        if curr and prev and prev != 0:
            yoy[field] = round((curr - prev) / prev * 100, 2)
        else:
            yoy[field] = None
    return yoy


# ── Main parse function ───────────────────────────────────────────────────────
def parse_pdf(pdf_path: str, override_symbol: str = None, override_sector: str = None) -> dict:
    """
    Full pipeline: extract → detect → parse → compute.

    Returns a structured dict ready to be stored in quarterly_db.

    Raises ValueError if critical fields (fy, quarter) cannot be detected.
    """
    text = extract_full_text(pdf_path)

    # 1. Company detection
    company_info = detect_company(text)
    if override_symbol:
        company_info["symbol"] = override_symbol.upper()
    if override_sector:
        company_info["sector"] = override_sector

    # 2. Quarter / FY detection
    timing = detect_quarter_and_fy(text)
    if not timing["fy"] or not timing["quarter"]:
        raise ValueError(
            f"Could not detect fiscal year or quarter from PDF. "
            f"Detected so far: {timing}"
        )

    quarter_num = timing["quarter"]

    # 3. Extract raw financial fields (sector-specific)
    sector = (company_info.get("sector") or "hydro").lower()
    if "hydro" in sector:
        raw = extract_hydro_fields(text)
    else:
        # Future: bank, microfinance, manufacturing
        raw = extract_hydro_fields(text)  # fallback for now

    # 4. Compute derived metrics
    computed = compute_metrics(raw, quarter_num)
    yoy = compute_yoy(raw)

    # 5. Flatten current-quarter values for easy access
    def col0(field):
        vals = raw.get(field, [None, None, None])
        return vals[0] if vals else None

    result = {
        # Identity
        "symbol": company_info["symbol"],
        "sector": sector,
        "company_name": company_info["company_name"],
        "company_detected": company_info["detected"],
        # Timing
        "fy": timing["fy"],
        "quarter": quarter_num,
        "quarter_label": timing["quarter_label"],
        "period_end_text": timing.get("period_end_text"),
        # Metadata
        "parsed_at": datetime.now().isoformat(),
        "pdf_filename": os.path.basename(pdf_path),
        # Raw values (in NRs), current quarter
        "raw": {
            "share_capital":    col0("share_capital"),
            "reserve_surplus":  col0("reserve_surplus"),
            "total_equity":     col0("total_equity"),
            "lt_loan":          col0("lt_loan"),
            "current_liab":     col0("current_liab"),
            "current_assets":   col0("current_assets"),
            "total_assets":     col0("total_assets"),
            "revenue":          col0("revenue"),
            "gross_profit":     col0("gross_profit"),
            "operating_profit": col0("operating_profit"),
            "net_profit":       col0("net_profit"),
            "shares":           col0("shares"),
        },
        # Computed metrics
        "computed": computed,
        # YoY vs prior year same quarter
        "yoy": yoy,
        # All 3 columns of raw data (for re-computation or audit)
        "raw_all_columns": raw,
    }

    return result
