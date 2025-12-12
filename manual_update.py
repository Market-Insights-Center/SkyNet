
import asyncio
import sys
import os

# Add parent dir to sys.path to find backend module
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from backend.integration import performance_stream_command

async def run():
    print("--- STARTING MANUAL UPDATE ---")
    data = await performance_stream_command.update_heatmap_cache()
    print("--- UPDATE FINISHED ---")
    print(f"Result count: {len(data)}")
    if data:
        print("First sector sample:", data[0]['name'])
        print("Children count:", len(data[0]['children']))

if __name__ == "__main__":
    asyncio.run(run())
