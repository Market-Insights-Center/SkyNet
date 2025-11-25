import csv
import os
import json
from firebase_admin_setup import get_db, get_auth
from firebase_admin import auth

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
ARTICLES_CSV = os.path.join(DATA_DIR, 'articles.csv')

# Ensure data dir exists
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# --- Firebase Helpers ---

def get_all_users_count():
    """Fetches total user count from Firebase Auth."""
    try:
        # Note: list_users is efficient for counts up to a few thousand, 
        # for millions we'd need a different approach (e.g. distributed counters)
        # but for this scale it's fine.
        page = auth.list_users()
        count = 0
        while page:
            count += len(page.users)
            page = page.get_next_page()
        return count
    except Exception as e:
        print(f"Error fetching user count: {e}")
        return 0

def save_subscription(email, plan, cost):
    """Saves subscription data to Firestore."""
    try:
        db = get_db()
        # Use email as document ID for simplicity in this context, 
        # or query by email. Using email as ID is easier for lookup.
        # Ideally we use UID, but the request passes email.
        # We'll store in a 'subscriptions' collection.
        doc_ref = db.collection('subscriptions').document(email)
        doc_ref.set({
            'email': email,
            'plan': plan,
            'cost': cost,
            'updated_at': firestore.SERVER_TIMESTAMP
        }, merge=True)
        return True
    except Exception as e:
        print(f"Error saving subscription: {e}")
        return False

def get_subscription(email):
    try:
        db = get_db()
        doc_ref = db.collection('subscriptions').document(email)
        doc = doc_ref.get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception as e:
        print(f"Error getting subscription: {e}")
        return None

# --- CSV Helpers for Articles ---

def init_articles_csv():
    """Creates CSV if not exists."""
    if not os.path.exists(ARTICLES_CSV):
        with open(ARTICLES_CSV, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'title', 'subheading', 'content', 'author', 'date', 'category', 'hashtags', 'cover_image', 'likes', 'dislikes', 'shares', 'liked_by', 'disliked_by', 'comments'])

def read_articles_from_csv():
    """Reads articles from CSV."""
    articles = []
    if not os.path.exists(ARTICLES_CSV):
        return []
    
    try:
        with open(ARTICLES_CSV, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Parse complex fields stored as JSON strings
                try:
                    row['id'] = int(row['id'])
                    row['likes'] = int(row['likes'])
                    row['dislikes'] = int(row['dislikes'])
                    row['shares'] = int(row['shares'])
                    row['hashtags'] = json.loads(row['hashtags']) if row['hashtags'] else []
                    row['liked_by'] = json.loads(row['liked_by']) if row['liked_by'] else []
                    row['disliked_by'] = json.loads(row['disliked_by']) if row['disliked_by'] else []
                    # Comments are stored in a separate file in the original code, 
                    # but the prompt asked to "save all article data in CSVs".
                    # Storing comments in a CSV cell is messy. 
                    # Let's keep comments separate or linked. 
                    # For now, we'll load comments from the existing JSON or a new CSV.
                    # The prompt said "save all article data in CSVs... without hardcoding".
                    # I will stick to the pattern: Article Metadata in CSV. Comments can stay in JSON or move to their own CSV.
                    # Let's keep comments in JSON for now to minimize breakage, as the prompt focused on "article data".
                    # Or better, move comments to comments.csv.
                    # For this step, I'll just handle the article fields.
                except Exception as e:
                    print(f"Error parsing row {row.get('id')}: {e}")
                    continue
                articles.append(row)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return []
    return articles

def save_articles_to_csv(articles):
    """Saves list of articles to CSV."""
    try:
        with open(ARTICLES_CSV, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'title', 'subheading', 'content', 'author', 'date', 'category', 'hashtags', 'cover_image', 'likes', 'dislikes', 'shares', 'liked_by', 'disliked_by'])
            for a in articles:
                writer.writerow([
                    a.get('id'),
                    a.get('title'),
                    a.get('subheading'),
                    a.get('content'),
                    a.get('author'),
                    a.get('date'),
                    a.get('category'),
                    json.dumps(a.get('hashtags', [])),
                    a.get('cover_image'),
                    a.get('likes', 0),
                    a.get('dislikes', 0),
                    a.get('shares', 0),
                    json.dumps(a.get('liked_by', [])),
                    json.dumps(a.get('disliked_by', []))
                ])
        return True
    except Exception as e:
        print(f"Error saving to CSV: {e}")
        return False
