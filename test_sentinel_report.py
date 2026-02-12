
import asyncio
import logging
from backend.integration.sentinel_command import handle_summary_tool
import json

# Mock Context Data mimicking a real execution
MOCK_CONTEXT = {
    "step_1_output": {
        "tickers": [
            {"ticker": "AAPL", "quickscore": 85, "ml_forecast": "UP", "beta": 1.2},
            {"ticker": "TSLA", "quickscore": 60, "ml_forecast": "DOWN", "beta": 2.5}
        ]
    },
    "step_2_output": {
        "results": [
            {"ticker": "AAPL", "sentiment": 0.8},
            {"ticker": "TSLA", "sentiment": -0.2}
        ]
    }
}

async def test_sentinel_report():
    print("--- Testing Sentinel Report Generation ---")
    
    try:
        # 1. Test with Good Data
        print("\n[Test 1] Generating Report with Valid Data...")
        result = await handle_summary_tool({
            "context_data": MOCK_CONTEXT,
            "user_query": "Analyze AAPL and TSLA"
        })
        
        report = result.get("report", "")
        data = result.get("data", [])
        
        print(f"Report Length: {len(report)}")
        print("Data Rows:", len(data))
        
        if "XYZ123" in report:
            print("❌ FAILURE: Report contains hallucinated ticker 'XYZ123'!")
        elif "AAPL" not in report:
            print("❌ FAILURE: Report missing real ticker 'AAPL'!")
        else:
            print("✅ PASS: Report contains real data and no crude hallucinations.")

        # 2. Test with Empty Data
        print("\n[Test 2] Generating Report with EMPTY Data...")
        empty_result = await handle_summary_tool({
            "context_data": {},
            "user_query": "Analyze nothing"
        })
        
        empty_report = empty_result.get("report", "")
        if "Analysis Failed" in empty_report or "No data available" in empty_report:
            print("✅ PASS: Correctly handled empty data.")
        else:
             print(f"❌ FAILURE: Empty data produced unexpected report: {empty_report[:100]}...")

    except Exception as e:
        print(f"\n❌ TEST ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_sentinel_report())
