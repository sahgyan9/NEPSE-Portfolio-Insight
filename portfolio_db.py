"""
Portfolio Database Server
A simple local database to store and manage portfolio data.

Features:
- Add, update, sell stocks
- Track portfolio value history over time with granular timestamps
- REST API for frontend integration
- Automatic value recording at configurable intervals
- Daily, weekly, monthly aggregation for charts

Run: python portfolio_db.py
API runs on: http://localhost:5001
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
from datetime import datetime, timedelta
from urllib.parse import urlparse, parse_qs
import random
import threading
import time

# Database file path
DB_PATH = os.path.join(os.path.dirname(__file__), "db", "portfolio.json")

# Store the last recorded value for auto-recording
last_known_value = 0
auto_record_interval = 3600  # Record every hour (in seconds)


def load_db():
    """Load the database from JSON file."""
    try:
        with open(DB_PATH, "r", encoding="utf-8-sig") as f:
            return json.load(f)
    except FileNotFoundError:
        # Create default structure if not exists
        default_db = {"holdings": [], "transactions": [], "valueHistory": []}
        save_db(default_db)
        return default_db


def save_db(data):
    """Save data to the JSON database."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def calculate_total_invested(holdings):
    """Calculate total invested amount."""
    return sum(h["quantity"] * h["avgCost"] for h in holdings)


def get_value_history_by_period(db, period="all"):
    """
    Get value history filtered and aggregated by period.
    
    Periods:
    - 'day' or '1d': Last 24 hours (hourly data points)
    - 'week' or '1w': Last 7 days (daily data points)
    - 'month' or '1m': Last 30 days (daily data points)
    - '3m': Last 3 months (weekly aggregates)
    - '6m': Last 6 months (weekly aggregates)
    - '1y': Last 1 year (monthly aggregates)
    - 'all': All historical data
    """
    history = db.get("valueHistory", [])
    if not history:
        return []
    
    now = datetime.now()
    
    # Parse dates and filter based on period
    parsed_history = []
    for h in history:
        try:
            if "T" in h.get("date", ""):
                # ISO format with time
                dt = datetime.fromisoformat(h["date"].replace("Z", ""))
            else:
                # Date only format
                dt = datetime.strptime(h["date"], "%Y-%m-%d")
            
            if h.get("value", 0) > 0:  # Skip zero values
                parsed_history.append({
                    "datetime": dt,
                    "date": h["date"],
                    "invested": h.get("invested", 0),
                    "value": h.get("value", 0)
                })
        except (ValueError, TypeError):
            continue
    
    # Sort by datetime
    parsed_history.sort(key=lambda x: x["datetime"])
    
    # Filter based on period
    if period in ["day", "1d"]:
        cutoff = now - timedelta(hours=24)
        filtered = [h for h in parsed_history if h["datetime"] >= cutoff]
        # Return hourly data points
        return aggregate_by_hour(filtered) if filtered else get_last_n_points(parsed_history, 24)
    
    elif period in ["week", "1w"]:
        cutoff = now - timedelta(days=7)
        filtered = [h for h in parsed_history if h["datetime"] >= cutoff]
        return aggregate_by_day(filtered) if filtered else get_last_n_points(parsed_history, 7)
    
    elif period in ["month", "1m"]:
        cutoff = now - timedelta(days=30)
        filtered = [h for h in parsed_history if h["datetime"] >= cutoff]
        return aggregate_by_day(filtered) if filtered else get_last_n_points(parsed_history, 30)
    
    elif period == "3m":
        cutoff = now - timedelta(days=90)
        filtered = [h for h in parsed_history if h["datetime"] >= cutoff]
        return aggregate_by_week(filtered) if filtered else get_last_n_points(parsed_history, 12)
    
    elif period == "6m":
        cutoff = now - timedelta(days=180)
        filtered = [h for h in parsed_history if h["datetime"] >= cutoff]
        return aggregate_by_week(filtered) if filtered else get_last_n_points(parsed_history, 24)
    
    elif period == "1y":
        cutoff = now - timedelta(days=365)
        filtered = [h for h in parsed_history if h["datetime"] >= cutoff]
        return aggregate_by_month(filtered) if filtered else get_last_n_points(parsed_history, 12)
    
    else:  # 'all'
        return [{
            "date": h["date"],
            "invested": h["invested"],
            "value": h["value"]
        } for h in parsed_history]


