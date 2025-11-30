import csv
import os
import json
from firebase_admin import firestore
# Import the setup functions from your existing setup file
from firebase_admin_setup import get_db, get_auth

# --- Firebase Helpers ---

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
ARTICLES_CSV = os.path.join(DATA_DIR, 'articles.csv')
IDEAS_CSV = os.path.join(DATA_DIR, 'ideas.csv')
CHATS_FILE = os.path.join(BASE_DIR, 'chats.json') 
USER_PROFILES_CSV = os.path.join(BASE_DIR, 'user_profiles.csv')

# Ensure data dir exists
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

def get_all_users_count():
    try:
        # Corrected: use get_auth() to access the auth instance
        page = get_auth().list_users()
        count = 0
        while page:
            count += len(page.users)
            page = page.get_next_page()
        return count
    except Exception as e:
        print(f"Error fetching user count: {e}")
        return 0

def save_subscription(email, plan, cost):
    try:
        # Corrected: get_db() is now imported
        db = get_db()
        doc_ref = db.collection('subscriptions').document(email)
        doc_ref.set({
            'email': email,
            'plan': plan,
            'cost': cost,
            'updated_at': firestore.SERVER_TIMESTAMP # Corrected: firestore is imported
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

# --- CSV Helpers ---

def init_articles_csv():
    if not os.path.exists(ARTICLES_CSV):
        with open(ARTICLES_CSV, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'title', 'subheading', 'content', 'author', 'date', 'category', 'hashtags', 'cover_image', 'likes', 'dislikes', 'shares', 'liked_by', 'disliked_by'])

def read_articles_from_csv():
    articles = []
    if not os.path.exists(ARTICLES_CSV):
        init_articles_csv()
        return []
    
    try:
        with open(ARTICLES_CSV, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    row['id'] = int(row['id']) if row.get('id') else 0
                    row['likes'] = int(row['likes']) if row.get('likes') else 0
                    row['dislikes'] = int(row['dislikes']) if row.get('dislikes') else 0
                    # Ensure shares are read correctly
                    row['shares'] = int(row['shares']) if row.get('shares') and row.get('shares') != '' else 0
                    
                    try: row['hashtags'] = json.loads(row['hashtags']) if row.get('hashtags') else []
                    except: row['hashtags'] = []
                    
                    try: row['liked_by'] = json.loads(row['liked_by']) if row.get('liked_by') else []
                    except: row['liked_by'] = []
                    
                    try: row['disliked_by'] = json.loads(row['disliked_by']) if row.get('disliked_by') else []
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
                    a.get('shares', 0), # Save shares
                    json.dumps(a.get('liked_by', [])),
                    json.dumps(a.get('disliked_by', []))
                ])
        return True
    except Exception as e:
        print(f"Error saving to CSV: {e}")
        return False

# --- Ideas CSV Helpers ---

def init_ideas_csv():
    if not os.path.exists(IDEAS_CSV):
        with open(IDEAS_CSV, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'ticker', 'title', 'description', 'author', 'date', 'hashtags', 'cover_image', 'likes', 'dislikes', 'liked_by', 'disliked_by'])

def read_ideas_from_csv():
    ideas = []
    if not os.path.exists(IDEAS_CSV):
        init_ideas_csv()
        return []
    
    try:
        with open(IDEAS_CSV, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    row['id'] = int(row['id']) if row.get('id') else 0
                    row['likes'] = int(row['likes']) if row.get('likes') else 0
                    row['dislikes'] = int(row['dislikes']) if row.get('dislikes') else 0
                    
                    try: row['hashtags'] = json.loads(row['hashtags']) if row.get('hashtags') else []
                    except: row['hashtags'] = []
                    
                    try: row['liked_by'] = json.loads(row['liked_by']) if row.get('liked_by') else []
                    except: row['liked_by'] = []
                    
                    try: row['disliked_by'] = json.loads(row['disliked_by']) if row.get('disliked_by') else []
                    except: row['disliked_by'] = []
                    
                    ideas.append(row)
                except Exception as e:
                    print(f"Error parsing idea row {row.get('id')}: {e}")
                    continue
    except Exception as e:
        print(f"Error reading Ideas CSV: {e}")
        return []
    return ideas

def save_ideas_to_csv(ideas):
    try:
        with open(IDEAS_CSV, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'ticker', 'title', 'description', 'author', 'date', 'hashtags', 'cover_image', 'likes', 'dislikes', 'liked_by', 'disliked_by'])
            for i in ideas:
                writer.writerow([
                    i.get('id'),
                    i.get('ticker'),
                    i.get('title'),
                    i.get('description'),
                    i.get('author'),
                    i.get('date'),
                    json.dumps(i.get('hashtags', [])),
                    i.get('cover_image'),
                    i.get('likes', 0),
                    i.get('dislikes', 0),
                    json.dumps(i.get('liked_by', [])),
                    json.dumps(i.get('disliked_by', []))
                ])
        return True
    except Exception as e:
        print(f"Error saving to Ideas CSV: {e}")
        return False

def read_user_profiles():
    """Reads questionnaire data from CSV."""
    profiles = {}
    if not os.path.exists(USER_PROFILES_CSV):
        return profiles
    try:
        with open(USER_PROFILES_CSV, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('email'):
                    profiles[row['email']] = row
    except Exception as e:
        print(f"Error reading profiles: {e}")
    return profiles

# --- Chat Helpers ---
def read_chats():
    if not os.path.exists(CHATS_FILE):
        return []
    try:
        with open(CHATS_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def save_chats(chats):
    try:
        with open(CHATS_FILE, 'w') as f:
            json.dump(chats, f, indent=4)
        return True
    except:
        return False