import asyncio
import sys
import os
from unittest.mock import MagicMock, patch, AsyncMock

# Ensure backend can be imported
sys.path.append(os.getcwd())
sys.stdout = open('nexus_debug_out.txt', 'w', encoding='utf-8')
sys.stderr = sys.stdout

async def test_nexus_reallocation():
    print("--- Testing Nexus Reallocation ---")
    
    # Mocking
    with patch('backend.integration.nexus_command.run_breakout_analysis_singularity', new_callable=AsyncMock) as mock_breakout:
        with patch('backend.integration.nexus_command._resolve_nexus_component') as mock_resolve:
            
            # Setup Mock Breakout to return EMPTY
            mock_breakout.return_value = {"status": "success", "current_breakout_stocks": []}
            
            # Setup Mock Resolve to just return dummy holdings so the function finishes
            mock_resolve.return_value = [{'ticker': 'TEST', 'shares': 10, 'value': 100, 'actual_money_allocation': 100, 'live_price_at_eval': 10}]
            
            from backend.integration.nexus_command import process_nexus_portfolio
            
            # 1. Define Config: Breakout 50%, Market 50%
            nexus_config = {
                'nexus_code': 'TEST_CODE',
                'num_components': 2,
                'frac_shares': 'true',
                'component_1_type': 'command',
                'component_1_value': 'breakout',
                'component_1_weight': 50,
                'component_2_type': 'command',
                'component_2_value': 'market',
                'component_2_weight': 50
            }
            
            total_value = 10000
            
            try:
                print(f"DEBUG: Config Before Reallocation Check: {nexus_config}")
                
                final, cash = await process_nexus_portfolio(nexus_config, total_value, 'TEST_CODE')
                
                print(f"DEBUG: Config After Reallocation: {nexus_config}")
                print("Process finished.")
                
                # 3. Verify Breakout was called
                if mock_breakout.called:
                    print("SUCCESS: breakout analysis was called.")
                else:
                    print("FAILURE: breakout analysis was NOT called.")
                
                # 4. Verify Weights Reallocation
                # Using call_args_list to see what _resolve_nexus_component was called with
                # We expect "market" to be called with $10,000 (100%) instead of $5,000 (50%).
                # And "breakout" should ideally NOT be called or called with 0? 
                # The logic clears the weight, so loop should calculate 0 alloc for breakout.
                
                market_alloc = 0
                breakout_alloc = 0
                
                for call in mock_resolve.call_args_list:
                    args, kwargs = call
                    c_type = args[0]
                    c_value = args[1]
                    alloc = args[2]
                    
                    if 'market' in c_value:
                        market_alloc = alloc
                        print(f"Market Allocation: ${alloc}")
                    if 'breakout' in c_value:
                        breakout_alloc = alloc
                        print(f"Breakout Allocation: ${alloc}")

                if market_alloc == 10000:
                    print("SUCCESS: Market received 100% allocation ($10,000).")
                else:
                    print(f"FAILURE: Market received ${market_alloc} instead of $10,000.")

                if breakout_alloc == 0:
                     print("SUCCESS: Breakout received $0 allocation (or wasn't called).")
                else:
                     print(f"FAILURE: Breakout received ${breakout_alloc}.")

            except Exception as e:
                print(f"ERROR during execution: {e}")
                import traceback
                traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_nexus_reallocation())
