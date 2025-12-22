import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Add project root to sys.path
sys.path.append(os.getcwd())

from backend.database import calculate_user_rank

class TestRankFallback(unittest.TestCase):
    @patch('backend.database.get_db')
    def test_fallback_logic(self, mock_get_db):
        print("\nTesting Calculate User Rank Fallback Logic...")
        
        # Setup Mock DB hierarchy
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection
        
        mock_query = MagicMock()
        mock_collection.where.return_value = mock_query # .where() returns query
        
        # --- SCENARIO: count() raises AttributeError (simulate old lib) ---
        mock_query.count.side_effect = AttributeError("'Query' object has no attribute 'count'")
        
        # Setup stream() to return 9 mock documents (meaning 9 people have more points)
        # The rank should therefore be 10.
        mock_query.stream.return_value = [MagicMock() for _ in range(9)]
        
        # Execute Function
        rank = calculate_user_rank(points=100)
        
        # Verify
        print(f"Calculated Rank: {rank}")
        if rank == 10:
            print("SUCCESS: Fallback to stream() worked correctly.")
        else:
            print(f"FAILURE: Expected rank 10, got {rank}")
            
        self.assertEqual(rank, 10)
        
        # Verify that count() was called, failed, and then stream() was called
        mock_query.count.assert_called_once()
        mock_query.stream.assert_called_once()
    
    @patch('backend.database.get_db')    
    def test_caching_logic(self, mock_get_db):
        print("\nTesting Rank Caching...")
        # Reset global cache if needed, but for unit test simpler to just run
        # We need to ensure _rank_cache is empty or mocked? 
        # Since it's global in module, we might need to clear it or reload module.
        # Minimal test: call twice, see if db hit twice.
        
        from backend.database import calculate_user_rank, _rank_cache
        _rank_cache.clear() 
        
        mock_db = MagicMock()
        mock_get_db.return_value = mock_db
        mock_query = MagicMock()
        mock_db.collection.return_value.where.return_value = mock_query
        
        # Setup normal return
        mock_query.count.return_value.get.return_value = [[MagicMock(value=4)]] # Rank 5
        
        # Call 1
        rank1 = calculate_user_rank(500)
        self.assertEqual(rank1, 5)
        
        # Call 2 (Should hit cache)
        rank2 = calculate_user_rank(500)
        self.assertEqual(rank2, 5)
        
        # Verify DB hit only once
        mock_query.count.assert_called_once()
        print("SUCCESS: Caching prevented second DB call.")

if __name__ == '__main__':
    unittest.main()
