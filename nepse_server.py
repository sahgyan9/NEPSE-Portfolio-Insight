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
import json
from bs4 import BeautifulSoup
import re
from datetime import datetime
from functools import wraps
import threading
import time
import tempfile

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
            raw_data = await self._nepse.getNepseIndex()
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
            main_raw = await self._nepse.getNepseIndex()
            sub_raw = await self._nepse.getNepseSubIndices()
            
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
            status = await self._nepse.isNepseOpen()
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
            top_gainers = await self._nepse.getTopGainers()
            top_losers = await self._nepse.getTopLosers()
            
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
            print(f"Error fetching market summary: {e}")
        
        return {'source': 'error', 'error': str(e)}


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
                                return float(text) if text and text != '-' else None
                    except:
                        pass
                    return None
                
                result = {
                    'symbol': symbol.upper(),
                    'book_value': extract_value('Book Value'),
                    'eps': extract_value('EPS'),
                    'pe_ratio': extract_value('P/E Ratio'),
                    'roe': extract_value('ROE'),
                    'market_cap': extract_value('Market Capitalization'),
                    'shares_outstanding': extract_value('Total Listed Shares'),
                    '52_week_high': extract_value('52 Week.*High'),
                    '52_week_low': extract_value('52 Week.*Low'),
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


def run_async(coro):
    """Run async function in sync context"""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


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
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': f'Parse error: {str(e)}'}), 500
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


import subprocess

@app.route('/api/quarterly/fetch/<symbol>', methods=['POST', 'OPTIONS'])
def fetch_quarterly_data(symbol: str):
    """Scrape NepseAlpha, parse the markdown, and upsert quarterly data."""
    if request.method == 'OPTIONS':
        return '', 204
    
    if not QUARTERLY_ENABLED:
        return jsonify({'error': 'Module not available'}), 503

    symbol = symbol.upper()
    try:
        # Step 1: Scrape
        print(f"[nepse_server] Scraping NepseAlpha for {symbol}...")
        scrape_cmd = ["python", "tools/scrape_nepsealpha.py", symbol]
        subprocess.run(scrape_cmd, check=True, capture_output=True, text=True)

        # Step 2: Parse and upsert
        print(f"[nepse_server] Parsing markdown for {symbol}...")
        parse_cmd = ["python", "tools/parse_nepsealpha_md.py", symbol]
        parse_res = subprocess.run(parse_cmd, check=True, capture_output=True, text=True)

        return jsonify({'message': f'Successfully fetched data for {symbol}', 'details': parse_res.stdout}), 200

    except subprocess.CalledProcessError as e:
        print(f"[nepse_server] Fetch error for {symbol}: {e.stderr or e.output or e}")
        return jsonify({'error': f'Failed to fetch data for {symbol}', 'details': str(e)}), 500

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


# ============================================================================
# Main
# ============================================================================

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
    
    app.run(host='0.0.0.0', port=8000, debug=False, threaded=True)
