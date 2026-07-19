"""
NEPSE Data Server
=================
Flask server that provides NEPSE index data, market status, and stock fundamentals.

Run: python nepse_server.py
Endpoints:
    GET /health - Health check
    GET /api/index - Get NEPSE index data
    GET /api/indices - Get all indices (main + sub)
    GET /api/market-status - Get market open/close status
    GET /api/market-summary - Get full market summary
    GET /api/stock/<symbol> - Get stock fundamentals from Merolagani
    GET /api/stocks?symbols=X,Y,Z - Get multiple stock fundamentals
"""

from flask import Flask, jsonify, request
from nepse import AsyncNepse
import asyncio
import httpx
import os
import sys
import json
from bs4 import BeautifulSoup
import re
from datetime import datetime
from functools import wraps
import threading
import time
import tempfile
import traceback
import subprocess

# Quarterly PDF modules
try:
    from pdf_parser import parse_pdf
    from quarterly_db import (
        save_quarter, get_all_quarters, get_quarter,
        delete_quarter, list_symbols, get_summary,
        DuplicateQuarterError, load_symbol_data
    )
    QUARTERLY_ENABLED = True
except ImportError as e:
    print(f"[WARNING] Quarterly PDF module not available: {e}")
    QUARTERLY_ENABLED = False

app = Flask(__name__)

# Enable CORS
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Accept'
    return response


# ============================================================================
# NEPSE Index API
# ============================================================================

class NepseDataFetcher:
    """Fetches live NEPSE data with caching"""
    
    def __init__(self):
        self._nepse = AsyncNepse()
        self._nepse.setTLSVerification(False)
        self._cache = {}
        self._cache_ttl = 60  # Cache for 60 seconds
    
    def _is_cache_valid(self, key: str) -> bool:
        if key not in self._cache:
            return False
        cached_time = self._cache[key].get('timestamp', 0)
        return (time.time() - cached_time) < self._cache_ttl
    
    async def get_nepse_index(self):
        """Get main NEPSE index"""
        if self._is_cache_valid('nepse_index'):
            return self._cache['nepse_index']['data']
        
        try:
            raw_data = await asyncio.wait_for(self._nepse.getNepseIndex(), timeout=5.0)
            for idx in raw_data:
                if 'NEPSE Index' in idx.get('index', ''):
                    result = {
                        'name': idx.get('index'),
                        'value': idx.get('currentValue', 0),
                        'change': idx.get('change', 0),
                        'change_pct': idx.get('perChange', 0),
                        'high': idx.get('high', 0),
                        'low': idx.get('low', 0),
                        'previous_close': idx.get('previousClose', 0),
                        'source': 'live',
                        'timestamp': datetime.now().isoformat()
                    }
                    self._cache['nepse_index'] = {'data': result, 'timestamp': time.time()}
                    return result
            
            # Return first index if NEPSE Index not found
            if raw_data:
                idx = raw_data[0]
                result = {
                    'name': idx.get('index'),
                    'value': idx.get('currentValue', 0),
                    'change': idx.get('change', 0),
                    'change_pct': idx.get('perChange', 0),
                    'high': idx.get('high', 0),
                    'low': idx.get('low', 0),
                    'previous_close': idx.get('previousClose', 0),
                    'source': 'live',
                    'timestamp': datetime.now().isoformat()
                }
                self._cache['nepse_index'] = {'data': result, 'timestamp': time.time()}
                return result
        except Exception as e:
            print(f"Error fetching NEPSE index: {e}")
        
        return None
    
    async def get_all_indices(self):
        """Get all main and sub indices"""
        if self._is_cache_valid('all_indices'):
            return self._cache['all_indices']['data']
        
        try:
            main_raw = await asyncio.wait_for(self._nepse.getNepseIndex(), timeout=3.0)
            sub_raw = await asyncio.wait_for(self._nepse.getNepseSubIndices(), timeout=3.0)
            
            main_indices = []
            for idx in main_raw:
                main_indices.append({
                    'name': idx.get('index', 'Unknown'),
                    'value': idx.get('currentValue', 0),
                    'change': idx.get('change', 0),
                    'change_pct': idx.get('perChange', 0),
                    'high': idx.get('high', 0),
                    'low': idx.get('low', 0),
                    'previous_close': idx.get('previousClose', 0)
                })
            
            sub_indices = []
            for idx in sub_raw:
                sub_indices.append({
                    'name': idx.get('index', 'Unknown'),
                    'value': idx.get('currentValue', 0),
                    'change': idx.get('change', 0),
                    'change_pct': idx.get('perChange', 0),
                    'high': idx.get('high', 0),
                    'low': idx.get('low', 0),
                    'previous_close': idx.get('previousClose', 0)
                })
            
            result = {
                'main_indices': main_indices,
                'sub_indices': sub_indices,
                'source': 'live',
                'timestamp': datetime.now().isoformat()
            }
            self._cache['all_indices'] = {'data': result, 'timestamp': time.time()}
            return result
        except Exception as e:
            print(f"Error fetching indices: {e}")
        
        return {'main_indices': [], 'sub_indices': [], 'source': 'error'}
    
    async def get_market_status(self):
        """Get market open/close status"""
        if self._is_cache_valid('market_status'):
            return self._cache['market_status']['data']
        
        try:
            status = await asyncio.wait_for(self._nepse.isNepseOpen(), timeout=3.0)
            result = {
                'is_open': status.get('isOpen', '').upper() == 'OPEN',
                'status': status.get('isOpen', 'UNKNOWN'),
                'as_of': status.get('asOf', ''),
                'source': 'live',
                'timestamp': datetime.now().isoformat()
            }
            self._cache['market_status'] = {'data': result, 'timestamp': time.time()}
            return result
        except Exception as e:
            print(f"Error fetching market status: {e}")
        
        return {'is_open': False, 'status': 'UNKNOWN', 'source': 'error'}
    
    async def get_market_summary(self):
        """Get full market summary including top gainers/losers"""
        if self._is_cache_valid('market_summary'):
            return self._cache['market_summary']['data']
        
        try:
            # Get index data
            nepse_idx = await self.get_nepse_index()
            all_indices = await self.get_all_indices()
            market_status = await self.get_market_status()
            
            # Get top gainers/losers from NEPSE API
            top_gainers = await asyncio.wait_for(self._nepse.getTopGainers(), timeout=3.0)
            top_losers = await asyncio.wait_for(self._nepse.getTopLosers(), timeout=3.0)
            
            gainers = []
            for stock in (top_gainers or [])[:5]:
                gainers.append({
                    'symbol': stock.get('symbol', ''),
                    'ltp': stock.get('lastTradedPrice', 0),
                    'change': stock.get('pointChange', 0),
                    'change_pct': stock.get('percentageChange', 0)
                })
            
            losers = []
            for stock in (top_losers or [])[:5]:
                losers.append({
                    'symbol': stock.get('symbol', ''),
                    'ltp': stock.get('lastTradedPrice', 0),
                    'change': stock.get('pointChange', 0),
                    'change_pct': stock.get('percentageChange', 0)
                })
            
            result = {
                'nepse_index': nepse_idx,
                'main_indices': all_indices.get('main_indices', []),
                'sub_indices': all_indices.get('sub_indices', []),
                'market_status': market_status,
                'top_gainers': gainers,
                'top_losers': losers,
                'source': 'live',
                'timestamp': datetime.now().isoformat()
            }
            self._cache['market_summary'] = {'data': result, 'timestamp': time.time()}
            return result
        except Exception as e:
            err_msg = str(e)
            print(f"Error fetching market summary: {err_msg}")
            return {'source': 'error', 'error': err_msg}


