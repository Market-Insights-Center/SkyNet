import requests
import json

BASE_URL = "http://localhost:8002/api"

def test_create_article():
    print("Testing Create Article...")
    payload = {
        "title": "Python Test Article",
        "subheading": "Testing via Python script",
        "content": "<p>Content</p>",
        "author": "PyTester",
        "date": "2025-11-24",
        "category": "Tech",
        "hashtags": ["python", "api"],
        "cover_image": "https://example.com/image.jpg",
        "likes": 0,
        "dislikes": 0,
        "shares": 0
    }
    try:
        response = requests.post(f"{BASE_URL}/articles", json=payload)
        if response.status_code == 200:
            print("SUCCESS: Article created.")
            # print(response.json())
            return response.json().get("id")
        else:
            print(f"FAILED: Status {response.status_code}")
            print(response.text)
            return None
    except Exception as e:
        print(f"ERROR: {e}")
        return None

def test_users_api():
    print("\nTesting Users API...")
    
    # Create/Update User
    payload = {
        "email": "pytest@example.com",
        "subscription_plan": "Enterprise",
        "subscription_cost": 99.99
    }
    try:
        response = requests.post(f"{BASE_URL}/users", json=payload)
        if response.status_code == 200:
            print("SUCCESS: User created/updated.")
        else:
            print(f"FAILED: Status {response.status_code}")
            print(response.text)
            
        # Get Users
        response = requests.get(f"{BASE_URL}/users")
        if response.status_code == 200:
            print("SUCCESS: Users retrieved.")
            users = response.json()
            found = any(u['email'] == 'pytest@example.com' for u in users)
            if found:
                print("VERIFIED: Created user found in list.")
            else:
                print("FAILED: Created user NOT found in list.")
        else:
            print(f"FAILED: Status {response.status_code}")
    except Exception as e:
        print(f"ERROR: {e}")

def test_comments_api(article_id):
    if not article_id:
        print("\nSkipping Comment Test (No Article ID)")
        return

    print("\nTesting Comments API...")
    
    # 1. Add Comment
    comment_payload = {
        "id": 101, 
        "article_id": article_id,
        "user": "Commenter",
        "text": "First comment!",
        "date": "2025-11-24"
    }
    try:
        response = requests.post(f"{BASE_URL}/comments", json=comment_payload)
        if response.status_code == 200:
            print("SUCCESS: Comment added.")
        else:
            print(f"FAILED Add Comment: {response.status_code}")
            print(response.text)
            return

        # 2. Reply to Comment
        reply_payload = {
            "id": 102,
            "article_id": article_id,
            "user": "Replier",
            "text": "This is a reply.",
            "date": "2025-11-24"
        }
        response = requests.post(f"{BASE_URL}/comments/101/reply", json=reply_payload)
        if response.status_code == 200:
            print("SUCCESS: Reply added.")
        else:
            print(f"FAILED Add Reply: {response.status_code}")
            print(response.text)

        # 3. Vote on Comment
        vote_payload = {"type": "up"}
        response = requests.post(f"{BASE_URL}/comments/101/vote", json=vote_payload)
        if response.status_code == 200:
            print("SUCCESS: Voted on comment.")
        else:
            print(f"FAILED Vote: {response.status_code}")
            print(response.text)

    except Exception as e:
        print(f"ERROR: {e}")

def test_new_endpoints():
    # 6. Test Get Articles
    print("\nTesting Get Articles...")
    try:
        response = requests.get(f"{BASE_URL}/articles")
        if response.status_code == 200:
            articles = response.json()
            print(f"SUCCESS: Fetched {len(articles)} articles.")
        else:
            print(f"FAILED: Status {response.status_code} - {response.text}")
    except Exception as e:
        print(f"FAILED: {e}")

    # 7. Test Get Stats
    print("\nTesting Get Stats...")
    try:
        response = requests.get(f"{BASE_URL}/stats")
        if response.status_code == 200:
            stats = response.json()
            print(f"SUCCESS: Fetched stats. Online: {stats['community_stats']['online']}, Trending: {len(stats['trending_topics'])}")
        else:
            print(f"FAILED: Status {response.status_code} - {response.text}")
    except Exception as e:
        print(f"FAILED: {e}")

    # 8. Test Get Single Article
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
    article_id = test_create_article()
    test_users_api()
    test_comments_api(article_id)
    test_new_endpoints()
