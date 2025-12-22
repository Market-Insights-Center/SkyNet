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

if __name__ == '__main__':
    unittest.main()