# ============================================================================
# Merolagani Stock Fundamentals
# ============================================================================

class MerolaganiFetcher:
    """Fetches stock fundamentals from Merolagani"""
    
    def __init__(self):
        self._cache = {}
        self._cache_ttl = 300  # Cache for 5 minutes
    
    def _is_cache_valid(self, key: str) -> bool:
        if key not in self._cache:
            return False
        cached_time = self._cache[key].get('timestamp', 0)
        return (time.time() - cached_time) < self._cache_ttl
    
    async def get_stock_fundamentals(self, symbol: str):
        """Get stock fundamentals from Merolagani"""
        cache_key = f'stock_{symbol.upper()}'
        if self._is_cache_valid(cache_key):
            return self._cache[cache_key]['data']
        
        url = f"https://merolagani.com/CompanyDetail.aspx?symbol={symbol.upper()}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        try:
            async with httpx.AsyncClient(verify=False, timeout=30) as client:
                response = await client.get(url, headers=headers)
                
                if response.status_code != 200:
                    return {'symbol': symbol, 'error': 'Failed to fetch', 'source': 'error'}
                
                soup = BeautifulSoup(response.text, 'lxml')
                
                def extract_value(label_text):
                    """Extract value from Merolagani table format"""
                    try:
                        label = soup.find('th', string=re.compile(label_text, re.I))
                        if label:
                            value_cell = label.find_next('td')
                            if value_cell:
                                text = value_cell.get_text(strip=True)
                                text = text.replace(',', '').replace('%', '')
                                text = re.sub(r'^(Rs\.|NPR|Nrs\.)\s*', '', text, flags=re.I).strip()
                                match = re.match(r'^\s*([-+]?\d*\.?\d+)', text)
                                if match:
                                    return float(match.group(1))
                    except:
                        pass
                    return None
                
                # 52 Week High and Low parsing
                high_52 = None
                low_52 = None
                label_52 = soup.find('th', string=re.compile(r'52 Weeks High\s*-\s*Low|52 Week.*High.*Low', re.I))
                if label_52:
                    val_cell = label_52.find_next('td')
                    if val_cell:
                        text_52 = val_cell.get_text(strip=True)
                        parts = text_52.split('-')
                        if len(parts) == 2:
                            try:
                                high_52 = float(parts[0].replace(',', '').strip())
                                low_52 = float(parts[1].replace(',', '').strip())
                            except:
                                pass

                result = {
                    'symbol': symbol.upper(),
                    'book_value': extract_value('Book Value'),
                    'eps': extract_value('EPS'),
                    'pe_ratio': extract_value('P/E Ratio'),
                    'pb_ratio': extract_value('PBV'),
                    'last_traded_price': extract_value('Market Price'),
                    'roe': extract_value('ROE|Return on Equity'),
                    'market_cap': extract_value('Market Capitalization'),
                    'shares_outstanding': extract_value('Shares Outstanding|Listed Shares|Total Listed Shares'),
                    '52_week_high': high_52,
                    '52_week_low': low_52,
                    'source': 'live',
                    'timestamp': datetime.now().isoformat()
                }
                
                self._cache[cache_key] = {'data': result, 'timestamp': time.time()}
                return result
                
        except Exception as e:
            print(f"Error fetching {symbol}: {e}")
            return {'symbol': symbol, 'error': str(e), 'source': 'error'}


# Global instances
nepse_fetcher = NepseDataFetcher()
merolagani_fetcher = MerolaganiFetcher()


# Create a thread-safe background asyncio loop
_async_loop = asyncio.new_event_loop()

def _start_async_loop(loop):
    asyncio.set_event_loop(loop)
    try:
        loop.run_forever()
    except Exception as e:
        print(f"Async loop exception: {e}")

_loop_thread = threading.Thread(target=_start_async_loop, args=(_async_loop,), daemon=True)
_loop_thread.start()

def run_async(coro):
    """Run async function in background thread's event loop"""
    future = asyncio.run_coroutine_threadsafe(coro, _async_loop)
    return future.result()


