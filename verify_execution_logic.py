
import sys
import os
import asyncio
import json

# Add project root to path
sys.path.append(os.getcwd())

try:
    from backend.integration.execution_command import execute_portfolio_rebalance
except ImportError:
    with open("verification_execution_output.txt", "w") as f:
        f.write("Could not import execution_command. Check paths.")
    sys.exit(1)

def test_execution_logic():
    output = []
    output.append("--- Testing Execution Logic (Dry Run) ---")
    
    trades = [
        {"ticker": "AAPL", "side": "buy", "quantity": 1.5},
        {"ticker": "MSFT", "side": "sell", "quantity": 0.5},
        {"ticker": "GOOGL", "side": "buy", "quantity": 0.0} # Should be ignored? Or logic handles it?
    ]
    
    output.append(f"Input Trades: {json.dumps(trades, indent=2)}")

    try:
        # Run execution in dry run mode (execute=False)
        # This requires NO credentials and NO internet if implemented correctly for dry run?
        # Actually execute_portfolio_rebalance calls login_to_robinhood immediately even for dry run? 
        # Review code:
        # if not execute: print "Skipping..."; return trades
        # It checks "if not trades: return []" first.
        # Then "if not execute: ... return trades".
        # So it does NOT login if execute=False. PERFECT.
        
        result = execute_portfolio_rebalance(trades, execute=False)
        
        if result == trades:
             output.append("\n[SUCCESS] Execution Logic handled Dry Run correctly.")
             output.append(f"Returned {len(result)} trades.")
        else:
             output.append(f"\n[FAILURE] Returned unexpected result: {result}")

    except Exception as e:
        output.append(f"[ERROR] Exception during execution: {e}")
    
    with open("verification_execution_output.txt", "w") as f:
        f.write("\n".join(output))

if __name__ == "__main__":
    test_execution_logic()
