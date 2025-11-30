import requests
import json
import time

BASE_URL = "/api"

def test_stats():
    print("Testing /api/stats...")
    try:
        res = requests.get(f"{BASE_URL}/stats")
        print(f"Status: {res.status_code}")
        print(f"Response: {res.json()}")
    except Exception as e:
        print(f"Failed: {e}")

def test_articles():
    print("\nTesting /api/articles...")
    try:
        res = requests.get(f"{BASE_URL}/articles")
        articles = res.json()
        print(f"Fetched {len(articles)} articles")
        if articles:
            return articles[0]['id']
    except Exception as e:
        print(f"Failed: {e}")
    return None

def test_comments(article_id):
    print(f"\nTesting Comments for Article {article_id}...")
    try:
        # Post Comment
        comment_data = {
            "id": 0,
            "article_id": article_id,
            "user": "TestUser",
            "text": "This is a test comment",
            "date": "2023-01-01"
        }
        res = requests.post(f"{BASE_URL}/comments", json=comment_data)
        print(f"Post Comment Status: {res.status_code}")
        comment = res.json()
        comment_id = comment['id']
        print(f"Created Comment ID: {comment_id}")

        # Reply
        reply_data = {
            "id": 0,
            "article_id": article_id,
            "user": "TestUser",
            "text": "This is a reply",
            "date": "2023-01-01"
        }
        res = requests.post(f"{BASE_URL}/comments/{comment_id}/reply", json=reply_data)
        print(f"Reply Status: {res.status_code}")
        
        # Verify
        res = requests.get(f"{BASE_URL}/articles/{article_id}")
        article = res.json()
        comments = article.get('comments', [])
        print(f"Article has {len(comments)} comments")
        return comment_id
    except Exception as e:
        print(f"Failed: {e}")
        return None

def test_voting(article_id):
    print(f"\nTesting Voting for Article {article_id}...")
    try:
        user_id = "test_user_123"
        # Vote Up
        res = requests.post(f"{BASE_URL}/articles/{article_id}/vote", json={"type": "up", "user_id": user_id})
        print(f"Vote Up: {res.json()}")
        
        # Vote Up Again (Toggle Off)
        res = requests.post(f"{BASE_URL}/articles/{article_id}/vote", json={"type": "up", "user_id": user_id})
        print(f"Vote Up (Toggle): {res.json()}")
        
        # Vote Down
        res = requests.post(f"{BASE_URL}/articles/{article_id}/vote", json={"type": "down", "user_id": user_id})
        print(f"Vote Down: {res.json()}")
    except Exception as e:
        print(f"Failed: {e}")

def test_share(article_id):
    print(f"\nTesting Share for Article {article_id}...")
    try:
        res = requests.post(f"{BASE_URL}/articles/{article_id}/share")
        print(f"Share: {res.json()}")
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    test_stats()
    aid = test_articles()
    if aid:
        cid = test_comments(aid)
        test_voting(aid)
        test_share(aid)
