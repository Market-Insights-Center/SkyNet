import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_market_data():
    print("\n--- Testing /api/market-data ---")
    payload = {"tickers": ["AAPL", "MSFT", "TSLA"]}
    try:
        response = requests.post(f"{BASE_URL}/api/market-data", json=payload)
        if response.status_code == 200:
            data = response.json()
            results = data.get("results", {})
            print(f"Fetched data for: {list(results.keys())}")
            for ticker, info in results.items():
                print(f"{ticker}: Price=${info.get('price')}, 1D%={info.get('change')}, 1Y%={info.get('yearChange')}, 5Y%={info.get('fiveYearChange')}")
                if "yearChange" not in info or "fiveYearChange" not in info:
                    print(f"FAILED: Missing historical data for {ticker}")
        else:
            print(f"FAILED: Status Code {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"ERROR: {e}")

def test_market_data_details():
    print("\n--- Testing /api/market-data/details ---")
    payload = {"tickers": ["AAPL", "NVDA"]}
    try:
        response = requests.post(f"{BASE_URL}/api/market-data/details", json=payload)
        if response.status_code == 200:
            data = response.json()
            results = data.get("results", {})
            for ticker, info in results.items():
                print(f"{ticker}: IV={info.get('iv')}, Earnings={info.get('earnings')}, PE={info.get('peRatio')}")
        else:
            print(f"FAILED: Status Code {response.status_code}")
    except Exception as e:
        print(f"ERROR: {e}")

def test_comments_auth():
    print("\n--- Testing Comment Auth ---")
    # 1. Anonymous comment (Should Fail)
    payload = {
        "id": 0, "article_id": 1, "user": "Anonymous", "text": "Test", "date": "2023-01-01"
    }
    response = requests.post(f"{BASE_URL}/api/comments", json=payload)
    if response.status_code == 401:
        print("SUCCESS: Anonymous comment rejected.")
    else:
        print(f"FAILED: Anonymous comment allowed? Status: {response.status_code}")

    # 2. Logged in comment (Should Succeed)
    payload["user"] = "TestUser"
    response = requests.post(f"{BASE_URL}/api/comments", json=payload)
    if response.status_code == 200:
        print("SUCCESS: User comment accepted.")
    else:
        print(f"FAILED: User comment rejected. Status: {response.status_code}")

def test_voting():
    print("\n--- Testing Voting Limits ---")
    article_id = 1
    user_id = "test_user_123"
    
    # 1. Vote Up
    response = requests.post(f"{BASE_URL}/api/articles/{article_id}/vote", json={"type": "up", "user_id": user_id})
    print(f"Vote Up: {response.status_code}")
    
    # 2. Vote Up Again (Should toggle off or stay same, but definitely not double count if logic is correct)
    # The backend logic toggles. So if I vote up again, it should remove the vote.
    response = requests.post(f"{BASE_URL}/api/articles/{article_id}/vote", json={"type": "up", "user_id": user_id})
    print(f"Vote Up Again (Toggle): {response.status_code}")

def test_share():
    print("\n--- Testing Share Counter ---")
    article_id = 1
    # Get current shares
    # We don't have a direct get article endpoint that returns just one, but get_articles returns all.
    response = requests.get(f"{BASE_URL}/api/articles")
    articles = response.json()
    initial_shares = 0
    for a in articles:
        if a['id'] == article_id:
            initial_shares = int(a.get('shares', 0))
            break
            
    # Share
    res = requests.post(f"{BASE_URL}/api/articles/{article_id}/share")
    print(f"Share Request Status: {res.status_code}")
    print(f"Share Request Response: {res.text}")
    
    # Verify increment
    response = requests.get(f"{BASE_URL}/api/articles")
    articles = response.json()
    new_shares = 0
    for a in articles:
        if a['id'] == article_id:
            new_shares = int(a.get('shares', 0))
            break
            
    print(f"Shares: {initial_shares} -> {new_shares}")
    if new_shares == initial_shares + 1:
        print("SUCCESS: Share counter incremented.")
    else:
        print("FAILED: Share counter did not increment correctly.")

if __name__ == "__main__":
    test_market_data()
    test_market_data_details()
    test_comments_auth()
    test_voting()
    test_share()
