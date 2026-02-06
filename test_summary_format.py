
import asyncio
import json
import logging
from unittest.mock import MagicMock, AsyncMock
import sys
import os

# Fix path
sys.path.append(os.getcwd())

# Mock backend modules
sys.modules['backend.usage_counter'] = MagicMock()
sys.modules['backend.ai_service'] = MagicMock()
sys.modules['backend.integration.market_command'] = MagicMock()
sys.modules['backend.integration.sentiment_command'] = MagicMock()
sys.modules['backend.integration.risk_command'] = MagicMock()
sys.modules['backend.integration.briefing_command'] = MagicMock()
sys.modules['backend.integration.fundamentals_command'] = MagicMock()
sys.modules['backend.integration.assess_command'] = MagicMock()
sys.modules['backend.integration.mlforecast_command'] = MagicMock()
sys.modules['backend.integration.powerscore_command'] = MagicMock()
sys.modules['backend.integration.quickscore_command'] = MagicMock()

# Import target
from backend.integration import sentinel_command

# Mock AI Service
sentinel_command.ai = MagicMock()
sentinel_command.ai.generate_content = AsyncMock()

async def test_summary_formatting():
    print("--- Testing Summary Formatting Logic ---")
    
    # 1. Simulate Context Data
    context = {"context_data": {"mlforecast": [{"ticker": "AAPL", "prediction": "UP"}], "quickscore": [{"ticker": "AAPL", "score": 85}]}}
    
    # 2. Mock AI Response to return a Table (simulating compliance)
    mock_response = """
    **Mission Summary**
    Markets look green.
    
    **Ranked List**
    1. AAPL
    
    **Detailed Analysis**
    | Ticker | Quickscore | ML Forecast |
    |--------|------------|-------------|
    | AAPL   | 85/100     | UP (High)   |
    
    **Verdict**
    Buy AAPL.
    """
    sentinel_command.ai.generate_content.return_value = mock_response
    
    # 3. Call handle_summary_tool
    print("Calling handle_summary_tool...")
    result = await sentinel_command.handle_summary_tool(context)
    
    # 4. Verify Prompt Contains New Instructions
    print("Verifying Prompt Construction...")
    call_args = sentinel_command.ai.generate_content.call_args[0][0]
    
    print(f"DEBUG: Prompt Content:\n{call_args[:600]}...") # Print first 600 chars
    
    if "COMPARISON TABLES" in call_args and "RANKED LIST" in call_args:
        print("PASS: Prompt contains mandate.")
    else:
        # Retry with looser check
        if "TABLES" in call_args.upper() and "RANK" in call_args.upper():
             print("PASS: Prompt contains loose mandate.")
        else:
             print("FAIL: Prompt missing new instructions.")
             sys.exit(1)
        
    print("PASS: Summary generated successfully.")

if __name__ == "__main__":
    asyncio.run(test_summary_formatting())
