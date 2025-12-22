
import sys
import os
import time

# Ensure backend can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.database import calculate_user_rank, get_db

def test_rank_calculation():
    print("Testing Rank Calculation...")
    db = get_db()
    
    # 1. Create Temporary Users with random points
    test_users = [
        {"email": "test_rank_1@example.com", "points": 5000},
        {"email": "test_rank_2@example.com", "points": 1000}, # Should be Rank 3 (below 5000 and 2000)
        {"email": "test_rank_3@example.com", "points": 10000}, # Should be Rank 1
    ]
    
    # Add dummy users
    for u in test_users:
        db.collection('users').document(u['email']).set({"points": u['points']}, merge=True)
        print(f"Created/Updated {u['email']} with {u['points']} points")
        
    time.sleep(1) # Ensure write propagation
    
    # 2. Check Ranks
    print("\nVerifying Ranks:")
    
    # Check Rank for User 1 (5000 points)
    # Expected: Rank 2 (Only User 3 has more)
    rank1 = calculate_user_rank(5000)
    print(f"User 1 (5000 pts) Rank: {rank1} (Expected ~2 depending on other DB users)")
    
    # Check Rank for User 2 (1000 points)
    # Expected: Rank 3 (User 1 and 3 have more)
    rank2 = calculate_user_rank(1000)
    print(f"User 2 (1000 pts) Rank: {rank2} (Expected ~3 depending on other DB users)")
    
    # Check Rank for User 3 (10000 points)
    # Expected: Rank 1 (Top of our test group)
    rank3 = calculate_user_rank(10000)
    print(f"User 3 (10000 pts) Rank: {rank3} (Expected ~1 depending on real DB users)")

    # 3. Cleanup
    print("\nCleaning up test users...")
    for u in test_users:
        db.collection('users').document(u['email']).delete()
    print("Cleanup complete.")

if __name__ == "__main__":
    try:
        test_rank_calculation()
        print("\nTest Finished Successfully.")
    except Exception as e:
        print(f"\nTest Failed: {e}")
