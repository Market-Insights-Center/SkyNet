import requests
import json

BASE_URL = "/api"

def test_get_article():
    print("\nTesting Get Single Article...")
    try:
        # First get all articles to see what IDs exist
        list_response = requests.get(f"{BASE_URL}/articles")
        if list_response.status_code == 200:
            all_articles = list_response.json()
            ids = [a['id'] for a in all_articles]
            print(f"Available Article IDs: {ids}")
            
            if ids:
                target_id = ids[-1] # Try the last one (oldest) which should be 1, 2, or 3
                print(f"Attempting to fetch Article ID: {target_id}")
                
                response = requests.get(f"{BASE_URL}/articles/{target_id}")
                if response.status_code == 200:
                    article = response.json()
                    print(f"SUCCESS: Fetched article {article['id']}: {article['title']}")
                else:
                    print(f"FAILED: Status {response.status_code} - {response.text}")
            else:
                print("FAILED: No articles found to test fetch.")
        else:
            print(f"FAILED to list articles: {list_response.status_code}")

    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    test_get_article()
