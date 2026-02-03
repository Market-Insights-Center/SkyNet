
import sys
import os
import asyncio
import logging

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backend.integration.strategy_ranking")
logger.setLevel(logging.DEBUG)

# Add Root to Path
sys.path.append(os.getcwd())

async def run_update():
    print("--- Triggering Strategy Update ---")
    try:
        from backend.integration import strategy_ranking
        
        # Load rankings first to verify visibility
        rankings = strategy_ranking.load_rankings()
        print(f"Loaded Rankings: Active Count={len(rankings.get('active', []))}")
        
        # Force Update Specific Portfolios (Bypass Scheduler)
        print("--- Forcing Update for 'skynet' ---")
        await strategy_ranking.update_single_portfolio_ranking('skynet')
        print("--- Forcing Update for 'cultivation' ---")
        await strategy_ranking.update_single_portfolio_ranking('cultivation')
        
        print("--- Update Complete (Check Logs above) ---")
        
        # Verify Post-Update
        rankings_after = strategy_ranking.load_rankings()
        for s in rankings_after.get('active', []):
            print(f"Strategy: {s.get('portfolio_code')}")
            print(f"  PnL: {s.get('pnl_all_time')}")
            print(f"  Last Run: {s.get('last_run')}")
            print(f"  Holdings: {len(s.get('virtual_holdings', []))}")
            if s.get('virtual_holdings'):
                print(f"     First Holding: {s.get('virtual_holdings')[0]}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_update())