# ============================================================================
# API Routes
# ============================================================================

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'service': 'nepse-server'})


@app.route('/api/index')
def get_index():
    """Get NEPSE index data"""
    data = run_async(nepse_fetcher.get_nepse_index())
    if data:
        return jsonify(data)
    return jsonify({'error': 'Failed to fetch index'}), 500


@app.route('/api/indices')
def get_indices():
    """Get all indices (main + sub)"""
    data = run_async(nepse_fetcher.get_all_indices())
    return jsonify(data)


@app.route('/api/market-status')
def get_market_status():
    """Get market open/close status"""
    data = run_async(nepse_fetcher.get_market_status())
    return jsonify(data)


@app.route('/api/market-summary')
def get_market_summary():
    """Get full market summary"""
    data = run_async(nepse_fetcher.get_market_summary())
    return jsonify(data)


@app.route('/api/stock/<symbol>')
def get_stock(symbol: str):
    """Get stock fundamentals from Merolagani"""
    data = run_async(merolagani_fetcher.get_stock_fundamentals(symbol))
    return jsonify(data)


@app.route('/api/stocks')
def get_stocks():
    """Get multiple stock fundamentals"""
    symbols = request.args.get('symbols', '').split(',')
    symbols = [s.strip().upper() for s in symbols if s.strip()]
    
    if not symbols:
        return jsonify({'error': 'No symbols provided'}), 400
    
    async def fetch_all():
        tasks = [merolagani_fetcher.get_stock_fundamentals(s) for s in symbols]
        return await asyncio.gather(*tasks)
    
    results = run_async(fetch_all())
    return jsonify({'stocks': results})


# ============================================================================
# Manual Dividends API
# ============================================================================

DIVIDENDS_DB_PATH = os.path.join(os.path.dirname(__file__), "db", "manual_dividends.json")

def load_dividends_db():
    try:
        with open(DIVIDENDS_DB_PATH, "r", encoding="utf-8-sig") as f:
            return json.load(f)
    except FileNotFoundError:
        default_db = {"entries": []}
        save_dividends_db(default_db)
        return default_db
    except Exception as e:
        print(f"Error loading dividends DB: {e}")
        return {"entries": []}

