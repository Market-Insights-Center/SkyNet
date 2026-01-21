import asyncio
import sys
import os
from unittest.mock import MagicMock

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock ai service BEFORE importing sentinel_command
sys.modules['backend.ai_service'] = MagicMock()
from backend.ai_service import ai

# Mock generate_content to print the system prompt
async def mock_generate_content(prompt, system_instruction, json_mode):
    with open("tests/verify_log.txt", "a", encoding="utf-8") as f:
        f.write(f"\n--- PROMPT SYSTEM INSTRUCTION ({json_mode=}) ---\n{system_instruction}\n------------------------------------------------\n")
    return '{"steps": []}'

ai.generate_content = mock_generate_content

# Now import the module under test
from backend.integration import sentinel_command

async def test():
    # Clear log
    with open("tests/verify_log.txt", "w", encoding="utf-8") as f:
        f.write("Starting Test\n")

    print("Testing 'plan_and_review' mode...")
    await sentinel_command.plan_execution("Test plan", execution_mode="plan_and_review")
    
    print("Testing 'quick_execute' mode...")
    await sentinel_command.plan_execution("Test quick", execution_mode="quick_execute")

    print("Testing 'auto' mode...")
    await sentinel_command.plan_execution("Test auto", execution_mode="auto")

if __name__ == "__main__":
    asyncio.run(test())
