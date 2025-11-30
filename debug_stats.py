import requests

BASE_URL = "/api"

def debug():
    print("--- STATS ---")
    try:
        res = requests.get(f"{BASE_URL}/stats")
        print(res.json())
    except Exception as e:
        print(e)

    print("\n--- SHARE ---")
    try:
        # Get article 1
        res = requests.get(f"{BASE_URL}/articles")
        articles = res.json()
        if not articles:
            print("No articles found")
            return
        
        aid = articles[0]['id']
        print(f"Article ID: {aid}")
        print(f"Initial Shares: {articles[0].get('shares')}")
        
        # Share
        res = requests.post(f"{BASE_URL}/articles/{aid}/share")
        print(f"Share Response: {res.json()}")
        
        # Check again
        res = requests.get(f"{BASE_URL}/articles/{aid}")
        print(f"Post-Share Article: {res.json().get('shares')}")
    except Exception as e:
        print(e)

if __name__ == "__main__":
    debug()