def save_dividends_db(data):
    os.makedirs(os.path.dirname(DIVIDENDS_DB_PATH), exist_ok=True)
    with open(DIVIDENDS_DB_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

@app.route('/api/manual-dividends', methods=['GET', 'POST', 'OPTIONS'])
def handle_manual_dividends():
    if request.method == 'OPTIONS':
        return '', 200
        
    if request.method == 'GET':
        db = load_dividends_db()
        return jsonify(db)
        
    if request.method == 'POST':
        data = request.get_json() or {}
        if 'entries' not in data:
            return jsonify({'error': 'Invalid data. Required: entries list'}), 400
        
        save_dividends_db(data)
        return jsonify(data)

@app.route('/api/manual-dividends/add', methods=['POST'])
def add_manual_dividend():
    data = request.get_json() or {}
    symbol = data.get("symbol")
    if not symbol:
        return jsonify({'error': 'Symbol is required'}), 400
        
    db = load_dividends_db()
    db["entries"].insert(0, data)
    save_dividends_db(db)
    return jsonify(db)

@app.route('/api/manual-dividends/<id>', methods=['PUT', 'DELETE'])
def update_or_delete_manual_dividend(id):
    db = load_dividends_db()
    
    if request.method == 'PUT':
        updated_data = request.get_json() or {}
        found = False
        for i, entry in enumerate(db["entries"]):
            if entry.get("id") == id:
                db["entries"][i].update(updated_data)
                found = True
                break
        
        if not found:
            return jsonify({'error': f'Entry {id} not found'}), 404
            
        save_dividends_db(db)
        return jsonify(db)
        
    if request.method == 'DELETE':
        original_len = len(db["entries"])
        db["entries"] = [e for e in db["entries"] if e.get("id") != id]
        
        if len(db["entries"]) == original_len:
            return jsonify({'error': f'Entry {id} not found'}), 404
            
        save_dividends_db(db)
        return jsonify(db)


# ============================================================================
# Auto Dividends API (NepaliPaisa scraper + portfolio impact)
# ============================================================================

DIVIDEND_DATA_PATH = os.path.join(os.path.dirname(__file__), "db", "dividend_data.json")
PORTFOLIO_PATH = os.path.join(os.path.dirname(__file__), "db", "portfolio.json")

DIVIDEND_TAX_RATE = 0.05  # Nepal: 5% final withholding on dividends (cash + bonus face value)
MUTUAL_FUND_SYMBOLS = {"CSY", "CSBY", "KDBY", "MMF1", "NBF3", "NIBLSF", "NMBSBFE"}


def _load_json_file(path, default):
    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            return json.load(f)
    except FileNotFoundError:
        return default
    except Exception as e:
        print(f"[nepse_server] Error reading {path}: {e}")
        return default


def _paid_up_value(symbol):
    return 10 if symbol.upper() in MUTUAL_FUND_SYMBOLS else 100


def _shares_held_at(transactions, symbol, as_of_date, fallback_qty):
    """Replay BUY/SELL transactions to estimate shares held on a past date,
    since buying more since then shouldn't inflate a historical dividend.
    Falls back to today's total only when there's no transaction history at
    all for this symbol (e.g. IPO/mutual-fund lots never logged as
    transactions), where today's total already reflects what was always
    held. If the symbol DOES have logged transactions but all of them are
    after as_of_date (bought post-closure), the correct answer is 0 shares
    held then - NOT a fallback to today's total, which would wrongly credit
    a dividend for shares bought after the book closure."""
    all_for_symbol = [t for t in transactions if t.get("symbol", "").upper() == symbol]
    if not all_for_symbol:
        return fallback_qty
    relevant = [t for t in all_for_symbol if (t.get("date", "") or "")[:10] <= as_of_date]
    qty = 0.0
    for t in relevant:
        sign = 1 if t.get("type") == "BUY" else -1
        qty += sign * float(t.get("quantity", 0))
    return qty


def _all_fy_bonus_events(symbol, dividend_db, manual_db):
    """Merge auto-scraped and manual dividend records across EVERY fiscal year
    on record for this symbol - manual override takes precedence over auto for
    a given FY, same precedence compute_portfolio_dividends uses for the
    currently selected FY, just applied to all of them at once. Without this,
    the bonus timeline would silently ignore any year the user corrected or
    added by hand (e.g. CHCL 081-082's manual 8% override), since NepaliPaisa's
    scrape doesn't know about those. Disabled manual entries (superseded by the
    automatic calc - see disabledReason) are skipped, matching the main loop."""
    manual_by_fy = {}
    for e in manual_db.get("entries", []):
        if e.get("disabled") or (e.get("symbol", "") or "").upper() != symbol:
            continue
        manual_by_fy[(e.get("fiscalYear") or "").strip()] = e

    auto_by_fy = {d.get("fiscalYear"): d for d in dividend_db.get(symbol, {}).get("dividends", [])}

    events = []
    for fy in set(auto_by_fy) | set(manual_by_fy):
        auto = auto_by_fy.get(fy)
        manual = manual_by_fy.get(fy)
        # No real book closure on record (manual-only entry, or an unmatched
        # auto stub) - approximate with the end of this FY's receiving window,
        # the same fallback compute_portfolio_dividends uses for eligibility.
        date = (auto or {}).get("bookClosureDateAD") or _fy_receive_window(fy)[1]
        override = manual.get("bonusSharesReceived") if manual else None
        bonus_pct = float(manual.get("bonusPercent", 0)) if manual else float((auto or {}).get("bonusPercent", 0) or 0)
        if override is not None:
            events.append((date, None, float(override), fy))
        elif bonus_pct > 0:
            events.append((date, bonus_pct, None, fy))
    events.sort(key=lambda e: e[0])
    return events


def _bonus_share_growth_timeline(symbol, transactions, dividend_db, manual_db, current_qty, date_added, today):
    """Track CUMULATIVE bonus shares received via dividends only - isolated
    from ordinary buy/sell activity. Total share count (purchases + bonuses)
    is a portfolio-holdings concern (see HoldingsTable on the home page,
    which already owns that story from transaction history); the Dividends
    page's Share Growth column should answer one narrower question: how many
    shares has this stock actually handed me for free over the years?

    Each event's bonus is computed against the real total held right before
    that book closure (transaction-based shares plus bonus shares already
    credited by then), floored to whole shares - the same math used for the
    per-FY dividend calc above. Bonus events from before the holder actually
    owned the stock are excluded (using the first real transaction date, or
    dateAdded when there's no transaction history at all) - otherwise a
    decades-old serial bonus-payer like NABIL or CHCL would drag the timeline
    back over a decade of flat, pre-ownership zeros. Symbols with no bonus
    dividends on record (cash-only payers, mutual funds) return an empty
    timeline, rendered as "-" by ShareSparkline rather than a misleading
    flat line."""
    events = [e for e in _all_fy_bonus_events(symbol, dividend_db, manual_db) if e[0] <= today]
    if not events:
        return []

    sym_txns = [t for t in transactions
                if t.get("symbol", "").upper() == symbol and (t.get("date", "") or "")[:10]]
    if sym_txns:
        ownership_start = min(t["date"][:10] for t in sym_txns)
    else:
        ownership_start = date_added or events[0][0]
    events = [e for e in events if e[0] >= ownership_start]
    if not events:
        return []

    cumulative_bonus = 0
    timeline = [{"date": events[0][0], "shares": 0}]
    for date, bpct, override, fy in events:
        if override is not None:
            granted = int(override)
        else:
            held_from_txns = _shares_held_at(transactions, symbol, date, current_qty)
            base = held_from_txns + cumulative_bonus
            granted = int(base * bpct / 100.0)
        cumulative_bonus += granted
        # fiscalYear/gain let the UI show "FY 080-081: +3 shares" on hover,
        # instead of just a bare cumulative total the user has to do the
        # subtraction on themselves to sanity-check against what they recall
        # actually receiving each year.
        timeline.append({"date": date, "shares": cumulative_bonus, "fiscalYear": fy, "gain": granted})

    if timeline[-1]["date"] < today:
        timeline.append({"date": today, "shares": cumulative_bonus})
    return timeline


def _fy_receive_window(fy):
    """Profit-year FY '081-082' dividends are distributed in FY 082-083.
    Return the approximate AD window (start, end) of that receiving year.
    BS year Y starts ~July 17 of AD year Y-57 (e.g., 2082-04-01 BS = 2025-07-17 AD)."""
    try:
        second = int(fy.split("-")[1])          # 082
        ad_start_year = 2000 + second - 57      # 2082 BS -> 2025 AD
        return f"{ad_start_year}-07-17", f"{ad_start_year + 1}-07-16"
    except Exception:
        return "1900-01-01", "2999-12-31"


def compute_portfolio_dividends(fy):
    """For each holding: merge auto-scraped + manual dividend data for the given
    profit fiscal year, compute received bonus shares & cash (gross/net), and a
    share-count timeline for the receiving year (compounding sparkline).

    Assumption (documented in UI): portfolio.json quantity is the pre-bonus
    quantity; announced bonus shares are shown as additions on top of it.
    Manual entries (same symbol + fiscalYear) override auto data."""
    portfolio = _load_json_file(PORTFOLIO_PATH, {"holdings": []})
    dividend_db = _load_json_file(DIVIDEND_DATA_PATH, {})
    manual_db = load_dividends_db()
    today = datetime.now().strftime("%Y-%m-%d")
    win_start, win_end = _fy_receive_window(fy)

    manual_by_symbol = {}
    for e in manual_db.get("entries", []):
        if e.get("disabled"):
            # Parked, not deleted (see "disabledReason" on the entry) - excluded
            # from the auto+manual merge so the automatic calc takes over.
            continue
        if (e.get("fiscalYear") or "").strip() == fy:
            manual_by_symbol[e.get("symbol", "").upper()] = e

    companies = []
    totals = {"cashGross": 0.0, "cashNet": 0.0, "bonusShares": 0, "bonusTaxDue": 0.0, "companiesPaying": 0}

    for h in portfolio.get("holdings", []):
        symbol = h["symbol"].upper()
        qty = float(h.get("quantity", 0))
        paid_up = _paid_up_value(symbol)

        auto = next((d for d in dividend_db.get(symbol, {}).get("dividends", [])
                     if d.get("fiscalYear") == fy), None)
        manual = manual_by_symbol.get(symbol)

        if not auto and not manual:
            continue
            
        date_added = h.get("dateAdded", "")
        book_closure = (auto or {}).get("bookClosureDateAD", "")
        transactions = portfolio.get("transactions", [])
        has_txn_history = any(t.get("symbol", "").upper() == symbol for t in transactions)

        # Some auto entries are hand-seeded stubs never matched to a live
        # scrape (no bookClosureDateAD at all, e.g. UPPER 080-081). Without a
        # real date, approximate eligibility with the end of this FY's
        # receiving window - otherwise a holding bought well after the fiscal
        # year ended would skip the holding-period check entirely and always
        # show up, regardless of whether it was ever owned during that year.
        eligibility_date = book_closure or win_end

        # Use shares actually held on the book closure date (from real buy/sell
        # history), not today's total - buying more since then doesn't
        # retroactively entitle you to a bigger historical dividend.
        calc_qty = _shares_held_at(transactions, symbol, eligibility_date, qty) if (book_closure or has_txn_history) else qty

        # SMART FILTER: skip if not actually holding shares by the book closure
        # date (or, absent one, by the end of the FY's receiving window).
        # Prefer real transaction history (accurate) when it exists; only
        # fall back to the dateAdded heuristic when there's no logged
        # transaction at all for this symbol (e.g. IPO/mutual-fund lots that
        # predate any tracked purchase - dateAdded there is the best signal we have).
        if not manual:
            if has_txn_history:
                if calc_qty <= 0:
                    continue
            elif date_added and eligibility_date < date_added:
                continue

        bonus_pct = float(manual.get("bonusPercent", 0)) if manual else float(auto.get("bonusPercent", 0))
        cash_pct = float(manual.get("cashPercent", 0)) if manual else float(auto.get("cashPercent", 0))

        manual_bonus_override = manual.get("bonusSharesReceived") if manual else None
        if manual_bonus_override is not None:
            # User-confirmed actual count overrides the computed estimate
            # entirely (e.g. transaction history still doesn't reach far
            # enough back to capture pre-tracking lots or interim bonus shares).
            bonus_shares_exact = float(manual_bonus_override)
            bonus_shares = int(bonus_shares_exact)
            fraction_cash = 0.0
        else:
            bonus_shares_exact = calc_qty * bonus_pct / 100.0
            bonus_shares = int(bonus_shares_exact)  # NEPSE floors fractions (paid as cash)
            fraction_cash = (bonus_shares_exact - bonus_shares) * paid_up
        cash_gross = calc_qty * paid_up * cash_pct / 100.0 + fraction_cash
        cash_net = cash_gross * (1 - DIVIDEND_TAX_RATE)
        bonus_tax_due = bonus_shares_exact * paid_up * DIVIDEND_TAX_RATE

        if not book_closure:
            # Manual-only entries (no auto scrape match) represent dividends the
            # user already logged as received, not ones still pending closure.
            status = "book-closed" if (manual and not auto) else "announced"
        elif book_closure <= today:
            status = "book-closed"
        else:
            status = "book-closure-upcoming"

        # Sparkline: cumulative bonus shares received via dividends only,
        # across the whole tracked history - not total share count (that's a
        # portfolio-holdings concern) and not scoped to just the currently
        # selected fiscal year (growth from earlier years stays visible
        # instead of resetting every time the FY dropdown changes).
        timeline = _bonus_share_growth_timeline(symbol, transactions, dividend_db, manual_db, qty, date_added, today)

        companies.append({
            "symbol": symbol,
            "companyName": h.get("company") or dividend_db.get(symbol, {}).get("companyName", ""),
            "quantity": qty,
            "paidUpValue": paid_up,
            "fiscalYear": fy,
            "bonusPercent": bonus_pct,
            "cashPercent": cash_pct,
            "totalPercent": bonus_pct + cash_pct,
            "bookClosureDateAD": book_closure,
            "bookClosureDateBS": (auto or {}).get("bookClosureDateBS", ""),
            "status": status,
            "source": "manual-override" if (manual and auto) else ("manual" if manual else "auto"),
            "received": {
                "bonusShares": bonus_shares,
                "bonusSharesExact": round(bonus_shares_exact, 4),
                "cashGross": round(cash_gross, 2),
                "cashNet": round(cash_net, 2),
                "bonusTaxDue": round(bonus_tax_due, 2),
                "manualCashIncome": float(manual.get("cashIncome", 0)) if manual else None,
            },
            "shareTimeline": timeline,
        })

        totals["cashGross"] += cash_gross
        totals["cashNet"] += cash_net
        totals["bonusShares"] += bonus_shares
        totals["bonusTaxDue"] += bonus_tax_due
        totals["companiesPaying"] += 1

    for k in ("cashGross", "cashNet", "bonusTaxDue"):
        totals[k] = round(totals[k], 2)
    companies.sort(key=lambda c: c["totalPercent"], reverse=True)
    return {"fiscalYear": fy, "receiveWindow": {"start": win_start, "end": win_end},
            "taxRate": DIVIDEND_TAX_RATE, "totals": totals, "companies": companies}


@app.route('/api/dividends/portfolio', methods=['GET'])
def get_portfolio_dividends():
    """Merged auto+manual dividend view with computed portfolio impact."""
    fy = request.args.get('fy', '081-082')
    try:
        return jsonify(compute_portfolio_dividends(fy))
    except Exception:
        print(f"[nepse_server] portfolio dividends error: {traceback.format_exc()}")
        return jsonify({'error': 'Failed to compute portfolio dividends'}), 500


@app.route('/api/dividends/data', methods=['GET'])
def get_dividend_data():
    """Raw scraped dividend announcements (db/dividend_data.json)."""
    return jsonify(_load_json_file(DIVIDEND_DATA_PATH, {}))


@app.route('/api/dividends/history/<symbol>', methods=['GET'])
def get_dividend_history(symbol: str):
    """Automated dividend history for a specific symbol."""
    symbol = symbol.upper()
    dividend_db = _load_json_file(DIVIDEND_DATA_PATH, {})
    
    auto_data = dividend_db.get(symbol, {}).get("dividends", [])
    history = []
    
    for d in auto_data:
        fy = d.get("fiscalYear")
        if fy:
            history.append({
                "fiscalYear": fy,
                "bonusPercent": float(d.get("bonusPercent", 0)),
                "cashPercent": float(d.get("cashPercent", 0)),
                "totalPercent": float(d.get("totalPercent", 0)),
                "bookClosureDateAD": d.get("bookClosureDateAD", ""),
                "bookClosureDateBS": d.get("bookClosureDateBS", ""),
                "status": d.get("status", ""),
                "source": d.get("source", "auto")
            })
            
    def normalize_fy(fy_str):
        try:
            parts = fy_str.split('-')
            if len(parts) == 2:
                p1 = int(parts[0])
                if p1 < 100: p1 += 2000
                return p1
        except:
            pass
        return 0
        
    history.sort(key=lambda x: normalize_fy(x["fiscalYear"]), reverse=True)
    
    return jsonify({
        "symbol": symbol,
        "companyName": dividend_db.get(symbol, {}).get("companyName", ""),
        "history": history
    })


@app.route('/api/dividends/refresh', methods=['POST', 'OPTIONS'])
def refresh_dividends():
    """Run tools/scrape_dividends.py to fetch latest announcements for all holdings."""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        python = sys.executable
        project_root = os.path.dirname(os.path.abspath(__file__))
        print("[nepse_server] Refreshing dividend announcements...")
        res = subprocess.run(
            [python, "tools/scrape_dividends.py"],
            capture_output=True, text=True, cwd=project_root, timeout=180
        )
        if res.returncode not in (0, 2):  # 2 = partial (some symbols failed)
            detail = res.stderr or res.stdout or "No output"
            print(f"[nepse_server] Dividend refresh failed: {detail}")
            return jsonify({'error': 'Dividend refresh failed', 'details': detail}), 500
        return jsonify({
            'message': 'Dividend announcements refreshed',
            'partial': res.returncode == 2,
            'log': (res.stdout or "")[-2000:],
        })
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Dividend refresh timed out'}), 504
    except Exception as e:
        print(f"[nepse_server] Dividend refresh error: {traceback.format_exc()}")
        return jsonify({'error': 'Dividend refresh failed', 'details': str(e)}), 500


# ============================================================================
# Quarterly PDF Reports API
# ============================================================================

@app.route('/api/quarterly/upload', methods=['POST', 'OPTIONS'])
def upload_quarterly_pdf():
    """Accept a PDF upload, parse it, and save to quarterly DB."""
    if request.method == 'OPTIONS':
        return '', 200

    if not QUARTERLY_ENABLED:
        return jsonify({'error': 'Quarterly module not installed. Run: pip install pdfplumber'}), 503

    if 'pdf' not in request.files:
        return jsonify({'error': 'No PDF file in request. Use field name "pdf"'}), 400

    pdf_file = request.files['pdf']
    if not pdf_file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'File must be a PDF'}), 400

    # Optional overrides from form data
    override_symbol = request.form.get('symbol', None)
    override_sector = request.form.get('sector', None)
    allow_overwrite = request.form.get('overwrite', 'false').lower() == 'true'

    # Save to temp file for parsing
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
        pdf_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        # Parse the PDF
        result = parse_pdf(tmp_path,
                           override_symbol=override_symbol,
                           override_sector=override_sector)

        symbol = result.get('symbol')

        # If company not auto-detected, return for user confirmation
        if not symbol or not result.get('company_detected', True):
            return jsonify({
                'status': 'needs_confirmation',
                'message': 'Company not recognized. Please confirm the symbol and sector.',
                'detected_company_name': result.get('company_name'),
                'detected_fy': result.get('fy'),
                'detected_quarter': result.get('quarter'),
                'quarter_label': result.get('quarter_label'),
                'partial_result': result
            }), 202

        # Save to DB
        try:
            save_quarter(symbol, result, allow_overwrite=allow_overwrite)
        except DuplicateQuarterError as e:
            return jsonify({
                'status': 'duplicate',
                'message': str(e),
                'symbol': symbol,
                'fy': result.get('fy'),
                'quarter': result.get('quarter'),
                'quarter_label': result.get('quarter_label'),
            }), 409

        # Return success with parsed summary
        return jsonify({
            'status': 'success',
            'message': f'Parsed and saved {result["quarter_label"]} for {symbol}',
            'symbol': symbol,
            'company_name': result.get('company_name'),
            'fy': result.get('fy'),
            'quarter': result.get('quarter'),
            'quarter_label': result.get('quarter_label'),
            'period_end_text': result.get('period_end_text'),
            'parsed_at': result.get('parsed_at'),
            'raw': result.get('raw', {}),
            'computed': result.get('computed', {}),
            'yoy': result.get('yoy', {}),
        }), 200

    except ValueError as e:
        return jsonify({'error': f'Detection failed: {str(e)}'}), 422
    except Exception as e:
        print(traceback.format_exc())
        return jsonify({'error': f'Parse error: {str(e)}'}), 500
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

