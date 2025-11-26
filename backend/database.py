import csv
import os
import json
from firebase_admin_setup import get_db, get_auth
from firebase_admin import auth, firestore

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
import csv
import os
import json
from firebase_admin_setup import get_db, get_auth
from firebase_admin import auth, firestore

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
    # Removed 'comments' from header to match save_articles_to_csv
    if not os.path.exists(ARTICLES_CSV):
        with open(ARTICLES_CSV, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'title', 'subheading', 'content', 'author', 'date', 'category', 'hashtags', 'cover_image', 'likes', 'dislikes', 'shares', 'liked_by', 'disliked_by'])

def read_articles_from_csv():
    """Reads articles from CSV."""
    articles = []
    if not os.path.exists(ARTICLES_CSV):
        init_articles_csv()
        return []
    
    try:
        with open(ARTICLES_CSV, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    # Robust type conversion
                    row['id'] = int(row['id']) if row.get('id') else 0
                    row['likes'] = int(row['likes']) if row.get('likes') else 0
                    row['dislikes'] = int(row['dislikes']) if row.get('dislikes') else 0
                    row['shares'] = int(row['shares']) if row.get('shares') else 0
                    
                    # Handle JSON fields safely
                    try:
                        row['hashtags'] = json.loads(row['hashtags']) if row.get('hashtags') else []
                    except: row['hashtags'] = []
                    
                    try:
                        row['liked_by'] = json.loads(row['liked_by']) if row.get('liked_by') else []
                    except: row['liked_by'] = []
                    
                    try:
                        row['disliked_by'] = json.loads(row['disliked_by']) if row.get('disliked_by') else []
                    except: row['disliked_by'] = []
                    
                    articles.append(row)
                except Exception as e:
                    print(f"Error parsing row {row.get('id')}: {e}")
                    continue
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