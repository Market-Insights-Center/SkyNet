
import asyncio
import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.integration.sentinel_command import run_sentinel

async def run_test():
    prompt = """
    I have the following list of tickers:
    $LITE, $DXYZ, $TER, $PALL, $SFTBY
    Please compare all of the tickers using your general research, their ML forecast numbers on each time frame, their quickscore numbers on each time frame, and their AAPC, IV, IVR, Beta, and Correlation using Assess score A.

    Please make sure to generate a final summary ordering the assets based on the strongest buy based on the found and calculated information to the weakest buy signal
    """
    
    print("Running Sentinel E2E with prompt...")
    
    try:
        from dotenv import load_dotenv
        load_dotenv()
        
        final_summary_text = ""
        
        async for msg in run_sentinel(user_prompt=prompt, execution_mode="auto"):
            m_type = msg.get("type")
            if m_type == "status":
                print(f"STATUS: {msg.get('message')}")
            elif m_type == "error":
                print(f"ERROR: {msg.get('message')}")
            elif m_type == "summary":
                print("\n✅ Report Generated!")
                print(f"Report Length: {len(msg['message'])} chars")
                
                data = msg.get("data", [])
                print(f"\n📊 Structured Data Received: {len(data)} records")
                for item in data:
                    print(f" - {item.get('ticker')}: Score={item.get('quickscore')}, Beta={item.get('beta')}, Forecasts={len(item.get('ml_forecast', []))}")
                
                if not data:
                    print("❌ ERROR: No structured data payload received!")
                else:
                    print("✅ Structured Data Verified.")
                
                final_summary_text = msg.get("message") # Keep the original assignment for verification checks
                break # Exit loop after processing summary
            elif m_type == "final":
                print("Sentinel execution finished.")

        if not final_summary_text:
             print("FAIL: No summary report generated.")
             return

        # Verification Checks
        fail = False
        if "AAPL" in final_summary_text and "AAPL" not in prompt:
             print("\nFAIL: AAPL hallucination detected!")
             fail = True
        else:
             print("\nPASS: No AAPL hallucination.")
             
        if "AAPC" in final_summary_text and "IV" in final_summary_text:
             print("PASS: Columns detected.")
        else:
             print("FAIL: Missing columns.")
             fail = True
        
        if not fail:
            print("\nSUCCESS: Report generated correctly.")

    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_test())