@app.route('/api/quarterly/fetch/<symbol>', methods=['POST', 'OPTIONS'])
def fetch_quarterly_data(symbol: str):
    """Scrape NepseAlpha, parse the markdown, and upsert quarterly data."""
    if request.method == 'OPTIONS':
        return '', 204
    
    if not QUARTERLY_ENABLED:
        return jsonify({'error': 'Module not available'}), 503

    symbol = symbol.upper()
    try:
        python = sys.executable  # use the same venv Python running this server
        project_root = os.path.dirname(os.path.abspath(__file__))

        # Step 1: Scrape NepseAlpha
        print(f"[nepse_server] Scraping NepseAlpha for {symbol}...")
        scrape_res = subprocess.run(
            [python, "tools/scrape_nepsealpha.py", symbol],
            capture_output=True, text=True, cwd=project_root
        )
        if scrape_res.returncode != 0:
            detail = scrape_res.stderr or scrape_res.stdout or "No output"
            print(f"[nepse_server] Scrape failed for {symbol}: {detail}")
            return jsonify({'error': f'Scrape failed for {symbol}', 'details': detail}), 500

        # Step 2: Parse and upsert
        print(f"[nepse_server] Parsing markdown for {symbol}...")
        parse_res = subprocess.run(
            [python, "tools/parse_nepsealpha_md.py", symbol],
            capture_output=True, text=True, cwd=project_root
        )
        if parse_res.returncode != 0:
            detail = parse_res.stderr or parse_res.stdout or "No output"
            print(f"[nepse_server] Parse failed for {symbol}: {detail}")
            return jsonify({'error': f'Parse failed for {symbol}', 'details': detail}), 500

        return jsonify({'message': f'Successfully fetched data for {symbol}', 'details': parse_res.stdout}), 200

    except Exception as e:
        print(f"[nepse_server] Unexpected error for {symbol}: {traceback.format_exc()}")
        return jsonify({'error': f'Failed to fetch data for {symbol}', 'details': str(e)}), 500

