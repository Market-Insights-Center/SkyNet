
import asyncio
import sys
import os

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.integration.sentinel_command import run_sentinel

async def test_sentinel_report_generation():
    print("--- Starting Sentinel AI End-to-End Test ---")
    
    query = "Analyze LITE, DXYZ, TER, PALL, and SFTBY. Include assess risk and mlforecast."
    print(f"User Query: {query}")
    
    # Run the generator
    results = []
    async for event in run_sentinel(query, execution_mode="auto"):
        results.append(event)
        if event["type"] == "status":
            print(f"[STATUS] {event['message']}")
        elif event["type"] == "step_result":
            print(f"[RESULT] Step {event['step_id']} completed.")
        elif event["type"] == "summary":
            print("[SUMMARY] Report Generated.")
            
    # Extract the final report
    summary_event = next((e for e in results if e["type"] == "summary"), None)
    
    if not summary_event:
        print("FAIL: No summary event generated.")
        return
        
    report = summary_event["message"]
    print("\n--- Report Snippet ---")
    print(report[:1000] + "...")
    
    # Assertions
    print("\n--- Verifying Report Content ---")
    
    # 1. Single Master Table Check
    table_count = report.count("|---")
    if table_count > 1:
        print(f"WARNING: Found {table_count} tables. Should be exactly 1 master table (plus maybe a small one?). Prompt asked for ONE.")
    else:
        print("PASS: Single Master Table likely detected (based on separator count).")
        
    # 2. Key Columns Check
    required_cols = ["Quickscore", "ML Forecast", "Beta", "Correlation", "Asset"]
    missing_cols = [c for c in required_cols if c not in report]
    if missing_cols:
         print(f"FAIL: Missing columns: {missing_cols}")
    else:
         print("PASS: All required columns (Quickscore, ML, Beta, Correlation) present.")
         
    # 3. Company Name Check (Heuristic)
    # We expect "LITE" to be accompanied by a name, likely "Lumentum" or "Lite" depending on yfinance
    if "Lumentum" in report or "Holdings" in report or "Inc." in report:
        print("PASS: Real Company Names detected (found 'Inc.', 'Holdings', or 'Lumentum').")
    else:
        print("WARNING: Company names might be missing. Check output manually.")

    # 4. Dependency Injection Check
    # Check if we see logs or evidence that Assess/MLForecast ran
    steps_run = [e.get("step_id") for e in results if e["type"] == "step_result"]
    print(f"Steps Executed: {len(steps_run)}")
    if len(steps_run) >= 3: # Source + Assess + ML + Summary
         print("PASS: Dependency Injection likely worked (multiple steps ran).")
    else:
         print("FAIL: Too few steps executed.")

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(test_sentinel_report_generation())
