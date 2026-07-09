import os
import json
import shutil
import pytest

# Store original files we back up
BACKUP_FILES = [
    "portfolio.json",
    "fundamentals.json",
    "manual_dividends.json",
    "portfolio_health.json"
]

# Track quarterly files we created or modified during the test
modified_quarterly_files = []
# Track original contents of quarterly files before modification
quarterly_backups = {}

@pytest.fixture(scope="session", autouse=True)
def backup_db_directory():
    """Session-wide fixture to backup key DB files and restore them after all tests."""
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_dir = os.path.join(project_root, "db")
    backup_dir = os.path.join(project_root, "db_backup_test_run")
    os.makedirs(backup_dir, exist_ok=True)
    
    # Backup the 4 main JSON files
    for filename in BACKUP_FILES:
        src = os.path.join(db_dir, filename)
        dest = os.path.join(backup_dir, filename)
        if os.path.exists(src):
            shutil.copyfile(src, dest)
            
    yield
    
    # Restore the 4 main JSON files
    for filename in BACKUP_FILES:
        src = os.path.join(backup_dir, filename)
        dest = os.path.join(db_dir, filename)
        if os.path.exists(src):
            shutil.copyfile(src, dest)
        elif os.path.exists(dest):
            os.remove(dest)
            
    # Cleanup backup directory
    if os.path.exists(backup_dir):
        shutil.rmtree(backup_dir)

@pytest.fixture(autouse=True)
def clean_db_state():
    """Function-level fixture to revert modified DB files to original state after each test."""
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_dir = os.path.join(project_root, "db")
    backup_dir = os.path.join(project_root, "db_backup_test_run")
    
    # Clear tracking structures before test
    quarterly_backups.clear()
    modified_quarterly_files.clear()
    
    yield
    
    # Restore 4 main files from session backup
    for filename in BACKUP_FILES:
        src = os.path.join(backup_dir, filename)
        dest = os.path.join(db_dir, filename)
        if os.path.exists(src):
            shutil.copyfile(src, dest)
        elif os.path.exists(dest):
            os.remove(dest)
            
    # Revert or delete modified quarterly files
    quarterly_dir = os.path.join(db_dir, "quarterly")
    for q_file in set(modified_quarterly_files):
        q_path = os.path.join(quarterly_dir, q_file)
        if q_file in quarterly_backups:
            # Revert to original content
            with open(q_path, "w", encoding="utf-8") as f:
                json.dump(quarterly_backups[q_file], f, indent=2)
        else:
            # Delete since it didn't exist originally
            if os.path.exists(q_path):
                try:
                    os.remove(q_path)
                except Exception as e:
                    print(f"Failed to remove quarterly file {q_file}: {e}")

@pytest.fixture
def mock_portfolio():
    """Helper fixture to write arbitrary data to portfolio.json."""
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    portfolio_path = os.path.join(project_root, "db", "portfolio.json")
    
    def _write(holdings, value_history=None, watchlist=None):
        data = {
            "holdings": holdings,
            "transactions": [],
            "valueHistory": value_history or [],
            "watchlist": watchlist or []
        }
        with open(portfolio_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        return portfolio_path
        
    return _write

@pytest.fixture
def mock_fundamentals():
    """Helper fixture to write arbitrary data to fundamentals.json."""
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    fundamentals_path = os.path.join(project_root, "db", "fundamentals.json")
    
    def _write(data):
        with open(fundamentals_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        return fundamentals_path
        
    return _write

@pytest.fixture
def mock_quarterly():
    """Helper fixture to write quarterly data for specific symbols."""
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    quarterly_dir = os.path.join(project_root, "db", "quarterly")
    os.makedirs(quarterly_dir, exist_ok=True)
    
    def _write(symbol, quarters):
        filename = f"{symbol.upper()}.json"
        file_path = os.path.join(quarterly_dir, filename)
        
        # Backup original content if not already backed up
        if filename not in quarterly_backups and os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                quarterly_backups[filename] = json.load(f)
                
        modified_quarterly_files.append(filename)
        
        data = {
            "symbol": symbol.upper(),
            "sector": quarters[0].get("sector", "Others") if quarters else "Others",
            "company_name": quarters[0].get("company_name", "") if quarters else "",
            "quarters": quarters
        }
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        return file_path
        
    return _write