@app.route('/api/quarterly/top-performers', methods=['GET'])
def get_quarterly_top_performers():
    """Get top performing stocks per sector for the latest quarter."""
    db_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db")
    file_path = os.path.join(db_dir, "quarterly_top_performers.json")
    
    # Auto-regenerate if file is missing or older than 24 hours
    regenerate = False
    if not os.path.exists(file_path):
        regenerate = True
    else:
        file_age = time.time() - os.path.getmtime(file_path)
        if file_age > 86400: # 24 hours
            regenerate = True
            
    if regenerate:
        try:
            print("[nepse_server] Regenerating quarterly top performers...")
            python = sys.executable
            script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tools", "quarterly_top_performers.py")
            subprocess.run([python, script_path], check=True)
        except Exception as e:
            print(f"[nepse_server] Failed to regenerate top performers: {e}")
            
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return jsonify(json.load(f))
        except Exception as e:
            return jsonify({'error': 'Failed to read data', 'details': str(e)}), 500
    else:
        return jsonify({'error': 'Top performers file not found'}), 404


@app.route('/api/quarterly/list', methods=['GET'])
def list_quarterly_stocks():
    """Return list of all symbols that have quarterly data."""
    if not QUARTERLY_ENABLED:
        return jsonify({'symbols': [], 'error': 'Module not available'}), 200
    symbols = list_symbols()
    result = []
    for sym in symbols:
        data = load_symbol_data(sym)
        result.append({
            'symbol': sym,
            'company_name': data.get('company_name'),
            'sector': data.get('sector'),
            'quarter_count': len(data.get('quarters', [])),
            'last_updated': data.get('last_updated'),
        })
    return jsonify({'symbols': result})


