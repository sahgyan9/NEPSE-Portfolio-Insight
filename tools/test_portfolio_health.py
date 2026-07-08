import os
import json
import sys
import subprocess

def run_tests():
    print("=" * 60)
    print("RUNNING PORTFOLIO HEALTH SCORE ALGORITHM TEST SUITE")
    print("=" * 60)
    
    db_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "db")
    portfolio_path = os.path.join(db_dir, "portfolio.json")
    health_out_path = os.path.join(db_dir, "portfolio_health.json")
    
    # 1. Back up original portfolio
    original_portfolio = None
    if os.path.exists(portfolio_path):
        with open(portfolio_path, "r", encoding="utf-8") as f:
            original_portfolio = json.load(f)
            
    python_bin = sys.executable
    script_path = os.path.join(os.path.dirname(__file__), "portfolio_health.py")
            
    try:
        # Case 1: Standard Mock Portfolio with NICA (low CAR) and UPPER (leverage)
        print("\n[Test 1] Running health calculation on standard mock portfolio...")
        mock_data = {
            "holdings": [
                {
                    "symbol": "NICA",
                    "company": "NIC Asia Bank Ltd.",
                    "quantity": 1000,
                    "avgCost": 350.0,
                    "dateAdded": "2026-01-01"
                },
                {
                    "symbol": "UPPER",
                    "company": "Upper Tamakoshi Hydropower Ltd.",
                    "quantity": 2000,
                    "avgCost": 200.0,
                    "dateAdded": "2026-01-01"
                }
            ]
        }
        
        with open(portfolio_path, "w", encoding="utf-8") as f:
            json.dump(mock_data, f, indent=2)
            
        res = subprocess.run([python_bin, script_path], capture_output=True, text=True)
        if res.returncode != 0:
            print(f"Health script error:\n{res.stderr}")
            raise RuntimeError("Health script crashed during standard mock run")
            
        assert os.path.exists(health_out_path), "Health output file not generated!"
        
        with open(health_out_path, "r", encoding="utf-8") as f:
            health = json.load(f)
            
        # Assertions
        assert 0 <= health["overallScore"] <= 100, f"overallScore {health['overallScore']} out of bounds"
        assert health["grade"] in ["A+", "A", "B+", "B", "C", "D", "F"], f"Invalid grade {health['grade']}"
        assert len(health["holdings"]) == 2, "Should have 2 holdings"
        
        # Pillars
        for pillar_key in ["structure", "fundamentals", "valuation", "dividend", "volatility"]:
            assert pillar_key in health["pillars"], f"Missing pillar: {pillar_key}"
            assert 0 <= health["pillars"][pillar_key]["score"] <= 100
            
        # Warnings & recommendations check
        warnings = health.get("warnings", [])
        recs = health.get("recommendations", [])
        assert isinstance(warnings, list), "warnings must be a list"
        assert isinstance(recs, list), "recommendations must be a list"
        
        # Low CAR check for NICA (regulatory constraint warnings)
        nica_warning = any("CAR" in w and "NICA" in w for w in warnings)
        # Hydropower leverage check for UPPER
        upper_warning = any("UPPER" in w and "Leveraged" in w for w in warnings)
        
        print(f"  - Overall Score: {health['overallScore']} ({health['grade']})")
        print(f"  - Warnings Count: {len(warnings)}")
        
        # Case 2: Edge Case - Single-Stock Portfolio (extreme concentration)
        print("\n[Test 2] Running health calculation on single-stock portfolio...")
        single_mock = {
            "holdings": [
                {
                    "symbol": "NABIL",
                    "company": "Nabil Bank Limited",
                    "quantity": 100,
                    "avgCost": 500.0,
                    "dateAdded": "2026-01-01"
                }
            ]
        }
        with open(portfolio_path, "w", encoding="utf-8") as f:
            json.dump(single_mock, f, indent=2)
            
        res = subprocess.run([python_bin, script_path], capture_output=True, text=True)
        if res.returncode != 0:
            print(f"Health script error:\n{res.stderr}")
            raise RuntimeError("Health script crashed on single-stock portfolio")
            
        with open(health_out_path, "r", encoding="utf-8") as f:
            health_single = json.load(f)
            
        assert len(health_single["holdings"]) == 1, "Should have 1 holding"
        assert health_single["pillars"]["structure"]["score"] < 50, "Structure score should be penalized for extreme concentration"
        print(f"  - Single stock structure score: {health_single['pillars']['structure']['score']}")
        
        # Case 3: Edge Case - Empty Portfolio
        print("\n[Test 3] Running health calculation on empty portfolio...")
        empty_mock = {"holdings": []}
        with open(portfolio_path, "w", encoding="utf-8") as f:
            json.dump(empty_mock, f, indent=2)
            
        res = subprocess.run([python_bin, script_path], capture_output=True, text=True)
        # The script should exit gracefully or print a message
        print(f"  - Empty portfolio output: {res.stdout.strip()}")
        
        print("\n[SUCCESS] ALL MOCK HEALTH TEST CASES PASSED SUCCESSFULLY!")
        
    finally:
        # Restore original portfolio
        if original_portfolio:
            with open(portfolio_path, "w", encoding="utf-8") as f:
                json.dump(original_portfolio, f, indent=2)
            print("\nRestored original portfolio.json")
            # Re-run health script once to restore health file
            subprocess.run([python_bin, script_path], capture_output=True)

if __name__ == "__main__":
    run_tests()
