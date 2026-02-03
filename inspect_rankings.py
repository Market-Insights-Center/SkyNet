
import json
import os
import csv

def inspect():
    # 1. Strategy Rankings
    p = os.path.join('backend', 'data', 'strategy_rankings.json')
    if os.path.exists(p):
        print(f"--- {p} ---")
        try:
            with open(p, 'r') as f:
                data = json.load(f)
                active = data.get('active', [])
                print(f"Active Strategies: {len(active)}")
                for s in active:
                    print(f"Code: {s.get('portfolio_code')}")
                    print(f"  Last Run: {s.get('last_run')}")
                    print(f"  PnL: {s.get('pnl_all_time')}")
                    print(f"  Equity: {s.get('current_equity')}")
                    print(f"  Holdings Count: {len(s.get('virtual_holdings', []))}")
                    print(f"  Virtual Holdings: {s.get('virtual_holdings', [])[:2]}...") # Show first 2
        except Exception as e:
            print(f"Error reading JSON: {e}")
    else:
        print(f"File not found: {p}")
        # Try finding where it is
        print(f"CWD: {os.getcwd()}")
        print(f"Listing backend/data:")
        try:
            print(os.listdir('backend/data'))
        except:
             print("Cannot list backend/data")

    # 2. Nexus Configs
    p2 = os.path.join('backend', 'nexus_portfolios.csv')
    if os.path.exists(p2):
        print(f"\n--- {p2} ---")
        try:
            with open(p2, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    print(row)
        except: print("Error reading CSV")

if __name__ == "__main__":
    inspect()
