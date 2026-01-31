
import asyncio
import sys
import os
import json

# Add backend to path
sys.path.append(os.getcwd())

from backend.integration.strategy_ranking import (
    submit_portfolio_to_ranking,
    update_single_portfolio_ranking,
    remove_portfolio_from_ranking,
    load_rankings,
    permanent_delete_strategy
)

TEST_USER = "test_user@example.com"
CUSTOM_CODE = "overvaluedpicks"
NEXUS_CODE = "skynet"

async def test_custom_strategy():
    print(f"\n--- Testing Custom Strategy: {CUSTOM_CODE} ---")
    
    # 1. Submit
    print("1. Submitting...")
    res = await submit_portfolio_to_ranking(TEST_USER, CUSTOM_CODE, "1/d")
    print(f"Submit Result: {res}")
    
    # 2. Update (Force Run)
    print("2. Force Updating...")
    await update_single_portfolio_ranking(CUSTOM_CODE)
    
    # 3. Verify
    print("3. Verifying Data...")
    rankings = load_rankings()
    item = next((x for x in rankings["active"] if x["portfolio_code"] == CUSTOM_CODE), None)
    
    if item:
        print("FOUND ITEM")
        print(f"PnL: {item.get('pnl_all_time')}")
        print(f"Equity: {item.get('current_equity')}")
        holdings = item.get('virtual_holdings', [])
        print(f"Holdings Count: {len(holdings)}")
        if holdings:
            print(f"Sample Holding: {holdings[0]}")
            if 'shares' not in holdings[0]:
                print("FAILED: 'shares' missing in holdings!")
            else:
                print("PASSED: Holdings structure looks correct.")
        else:
            print("WARNING: No holdings found (might be cash only or error).")
    else:
        print("FAILED: Item not found in rankings.")

    # 4. Remove
    print("4. Removing...")
    await remove_portfolio_from_ranking(TEST_USER, CUSTOM_CODE)
    
    # 5. Delete Permanent (Clean up)
    await permanent_delete_strategy(TEST_USER, CUSTOM_CODE, 'history')
    print("Cleaned up.")

async def test_nexus_strategy():
    print(f"\n--- Testing Nexus Strategy: {NEXUS_CODE} ---")
    
    # 1. Submit
    print("1. Submitting...")
    res = await submit_portfolio_to_ranking(TEST_USER, NEXUS_CODE, "1/d")
    print(f"Submit Result: {res}")
    
    # 2. Update (Force Run)
    print("2. Force Updating...")
    await update_single_portfolio_ranking(NEXUS_CODE)
    
    # 3. Verify
    print("3. Verifying Data...")
    rankings = load_rankings()
    item = next((x for x in rankings["active"] if x["portfolio_code"] == NEXUS_CODE), None)
    
    if item:
        print("FOUND ITEM")
        print(f"PnL: {item.get('pnl_all_time')}")
        print(f"Equity: {item.get('current_equity')}")
        holdings = item.get('virtual_holdings', [])
        print(f"Holdings Count: {len(holdings)}")
        if holdings:
            print(f"Sample Holding: {holdings[0]}")
            if 'shares' not in holdings[0]:
                print("FAILED: 'shares' missing in holdings!")
            else:
                print("PASSED: Holdings structure looks correct.")
        else:
            print("WARNING: No holdings found.")
    else:
        print("FAILED: Item not found in rankings.")

    # 4. Remove
    print("4. Removing...")
    await remove_portfolio_from_ranking(TEST_USER, NEXUS_CODE)
    
    # 5. Delete Permanent
    await permanent_delete_strategy(TEST_USER, NEXUS_CODE, 'history')
    print("Cleaned up.")



async def main():
    try:
        await test_custom_strategy()
        with open("test_custom_result.txt", "w") as f: f.write("PASSED")
    except Exception as e:
        with open("test_custom_result.txt", "w") as f: f.write(f"FAILED: {e}")
        import traceback; traceback.print_exc()

    try:
        await test_nexus_strategy()
        with open("test_nexus_result.txt", "w") as f: f.write("PASSED")
    except Exception as e:
        with open("test_nexus_result.txt", "w") as f: f.write(f"FAILED: {e}")
        import traceback; traceback.print_exc()


