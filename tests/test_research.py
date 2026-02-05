
import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.getcwd())

from backend.integration.sentinel_command import handle_research_tool

async def test():
    print("Testing Research Tool...")
    result = await handle_research_tool({"query": "stock market news", "limit": 2})
    print(result)
    
    if "error" in result:
        print("TEST FAILED: " + result["error"])
        sys.exit(1)
    
    if result.get("count", 0) > 0:
        print("TEST PASSED: Found results.")
    else:
        print("TEST WARNING: No results found (but no error).")

if __name__ == "__main__":
    asyncio.run(test())