@app.route('/api/quarterly/<symbol>', methods=['GET'])
def get_quarterly_data(symbol: str):
    """Return all quarters for a symbol."""
    if not QUARTERLY_ENABLED:
        return jsonify({'error': 'Module not available'}), 503
    data = get_summary(symbol.upper())
    return jsonify(data)


@app.route('/api/quarterly/<symbol>/<fy>/<int:quarter>', methods=['DELETE', 'OPTIONS'])
def delete_quarterly_record(symbol: str, fy: str, quarter: int):
    """Delete a specific quarter record (undo a bad parse)."""
    if request.method == 'OPTIONS':
        return '', 200
    if not QUARTERLY_ENABLED:
        return jsonify({'error': 'Module not available'}), 503
    deleted = delete_quarter(symbol.upper(), fy, quarter)
    if deleted:
        return jsonify({'status': 'deleted', 'symbol': symbol, 'fy': fy, 'quarter': quarter})
    return jsonify({'error': f'Quarter Q{quarter} FY {fy} not found for {symbol}'}), 404

# ============================================================================
# News API
# ============================================================================

NEWS_DB_PATH = os.path.join(os.path.dirname(__file__), "db", "news.json")

def load_news_db():
    try:
        with open(NEWS_DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except Exception as e:
        print(f"Error loading news DB: {e}")
        return {}

@app.route('/api/news/<symbol>', methods=['GET'])
def get_news(symbol: str):
    """Return all cached news for a symbol."""
    db = load_news_db()
    news_items = db.get(symbol.upper(), [])
    return jsonify({'symbol': symbol.upper(), 'news': news_items})

@app.route('/api/news', methods=['GET'])
def get_all_news():
    """Return all cached news."""
    db = load_news_db()
    return jsonify(db)

@app.route('/api/news/fetch/<symbol>', methods=['POST', 'OPTIONS'])
def fetch_news(symbol: str):
    """Run scrape_sharesansar_news.py to fetch latest news for a symbol."""
    if request.method == 'OPTIONS':
        return '', 204
    
    symbol = symbol.upper()
    try:
        python = sys.executable
        project_root = os.path.dirname(os.path.abspath(__file__))
        
        print(f"[nepse_server] Fetching news for {symbol}...")
        res = subprocess.run(
            [python, "tools/scrape_sharesansar_news.py", symbol],
            capture_output=True, text=True, cwd=project_root
        )
        
        if res.returncode != 0:
            detail = res.stderr or res.stdout or "No output"
            print(f"[nepse_server] News fetch failed for {symbol}: {detail}")
            return jsonify({'error': f'Fetch failed for {symbol}', 'details': detail}), 500
            
        # Return updated news for this symbol
        db = load_news_db()
        return jsonify({'symbol': symbol, 'news': db.get(symbol, []), 'message': 'Successfully fetched news'})
        
    except Exception as e:
        print(f"[nepse_server] Unexpected error for {symbol} news: {traceback.format_exc()}")
        return jsonify({'error': f'Failed to fetch news for {symbol}', 'details': str(e)}), 500


# ============================================================================
# Main
# ============================================================================

def _warmup_nepse():
    """Pre-fetch NEPSE data at startup so the token handshake is done
    before the first browser request arrives."""
    time.sleep(3)  # Give Flask a moment to bind its port first
    print("[Warmup] Pre-fetching NEPSE index...")
    try:
        run_async(nepse_fetcher.get_nepse_index())
        print("[Warmup] NEPSE index cached OK")
    except Exception as e:
        print(f"[Warmup] NEPSE index failed (will retry on first request): {e}")
    try:
        run_async(nepse_fetcher.get_market_status())
        print("[Warmup] Market status cached OK")
    except Exception as e:
        print(f"[Warmup] Market status failed: {e}")
    try:
        run_async(nepse_fetcher.get_all_indices())
        print("[Warmup] All indices cached OK")
    except Exception as e:
        print(f"[Warmup] All indices failed: {e}")


REFRESH_META_PATH = os.path.join(os.path.dirname(__file__), "db", "refresh_meta.json")


def _daily_refresh_loop():
    """Once per calendar day (first time the server is up that day), refresh
    portfolio news + dividend announcements in the background. Timestamp is
    persisted in db/refresh_meta.json, so restarts don't re-trigger it."""
    time.sleep(15)  # let Flask bind and NEPSE warmup start first
    project_root = os.path.dirname(os.path.abspath(__file__))
    while True:
        try:
            meta = _load_json_file(REFRESH_META_PATH, {})
            today = datetime.now().strftime("%Y-%m-%d")
            if meta.get("lastDailyRefresh") != today:
                print("[DailyRefresh] Running daily news + dividend refresh...")
                portfolio = _load_json_file(PORTFOLIO_PATH, {"holdings": []})
                symbols = sorted({h["symbol"].upper() for h in portfolio.get("holdings", [])})

                ok, failed = 0, 0
                for sym in symbols:
                    try:
                        res = subprocess.run(
                            [sys.executable, "tools/scrape_sharesansar_news.py", sym],
                            capture_output=True, text=True, cwd=project_root, timeout=60
                        )
                        ok += 1 if res.returncode == 0 else 0
                        failed += 0 if res.returncode == 0 else 1
                    except Exception as e:
                        failed += 1
                        print(f"[DailyRefresh] news {sym} failed: {e}")
                    time.sleep(1)  # polite pacing between page fetches

                try:
                    subprocess.run(
                        [sys.executable, "tools/scrape_dividends.py"],
                        capture_output=True, text=True, cwd=project_root, timeout=300
                    )
                    print("[DailyRefresh] Dividend announcements refreshed")
                except Exception as e:
                    print(f"[DailyRefresh] dividends failed: {e}")

                meta["lastDailyRefresh"] = today
                meta["lastDailyRefreshAt"] = datetime.now().isoformat(timespec="seconds")
                meta["newsSymbolsOk"] = ok
                meta["newsSymbolsFailed"] = failed
                os.makedirs(os.path.dirname(REFRESH_META_PATH), exist_ok=True)
                with open(REFRESH_META_PATH, "w", encoding="utf-8") as f:
                    json.dump(meta, f, indent=2)
                print(f"[DailyRefresh] Done — news for {ok} symbols ({failed} failed)")
        except Exception:
            print(f"[DailyRefresh] error: {traceback.format_exc()}")
        time.sleep(3600)  # re-check hourly (catches date rollover on long-running server)


if __name__ == '__main__':
    print("=" * 60)
    print("NEPSE Data Server")
    print("=" * 60)
    print("\nEndpoints:")
    print("  GET /health                   - Health check")
    print("  GET /api/index                - NEPSE index")
    print("  GET /api/indices              - All indices")
    print("  GET /api/market-status         - Market open/close")
    print("  GET /api/market-summary        - Full market summary")
    print("  GET /api/stock/<symbol>        - Stock fundamentals")
    print("  GET /api/stocks?symbols=X,Y,Z - Multiple stocks")
    print("  GET/POST /api/manual-dividends - Get/Set manual dividends")
    print("  POST /api/manual-dividends/add - Add manual dividend entry")
    print("\n" + "=" * 60)
    print("Starting server on http://localhost:8000")
    print("=" * 60 + "\n")

    # Kick off warmup in background so first browser request finds cached data
    warmup_thread = threading.Thread(target=_warmup_nepse, daemon=True)
    warmup_thread.start()

    # Daily auto-refresh of portfolio news + dividend announcements
    daily_refresh_thread = threading.Thread(target=_daily_refresh_loop, daemon=True)
    daily_refresh_thread.start()

    app.run(host='0.0.0.0', port=8000, debug=False, threaded=True)
