
import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.getcwd())

from backend.integration.nexus_command import process_nexus_portfolio, _load_nexus_config

async def main():
    nexus_code = 'skynet'
    config = await _load_nexus_config(nexus_code)
    if not config:
        print("Config not found")
        return

    print("Calling process_nexus_portfolio...")
    try:
        # Simulate the call as it is in strategy_ranking.py
        # _, nexus_holdings = await process_nexus_portfolio(config, 10000.0, nexus_code)
        
        # But first let's just see what it returns
        res = await process_nexus_portfolio(config, 10000.0, nexus_code)
        print(f"Result Type: {type(res)}")
        if isinstance(res, tuple):
             print(f"Tuple Length: {len(res)}")
             print(f"Item 0 Type: {type(res[0])}") # Should be list (holdings)
             print(f"Item 1 Type: {type(res[1])}") # Should be float (cash)
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