def get_last_n_points(history, n):
    """Get last n data points."""
    result = history[-n:] if len(history) >= n else history
    return [{
        "date": h["date"],
        "invested": h["invested"],
        "value": h["value"]
    } for h in result]


def aggregate_by_hour(history):
    """Aggregate data points by hour."""
    if not history:
        return []
    
    hourly = {}
    for h in history:
        hour_key = h["datetime"].strftime("%Y-%m-%dT%H:00:00")
        hourly[hour_key] = {
            "date": hour_key,
            "invested": h["invested"],
            "value": h["value"]
        }
    
    return list(hourly.values())


def aggregate_by_day(history):
    """Aggregate data points by day (keep last value of each day)."""
    if not history:
        return []
    
    daily = {}
    for h in history:
        day_key = h["datetime"].strftime("%Y-%m-%d")
        daily[day_key] = {
            "date": day_key,
            "invested": h["invested"],
            "value": h["value"]
        }
    
    return list(daily.values())


def aggregate_by_week(history):
    """Aggregate data points by week."""
    if not history:
        return []
    
    weekly = {}
    for h in history:
        # Get the Monday of the week
        week_start = h["datetime"] - timedelta(days=h["datetime"].weekday())
        week_key = week_start.strftime("%Y-%m-%d")
        weekly[week_key] = {
            "date": week_key,
            "invested": h["invested"],
            "value": h["value"]
        }
    
    return list(weekly.values())


def aggregate_by_month(history):
    """Aggregate data points by month."""
    if not history:
        return []
    
    monthly = {}
    for h in history:
        month_key = h["datetime"].strftime("%Y-%m-01")
        monthly[month_key] = {
            "date": month_key,
            "invested": h["invested"],
            "value": h["value"]
        }
    
    return list(monthly.values())


def get_transactions_by_period(db, period="all"):
    """Get transactions filtered by period."""
    transactions = db.get("transactions", [])
    if not transactions:
        return []
    
    now = datetime.now()
    
    # Define cutoff based on period
    if period in ["day", "1d"]:
        cutoff = now - timedelta(hours=24)
    elif period in ["week", "1w"]:
        cutoff = now - timedelta(days=7)
    elif period in ["month", "1m"]:
        cutoff = now - timedelta(days=30)
    elif period == "3m":
        cutoff = now - timedelta(days=90)
    elif period == "6m":
        cutoff = now - timedelta(days=180)
    elif period == "1y":
        cutoff = now - timedelta(days=365)
    else:
        return transactions  # Return all
    
    filtered = []
    for tx in transactions:
        try:
            tx_date = datetime.strptime(tx["date"], "%Y-%m-%d %H:%M:%S")
            if tx_date >= cutoff:
                filtered.append(tx)
        except (ValueError, KeyError):
            continue
    
    return filtered


def cleanup_value_history(db):
    """
    Clean up value history by:
    1. Removing entries with value = 0
    2. Keeping only the last entry per date (for old date-only entries)
    3. Converting old date-only entries to ISO format
    """
    history = db.get("valueHistory", [])
    if not history:
        return []
    
    cleaned = {}
    for h in history:
        if h.get("value", 0) <= 0:
            continue
        
        date_str = h.get("date", "")
        
        # If it's already ISO format with time, use full timestamp as key
        if "T" in date_str:
            key = date_str
        else:
            # For old date-only entries, keep only the last one per date
            key = date_str
        
        # Update (keeps last value for duplicates)
        cleaned[key] = {
            "date": date_str,
            "invested": h.get("invested", 0),
            "value": h.get("value", 0)
        }
    
    # Sort by date and return as list
    sorted_history = sorted(cleaned.values(), key=lambda x: x["date"])
    return sorted_history


