import asyncio
import json
from backend.integration.chart_command import stream_chart_completion

async def test_stream_chart_completion():
    tickers = ["AAPL", "TSLA"]
    columns = ["QS 1", "Sentiment"] 
    
    print("\n--- Starting Stream Test ---")
    
    events = []
    async for event in stream_chart_completion(tickers, columns):
        print(f"Received: {event}")
        events.append(event)
        
    # Validation
    assert events[0]["type"] == "start"
    assert events[0]["total_tickers"] == 2
    assert "total_cells" in events[0]
    
    row_starts = [e for e in events if e["type"] == "row_start"]
    assert len(row_starts) == 2
    
    updates = [e for e in events if e["type"] == "update"]
    assert len(updates) == 2
    
    # Check data integrity
    for update in updates:
        assert update["ticker"] in tickers
        assert "data" in update
        # We expect some data, even if N/A or dummy from mock tools
        # Note: Real tools might fail without env vars, but structure should hold
        
    assert events[-1]["type"] == "done"
    print("\n--- Stream Test Passed ---")

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(test_stream_chart_completion())
