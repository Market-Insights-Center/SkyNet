
import asyncio
import logging
from backend.integration.chart_command import process_chart_completion

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_chart_completion_backend():
    print("--- Testing Chart Completion Backend ---")
    
    # Test Data: Tickers and mixed columns
    tickers = ["AAPL", "NVDA"]
    # Columns covering QuickScore, MLForecast, Assess, Sentiment
    columns = [
        "QuickScore 1y", 
        "MLF 1", 
        "Sentiment", 
        "Assess A Beta",
        "Random Column" # Should be handled gracefully
    ]
    
    print(f"Tickers: {tickers}")
    print(f"Columns: {columns}")
    
    try:
        result = await process_chart_completion(tickers, columns)
        
        print("\n--- Result ---")
        print(f"Headers: {result['headers']}")
        print(f"Rows: {len(result['rows'])}")
        
        for row in result['rows']:
            print(f"\nTicker: {row['ticker']}")
            for col in columns:
                val = row.get(col, "MISSING")
                print(f"  {col}: {val}")
                
        # Basic Assertions
        assert len(result['rows']) == 2
        assert result['headers'] == columns
        assert "QuickScore 1y" in result['rows'][0]
        
        print("\n✅ Test Passed: Data structure returned successfully.")
        
    except Exception as e:
        print(f"\n❌ Test Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_chart_completion_backend())