def generate_historical_data(db):
    """Generate historical value data if not present."""
    if db.get("valueHistory") and len(db["valueHistory"]) > 0:
        return db["valueHistory"]
    
    # Generate simulated historical data for the past 12 months
    history = []
    total_invested = calculate_total_invested(db["holdings"])
    base_value = total_invested * 0.85  # Start at 85% of invested
    
    today = datetime.now()
    for i in range(12):
        date = today - timedelta(days=(11-i) * 30)
        # Simulate growth with some volatility
        growth = 1 + (random.uniform(-0.02, 0.08))
        base_value = base_value * growth
        
        history.append({
            "date": date.strftime("%Y-%m-%d"),
            "invested": round(total_invested, 2),
            "value": round(base_value, 2)
        })
    
    # Update last entry to reflect current approximate value
    # (In real app, this would be calculated from live prices)
    if history:
        history[-1]["value"] = round(total_invested * 1.05, 2)  # ~5% gain for demo
    
    db["valueHistory"] = history
    save_db(db)
    return history


class PortfolioHandler(BaseHTTPRequestHandler):
    """HTTP Request Handler for Portfolio API."""
    
    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
    
    def _send_json(self, data, status=200):
        self._set_headers(status)
        self.wfile.write(json.dumps(data).encode("utf-8"))
    
    def do_OPTIONS(self):
        self._set_headers()
    
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        
        if path == "/api/holdings":
            db = load_db()
            self._send_json({"holdings": db["holdings"]})
            
        elif path == "/api/watchlist":
            db = load_db()
            self._send_json({"watchlist": db.get("watchlist", [])})
        
        elif path == "/api/fundamentals":
            try:
                db_path = os.path.join(os.path.dirname(__file__), "db", "fundamentals.json")
                with open(db_path, "r", encoding="utf-8") as f:
                    fundamentals = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                fundamentals = {}
                
            # Augment/Override with Quarterly Data if available (saves tokens!)
            quarterly_dir = os.path.join(os.path.dirname(__file__), "db", "quarterly")
            if os.path.exists(quarterly_dir):
                for fname in os.listdir(quarterly_dir):
                    if fname.endswith(".json"):
                        sym = fname[:-5].upper()
                        try:
                            with open(os.path.join(quarterly_dir, fname), "r", encoding="utf-8") as f:
                                q_data = json.load(f)
                                if q_data and "quarters" in q_data and len(q_data["quarters"]) > 0:
                                    # Get the latest quarter
                                    latest_q = q_data["quarters"][-1]
                                    computed = latest_q.get("computed", {})
                                    
                                    if sym not in fundamentals:
                                        fundamentals[sym] = {}
                                        
                                    if "eps_ttm" in computed and computed["eps_ttm"] is not None:
                                        fundamentals[sym]["eps"] = computed["eps_ttm"]
                                    if "bvps" in computed and computed["bvps"] is not None:
                                        fundamentals[sym]["bookValue"] = computed["bvps"]
                                    if "pe_ratio" in computed and computed["pe_ratio"] is not None:
                                        fundamentals[sym]["peRatio"] = computed["pe_ratio"]
                                    if "pb_ratio" in computed and computed["pb_ratio"] is not None:
                                        fundamentals[sym]["pbRatio"] = computed["pb_ratio"]
                        except Exception as e:
                            print(f"Error reading quarterly data for {sym}: {e}")
                            
            self._send_json({"fundamentals": fundamentals})
            
        elif path == "/api/macro-research":
            try:
                # If 'force=true' is passed, run the script, else just serve the JSON
                force_refresh = query.get("force", ["false"])[0] == "true"
                db_path = os.path.join(os.path.dirname(__file__), "db", "macro_research.json")
                
                if force_refresh or not os.path.exists(db_path):
                    import subprocess
                    script_path = os.path.join(os.path.dirname(__file__), "tools", "fetch_relevant_research.py")
                    subprocess.run(["python", script_path], check=True)
                    
                with open(db_path, "r", encoding="utf-8") as f:
                    research_data = json.load(f)
            except Exception as e:
                research_data = {"error": str(e)}
            self._send_json({"research": research_data})
            
        elif path == "/api/portfolio-optimization":
            try:
                import subprocess
                script_path = os.path.join(os.path.dirname(__file__), "tools", "optimize_portfolio.py")
                # Always run it to get the freshest data
                subprocess.run(["python", script_path], check=True)
                
                db_path = os.path.join(os.path.dirname(__file__), "db", "portfolio_optimization.json")
                with open(db_path, "r", encoding="utf-8") as f:
                    opt_data = json.load(f)
            except Exception as e:
                opt_data = {"error": str(e)}
            self._send_json({"optimization": opt_data})
        
        elif path == "/api/transactions":
            db = load_db()
            period = query.get("period", ["all"])[0]
            transactions = get_transactions_by_period(db, period)
            self._send_json({"transactions": transactions})
        
        elif path == "/api/value-history":
            db = load_db()
            period = query.get("period", ["all"])[0]
            history = get_value_history_by_period(db, period)
            
            # If no data for the period, generate some historical data
            if not history:
                history = generate_historical_data(db)
                history = get_value_history_by_period(db, period)
            
            self._send_json({"history": history, "period": period})
        
        elif path == "/api/value-history/stats":
            # Get statistics for a period (min, max, avg, change)
            db = load_db()
            period = query.get("period", ["all"])[0]
            history = get_value_history_by_period(db, period)
            
            if history:
                values = [h["value"] for h in history if h.get("value", 0) > 0]
                if values:
                    first_value = values[0]
                    last_value = values[-1]
                    change = last_value - first_value
                    change_percent = (change / first_value * 100) if first_value > 0 else 0
                    
                    self._send_json({
                        "min": min(values),
                        "max": max(values),
                        "avg": sum(values) / len(values),
                        "first": first_value,
                        "last": last_value,
                        "change": change,
                        "changePercent": round(change_percent, 2),
                        "dataPoints": len(values)
                    })
                else:
                    self._send_json({"error": "No data available"}, 404)
            else:
                self._send_json({"error": "No data available"}, 404)
        
        elif path == "/api/value-history/cleanup":
            # Clean up value history (remove zeros, duplicates)
            db = load_db()
            original_count = len(db.get("valueHistory", []))
            cleaned = cleanup_value_history(db)
            db["valueHistory"] = cleaned
            save_db(db)
            self._send_json({
                "success": True,
                "originalCount": original_count,
                "cleanedCount": len(cleaned),
                "removed": original_count - len(cleaned)
            })
        
        elif path == "/api/summary":
            db = load_db()
            total_invested = calculate_total_invested(db["holdings"])
            history = db.get("valueHistory", [])
            current_value = history[-1]["value"] if history else total_invested
            
            self._send_json({
                "totalInvested": round(total_invested, 2),
                "currentValue": round(current_value, 2),
                "totalHoldings": len(db["holdings"]),
                "gainLoss": round(current_value - total_invested, 2),
                "gainLossPercent": round((current_value - total_invested) / total_invested * 100, 2) if total_invested > 0 else 0
            })
        
        else:
            self._send_json({"error": "Not found"}, 404)
    
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8")
        
        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            self._send_json({"error": "Invalid JSON"}, 400)
            return
        
        parsed = urlparse(self.path)
        path = parsed.path
        
        if path == "/api/holdings/add":
            # Add new stock or update existing
            db = load_db()
            symbol = data.get("symbol", "").upper()
            company = data.get("company", "")
            quantity = data.get("quantity", 0)
            avg_cost = data.get("avgCost", 0)
            
            if not symbol or quantity <= 0 or avg_cost <= 0:
                self._send_json({"error": "Invalid data. Required: symbol, quantity > 0, avgCost > 0"}, 400)
                return
            
            # Check if stock already exists
            existing = next((h for h in db["holdings"] if h["symbol"] == symbol), None)
            
            if existing:
                # Update existing holding (weighted average cost)
                old_total = existing["quantity"] * existing["avgCost"]
                new_total = quantity * avg_cost
                new_quantity = existing["quantity"] + quantity
                new_avg_cost = (old_total + new_total) / new_quantity
                
                existing["quantity"] = new_quantity
                existing["avgCost"] = round(new_avg_cost, 2)
                if company:
                    existing["company"] = company
                
                action = "updated"
            else:
                # Add new holding
                db["holdings"].append({
                    "symbol": symbol,
                    "company": company or symbol,
                    "quantity": quantity,
                    "avgCost": round(avg_cost, 2),
                    "dateAdded": datetime.now().strftime("%Y-%m-%d")
                })
                action = "added"
            
            # Log transaction
            db.setdefault("transactions", []).append({
                "type": "BUY",
                "symbol": symbol,
                "quantity": quantity,
                "price": avg_cost,
                "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            
            save_db(db)
            self._send_json({"success": True, "action": action, "holdings": db["holdings"]})
            
        elif path == "/api/watchlist/add":
            db = load_db()
            symbol = data.get("symbol", "").upper()
            company = data.get("company", symbol)
            
            if not symbol:
                self._send_json({"error": "Symbol is required"}, 400)
                return
                
            watchlist = db.setdefault("watchlist", [])
            existing = next((h for h in watchlist if h["symbol"] == symbol), None)
            
            if existing:
                self._send_json({"success": True, "action": "exists", "watchlist": watchlist})
                return
                
            watchlist.append({
                "symbol": symbol,
                "company": company,
                "dateAdded": datetime.now().strftime("%Y-%m-%d")
            })
            
            save_db(db)
            self._send_json({"success": True, "action": "added", "watchlist": watchlist})
        
        elif path == "/api/holdings/sell":
            # Sell stock (reduce quantity or remove)
            db = load_db()
            symbol = data.get("symbol", "").upper()
            quantity = data.get("quantity", 0)
            sell_price = data.get("sellPrice", 0)
            
            if not symbol or quantity <= 0:
                self._send_json({"error": "Invalid data. Required: symbol, quantity > 0"}, 400)
                return
            
            existing = next((h for h in db["holdings"] if h["symbol"] == symbol), None)
            
            if not existing:
                self._send_json({"error": f"Stock {symbol} not found in portfolio"}, 404)
                return
            
            if quantity > existing["quantity"]:
                self._send_json({"error": f"Cannot sell {quantity} units. You only have {existing['quantity']}"}, 400)
                return
            
            # Update or remove holding
            existing["quantity"] -= quantity
            
            if existing["quantity"] == 0:
                db["holdings"] = [h for h in db["holdings"] if h["symbol"] != symbol]
                action = "removed"
            else:
                action = "reduced"
            
            # Log transaction
            db.setdefault("transactions", []).append({
                "type": "SELL",
                "symbol": symbol,
                "quantity": quantity,
                "price": sell_price or 0,
                "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            
            save_db(db)
            self._send_json({"success": True, "action": action, "holdings": db["holdings"]})
        
        elif path == "/api/value-history/record":
            # Record current portfolio value (for tracking over time)
            global last_known_value
            db = load_db()
            total_invested = calculate_total_invested(db["holdings"])
            current_value = data.get("currentValue", total_invested)
            
            # Store with full ISO timestamp for granular tracking
            timestamp = datetime.now().isoformat()
            
            # Only record if value is different from last recorded (avoid duplicates)
            history = db.get("valueHistory", [])
            should_record = True
            
            if history:
                last_entry = history[-1]
                # Skip if same value recorded in last 5 minutes
                try:
                    if "T" in last_entry.get("date", ""):
                        last_time = datetime.fromisoformat(last_entry["date"].replace("Z", ""))
                        time_diff = (datetime.now() - last_time).total_seconds()
                        if time_diff < 300 and abs(last_entry.get("value", 0) - current_value) < 1:
                            should_record = False
                except:
                    pass
            
            if should_record and current_value > 0:
                db.setdefault("valueHistory", []).append({
                    "date": timestamp,
                    "invested": round(total_invested, 2),
                    "value": round(current_value, 2)
                })
                
                # Keep only last 365 days of history (but allow many entries per day)
                cutoff = datetime.now() - timedelta(days=365)
                filtered_history = []
                for h in db["valueHistory"]:
                    try:
                        if "T" in h.get("date", ""):
                            dt = datetime.fromisoformat(h["date"].replace("Z", ""))
                        else:
                            dt = datetime.strptime(h["date"], "%Y-%m-%d")
                        if dt >= cutoff:
                            filtered_history.append(h)
                    except:
                        filtered_history.append(h)
                
                db["valueHistory"] = filtered_history
                last_known_value = current_value
                save_db(db)
            
            self._send_json({"success": True, "recorded": should_record, "history": db.get("valueHistory", [])[-10:]})
        
        else:
            self._send_json({"error": "Not found"}, 404)
    
    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        
        if path == "/api/holdings":
            symbol = query.get("symbol", [""])[0].upper()
            
            if not symbol:
                self._send_json({"error": "Symbol required"}, 400)
                return
            
            db = load_db()
            original_count = len(db["holdings"])
            db["holdings"] = [h for h in db["holdings"] if h["symbol"] != symbol]
            
            if len(db["holdings"]) == original_count:
                self._send_json({"error": f"Stock {symbol} not found"}, 404)
                return
            
            save_db(db)
            self._send_json({"success": True, "holdings": db["holdings"]})
        
        elif path == "/api/watchlist":
            symbol = query.get("symbol", [""])[0].upper()
            
            if not symbol:
                self._send_json({"error": "Symbol required"}, 400)
                return
            
            db = load_db()
            original_count = len(db.get("watchlist", []))
            db["watchlist"] = [h for h in db.get("watchlist", []) if h["symbol"] != symbol]
            
            if len(db["watchlist"]) == original_count:
                self._send_json({"error": f"Stock {symbol} not found in watchlist"}, 404)
                return
            
            save_db(db)
            self._send_json({"success": True, "watchlist": db["watchlist"]})
        
        else:
            self._send_json({"error": "Not found"}, 404)
    
    def log_message(self, format, *args):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {args[0]}")


def run_server(port=5001):
    """Start the HTTP server."""
    # Clean up value history on startup
    print("Cleaning up value history...")
    db = load_db()
    original_count = len(db.get("valueHistory", []))
    cleaned = cleanup_value_history(db)
    db["valueHistory"] = cleaned
    save_db(db)
    print(f"Cleaned up {original_count - len(cleaned)} invalid entries. {len(cleaned)} entries remaining.")
    
    server = HTTPServer(("localhost", port), PortfolioHandler)
    print(f"""
+------------------------------------------------------------+
|           Portfolio Database Server Started                |
+------------------------------------------------------------+
|  Server running at: http://localhost:{port}                 |
+------------------------------------------------------------+
|  API Endpoints:                                            |
|  --------------------------------------------------------- |
|  GET  /api/holdings          - Get all holdings            |
|  GET  /api/transactions      - Get transaction history     |
|       ?period=1d|1w|1m|3m|6m|1y|all                        |
|  GET  /api/value-history     - Get portfolio value over    |
|       time ?period=1d|1w|1m|3m|6m|1y|all                   |
|  GET  /api/value-history/stats - Get period statistics      |
|       ?period=1d|1w|1m|3m|6m|1y|all                        |
|  GET  /api/summary           - Get portfolio summary       |
|  --------------------------------------------------------- |
|  POST /api/holdings/add      - Add/update stock            |
|       Body: {{"symbol", "company", "quantity", "avgCost"}}   |
|  --------------------------------------------------------- |
|  POST /api/holdings/sell     - Sell stock                  |
|       Body: {{"symbol", "quantity", "sellPrice"}}            |
|  --------------------------------------------------------- |
|  POST /api/value-history/record - Record current value     |
|       Body: {{"currentValue"}}                               |
|  --------------------------------------------------------- |
|  DELETE /api/holdings?symbol=XXX - Remove stock completely |
+------------------------------------------------------------+
    
Press Ctrl+C to stop the server.
""")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.shutdown()


if __name__ == "__main__":
    run_server()
