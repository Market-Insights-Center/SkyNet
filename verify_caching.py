import asyncio
import time
import os
import sys

# Ensure backend path is in sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.integration.summary_command import handle_summary_command

async def test_caching():
    ticker = "NVDA"
    print(f"--- Testing Summary Caching for {ticker} ---")
    
    # Run 1: Should trigger AI Generation (slow)
    start_time = time.time()
    result1 = await handle_summary_command(args=[ticker])
    duration1 = time.time() - start_time
    print(f"Run 1 (Expected Slow): {duration1:.2f}s")
    print(f"Summary 1: {result1.get('summary')[:50]}...")
    
    # Run 2: Should use Cache (fast)
    start_time = time.time()
    result2 = await handle_summary_command(args=[ticker])
    duration2 = time.time() - start_time
    print(f"Run 2 (Expected Fast): {duration2:.2f}s")
    print(f"Summary 2: {result2.get('summary')[:50]}...")
    
    if duration2 < 0.1:
        print("\n[SUCCESS] Caching is working! Second run was instant.")
    else:
        print("\n[FAIL] Caching might not be working. Second run took too long.")

if __name__ == "__main__":
    asyncio.run(test_caching())
