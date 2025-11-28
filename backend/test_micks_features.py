import requests
import json
import time

BASE_URL = ""

def test_articles_crud():
    print("\n--- Testing Articles CRUD ---")
    
    # 1. Create Article
    new_article = {
        "title": "Test Article",
        "content": "This is a test article content.",
        "author": "Test Author",
        "category": "Testing"
    }
    response = requests.post(f"{BASE_URL}/api/articles", json=new_article)
    if response.status_code == 200:
        article_id = response.json().get("article", {}).get("id")
        print(f"SUCCESS: Created article with ID {article_id}")
    else:
        print(f"FAILED: Create article. Status: {response.status_code}, {response.text}")
        return

    # 2. Get Articles
    response = requests.get(f"{BASE_URL}/api/articles?limit=1")
    if response.status_code == 200 and len(response.json()) > 0:
        print("SUCCESS: Fetched articles.")
    else:
        print(f"FAILED: Fetch articles. Status: {response.status_code}")

    # 3. Delete Article
    response = requests.delete(f"{BASE_URL}/api/articles/{article_id}")
    if response.status_code == 200:
        print("SUCCESS: Deleted article.")
    else:
        print(f"FAILED: Delete article. Status: {response.status_code}")

def test_voting_logic():
    print("\n--- Testing Voting Logic ---")
    # Ensure at least one article exists
    requests.post(f"{BASE_URL}/api/articles", json={"title": "Vote Test", "content": "Content", "author": "Tester"})
    articles = requests.get(f"{BASE_URL}/api/articles").json()
    if not articles:
        print("FAILED: No articles to vote on.")
        return
    
    article_id = articles[0]['id']
    user_id = "user_vote_test"

    # 1. Vote Up
    requests.post(f"{BASE_URL}/api/articles/{article_id}/vote", json={"user_id": user_id, "vote_type": "up"})
    
    # Verify
    article = requests.get(f"{BASE_URL}/api/articles/{article_id}").json()
    if user_id in article.get('liked_by', []) and user_id not in article.get('disliked_by', []):
        print("SUCCESS: Vote Up recorded.")
    else:
        print("FAILED: Vote Up not recorded correctly.")

    # 2. Vote Down (Should switch)
    requests.post(f"{BASE_URL}/api/articles/{article_id}/vote", json={"user_id": user_id, "vote_type": "down"})
    
    # Verify
    article = requests.get(f"{BASE_URL}/api/articles/{article_id}").json()
    if user_id in article.get('disliked_by', []) and user_id not in article.get('liked_by', []):
        print("SUCCESS: Vote switched to Down.")
    else:
        print("FAILED: Vote switch failed.")

def test_comments_admin():
    print("\n--- Testing Comments & Admin ---")
    # Ensure article exists
    articles = requests.get(f"{BASE_URL}/api/articles").json()
    article_id = articles[0]['id']

    # 1. Add Comment
    comment = {
        "id": 0, # Dummy ID, backend handles it
        "article_id": article_id,
        "user": "Commenter",
        "text": "Test Comment",
        "email": "commenter@example.com",
        "date": "2023-01-01" # Add date to avoid validation error if optional
    }
    res = requests.post(f"{BASE_URL}/api/comments", json=comment)
    comment_id = res.json().get("comment", {}).get("id")
    print(f"Created comment ID: {comment_id}")

    # 2. Delete Comment (Non-Admin) -> Should Fail
    res = requests.delete(f"{BASE_URL}/api/comments/{comment_id}?requester_email=random@example.com")
    if res.status_code == 403:
        print("SUCCESS: Non-admin delete rejected.")
    else:
        print(f"FAILED: Non-admin delete allowed? Status: {res.status_code}")

    # 3. Delete Comment (Admin) -> Should Succeed
    # Note: marketinsightscenter@gmail.com is hardcoded super admin
    res = requests.delete(f"{BASE_URL}/api/comments/{comment_id}?requester_email=marketinsightscenter@gmail.com")
    if res.status_code == 200:
        print("SUCCESS: Admin delete accepted.")
    else:
        print(f"FAILED: Admin delete failed. Status: {res.status_code}, {res.text}")

def test_mods_management():
    print("\n--- Testing Mods Management ---")
    super_admin = "marketinsightscenter@gmail.com"
    new_mod = "newmod@example.com"

    # 1. Add Mod (by Super Admin)
    res = requests.post(f"{BASE_URL}/api/mods", json={"email": new_mod, "action": "add", "requester_email": super_admin})
    if res.status_code == 200 and new_mod in res.json().get("mods", []):
        print("SUCCESS: Mod added.")
    else:
        print(f"FAILED: Add mod. Status: {res.status_code}")

    # 2. Remove Mod (by Super Admin)
    res = requests.post(f"{BASE_URL}/api/mods", json={"email": new_mod, "action": "remove", "requester_email": super_admin})
    if res.status_code == 200 and new_mod not in res.json().get("mods", []):
        print("SUCCESS: Mod removed.")
    else:
        print(f"FAILED: Remove mod. Status: {res.status_code}")

def test_share_logic():
    print("\n--- Testing Share Logic ---")
    # Ensure article exists
    articles = requests.get(f"{BASE_URL}/api/articles").json()
    if not articles:
        print("FAILED: No articles to share.")
        return
    article_id = articles[0]['id']
    initial_shares = articles[0].get('shares', 0)

    # Share
    res = requests.post(f"{BASE_URL}/api/articles/{article_id}/share", json={"platform": "twitter"})
    if res.status_code == 200:
        data = res.json()
        if data.get("shares") == initial_shares + 1:
            print(f"SUCCESS: Share incremented to {data.get('shares')}")
        else:
            print(f"FAILED: Share count mismatch. Expected {initial_shares + 1}, got {data.get('shares')}")
    else:
        print(f"FAILED: Share request failed. Status: {res.status_code}, {res.text}")

if __name__ == "__main__":
    try:
        test_articles_crud()
        test_voting_logic()
        test_comments_admin()
        test_mods_management()
        test_share_logic()
    except Exception as e:
        print(f"Test Execution Error: {e}")
