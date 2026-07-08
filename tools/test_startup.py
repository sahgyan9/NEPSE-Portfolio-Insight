import os
import sys
import socket

def check_port(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1.0)
        try:
            s.bind(('localhost', port))
            return True # Port is free
        except socket.error:
            return False # Port is in use

def run_diagnostics():
    print("=" * 60)
    print("RUNNING ENVIRONMENT STARTUP DIAGNOSTICS")
    print("=" * 60)
    
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # 1. Check virtual env
    venv_dir = os.path.join(project_root, ".venv")
    if os.path.exists(venv_dir):
        print("[PASS] Virtual environment (.venv) detected.")
    else:
        print("[FAIL] Virtual environment (.venv) not found at root.")
        
    # 2. Check key modules
    modules = ['flask', 'httpx', 'bs4', 'pdfplumber']
    for module in modules:
        try:
            __import__(module)
            print(f"[PASS] Python module '{module}' is installed.")
        except ImportError:
            print(f"[WARNING] Python module '{module}' is missing in active environment.")
            
    # 3. Check DB folder and files
    db_dir = os.path.join(project_root, "db")
    if os.path.exists(db_dir):
        print("[PASS] Database directory 'db/' exists.")
        db_files = ["portfolio.json", "fundamentals.json", "manual_dividends.json", "news.json"]
        for db_file in db_files:
            file_path = os.path.join(db_dir, db_file)
            if os.path.exists(file_path):
                print(f"  - [PASS] {db_file} exists.")
            else:
                print(f"  - [WARNING] {db_file} is missing (will be auto-created).")
    else:
        print("[WARNING] Database directory 'db/' does not exist (will be auto-created).")
        
    # 4. Check Port Availability
    db_port = 5001
    server_port = 8000
    
    if check_port(db_port):
        print(f"[PASS] DB Server Port {db_port} is available.")
    else:
        print(f"[FAIL] DB Server Port {db_port} is ALREADY IN USE.")
        
    if check_port(server_port):
        print(f"[PASS] NEPSE Server Port {server_port} is available.")
    else:
        print(f"[FAIL] NEPSE Server Port {server_port} is ALREADY IN USE.")
        
    print("\nDiagnostics complete.")

if __name__ == "__main__":
    run_diagnostics()
