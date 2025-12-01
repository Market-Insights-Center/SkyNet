import csv
import os
import json
import time
from datetime import datetime
from firebase_admin import firestore, auth
from firebase_admin_setup import get_db, get_auth

# --- Paths ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
ARTICLES_CSV = os.path.join(DATA_DIR, 'articles.csv')
IDEAS_CSV = os.path.join(DATA_DIR, 'ideas.csv')
COMMENTS_CSV = os.path.join(DATA_DIR, 'comments.csv') 
CHATS_FILE = os.path.join(BASE_DIR, 'chats.json')
USER_PROFILES_CSV = os.path.join(BASE_DIR, 'user_profiles.csv')

# Ensure data dir exists
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# --- TIER CONFIGURATION ---
TIER_LIMITS = {
    "Free": {"portfolio_lab": 1, "cultivate": 0, "news_depth": 5},
    "Basic": {"portfolio_lab": 10, "cultivate": 5, "news_depth": 50},
    "Pro": {"portfolio_lab": 50, "cultivate": 20, "news_depth": 200},
    "Visionary": {"portfolio_lab": 50, "cultivate": 20, "news_depth": 200}, 
    "Institutional": {"portfolio_lab": 500, "cultivate": 100, "news_depth": 1000},
    "Enterprise": {"portfolio_lab": 500, "cultivate": 100, "news_depth": 1000},
    "Singularity": {"portfolio_lab": float('inf'), "cultivate": float('inf'), "news_depth": float('inf')}
}

# --- FIRESTORE USER HELPERS ---

def get_user_profile(email):
    """Fetches full user profile including tier and subscription status."""
    try:
        db = get_db()
        doc = db.collection('users').document(email).get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception as e:
        print(f"Error fetching user profile: {e}")
        return None

def update_user_tier(email, tier, subscription_id=None, status="active"):
    """Updates a user's subscription tier."""
    try:
        db = get_db()
        data = {
            'tier': tier,
            'subscription_status': status,
            'updated_at': firestore.SERVER_TIMESTAMP
        }
        if subscription_id:
            data['subscription_id'] = subscription_id
            
        db.collection('users').document(email).set(data, merge=True)
        return True
    except Exception as e:
        print(f"Error updating tier: {e}")
        return False

def create_user_profile(email, uid):
    """Creates a new user profile in Firestore."""
    try:
        db = get_db()
        # Check if exists first to avoid overwriting
        doc_ref = db.collection('users').document(email)
        doc = doc_ref.get()
        
        if not doc.exists:
            data = {
                'email': email,
                'uid': uid,
                'tier': 'Free',
                'subscription_status': 'none',
                'created_at': firestore.SERVER_TIMESTAMP,
                'risk_tolerance': 5, # Default
                'trading_frequency': 'Once A Week', # Default
                'portfolio_types': ['Stocks'] # Default
            }
            doc_ref.set(data)
            return True
        return False
    except Exception as e:
        print(f"Error creating user profile: {e}")
        return False

def get_all_users_from_db():
    """Fetches ALL users using robust iterate_all() method."""
    try:
        print("Attempting to fetch users from Firebase Auth...")
        auth_users = []
        
        # FIX: Use iterate_all() to automatically handle pagination
        try:
            for user in get_auth().list_users().iterate_all():
                auth_users.append(user)
            print(f"Successfully retrieved {len(auth_users)} users from Auth.")
        except Exception as e:
            print(f"AUTH ERROR: Could not list users. Check serviceAccountKey.json. Details: {e}")
            return []

        # Fetch Firestore profiles to merge Tier data
        db_data = {}
        try:
            db = get_db()
            docs = db.collection('users').stream()
            for doc in docs:
                db_data[doc.id] = doc.to_dict()
        except Exception as e:
            print(f"FIRESTORE ERROR: Could not fetch profiles. Defaults will be used. Details: {e}")

        # Merge data
        final_list = []
        for user in auth_users:
            email = user.email
            if not email: continue
            
            profile = db_data.get(email, {})
            final_list.append({
                'email': email,
                'uid': user.uid,
                'tier': profile.get('tier', 'Free'),
                'subscription_status': profile.get('subscription_status', 'none')
            })
            
        return final_list
    except Exception as e:
        print(f"CRITICAL ERROR in get_all_users_from_db: {e}")
        return []

def delete_user_full(email):
    """Deletes user from Auth and Firestore."""
    try:
        # 1. Find UID from email
        user = get_auth().get_user_by_email(email)
        uid = user.uid
        
        # 2. Delete from Auth
        get_auth().delete_user(uid)
        
        # 3. Delete from Firestore
        db = get_db()
        db.collection('users').document(email).delete()
        
        return True
    except Exception as e:
        print(f"Delete Error: {e}")
        return False

# --- USAGE LIMIT ENFORCEMENT ---

def check_and_increment_limit(email, feature_key):
    try:
        db = get_db()
        user_ref = db.collection('users').document(email)
        user_doc = user_ref.get()
        
        if user_doc.exists:
            user_data = user_doc.to_dict()
            tier = user_data.get('tier', 'Free')
        else:
            tier = 'Free'
        
        if tier == 'Singularity':
            return True
            
        limit = TIER_LIMITS.get(tier, TIER_LIMITS['Free']).get(feature_key, 0)
        current_month = datetime.now().strftime('%Y-%m')
        usage_ref = user_ref.collection('usage_logs').document(current_month)
        
        @firestore.transactional
        def update_in_transaction(transaction, usage_ref):
            snapshot = transaction.get(usage_ref)
            current_count = 0
            if snapshot.exists:
                current_count = snapshot.get(feature_key) or 0
            
            if current_count < limit:
                transaction.set(usage_ref, {feature_key: current_count + 1}, merge=True)
                return True
            else:
                return False

        transaction = db.transaction()
        return update_in_transaction(transaction, usage_ref)

    except Exception as e:
        print(f"Usage Check Error: {e}")
        return False 

# --- COUPONS ---

def create_coupon(code, plan_id, applicable_tier, discount_label):
    try:
        db = get_db()
        db.collection('coupons').document(code).set({
            'code': code,
            'plan_id': plan_id,
            'applicable_tier': applicable_tier,
            'discount_label': discount_label,
            'active': True,
            'created_at': firestore.SERVER_TIMESTAMP
        })
        return True
    except Exception as e:
        print(f"Error creating coupon: {e}")
        return False

def get_all_coupons():
    try:
        db = get_db()
        docs = db.collection('coupons').stream()
        return [doc.to_dict() for doc in docs]
    except:
        return []

def validate_coupon(code):
    try:
        db = get_db()
        doc = db.collection('coupons').document(code).get()
        if doc.exists and doc.get('active'):
            return doc.to_dict()
        return None
    except Exception as e:
        return None

def delete_coupon(code):
    try:
        db = get_db()
        db.collection('coupons').document(code).delete()
        return True
    except:
        return False

# --- CSV HELPERS (ARTICLES) ---

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
                    
                    def safe_int(val):
                        try:
                            return int(val) if val and val.lower() != 'nan' else 0
                        except:
                            return 0

                    row['likes'] = safe_int(row.get('likes'))
                    row['dislikes'] = safe_int(row.get('dislikes'))
                    row['shares'] = safe_int(row.get('shares'))
                    
                    if not row.get('date'):
                        row['date'] = datetime.utcnow().strftime('%Y-%m-%d')

                    try: row['hashtags'] = json.loads(row['hashtags']) if row.get('hashtags') else []
                    except: row['hashtags'] = []
                    
                    try: row['liked_by'] = json.loads(row['liked_by']) if row.get('liked_by') else []
                    except: row['liked_by'] = []
                    
                    try: row['disliked_by'] = json.loads(row['disliked_by']) if row.get('disliked_by') else []
                    except: row['disliked_by'] = []
                    
                    articles.append(row)
                except Exception as e:
                    print(f"Error parsing article row {row.get('id')}: {e}")
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
                    a.get('shares', 0),
                    json.dumps(a.get('liked_by', [])),
                    json.dumps(a.get('disliked_by', []))
                ])
        return True
    except Exception as e:
        print(f"Error saving to CSV: {e}")
        return False

def delete_article(article_id):
    articles = read_articles_from_csv()
    new_articles = [a for a in articles if str(a['id']) != str(article_id)]
    if len(articles) == len(new_articles):
        return False
    return save_articles_to_csv(new_articles)

# --- CSV HELPERS (IDEAS) ---

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
                    
                    def safe_int(val):
                        try: return int(val) if val and val.lower() != 'nan' else 0
                        except: return 0

                    row['likes'] = safe_int(row.get('likes'))
                    row['dislikes'] = safe_int(row.get('dislikes'))
                    
                    if not row.get('date'):
                        row['date'] = datetime.utcnow().strftime('%Y-%m-%d')
                    
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

def delete_idea(idea_id):
    ideas = read_ideas_from_csv()
    new_ideas = [i for i in ideas if str(i['id']) != str(idea_id)]
    if len(ideas) == len(new_ideas):
        return False
    return save_ideas_to_csv(new_ideas)

# --- CSV HELPERS (COMMENTS) ---

def init_comments_csv():
    if not os.path.exists(COMMENTS_CSV):
        with open(COMMENTS_CSV, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'idea_id', 'article_id', 'user_id', 'user', 'email', 'text', 'date', 'isAdmin'])

def read_comments_from_csv():
    comments = []
    if not os.path.exists(COMMENTS_CSV):
        init_comments_csv()
        return []
    
    try:
        with open(COMMENTS_CSV, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    row['id'] = int(row['id']) if row.get('id') else 0
                    
                    def safe_id(val):
                        try: return int(val) if val and val != '' else 0
                        except: return 0

                    row['idea_id'] = safe_id(row.get('idea_id'))
                    row['article_id'] = safe_id(row.get('article_id'))
                    
                    row['isAdmin'] = True if row.get('isAdmin') == 'True' else False
                    comments.append(row)
                except Exception as e:
                    print(f"Error parsing comment row: {e}")
                    continue
    except Exception as e:
        print(f"Error reading Comments CSV: {e}")
        return []
    return comments

def save_comments_to_csv(comments):
    try:
        with open(COMMENTS_CSV, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'idea_id', 'article_id', 'user_id', 'user', 'email', 'text', 'date', 'isAdmin'])
            for c in comments:
                writer.writerow([
                    c.get('id'),
                    c.get('idea_id', 0),
                    c.get('article_id', 0), 
                    c.get('user_id'),
                    c.get('user'),
                    c.get('email'),
                    c.get('text'),
                    c.get('date'),
                    c.get('isAdmin', False)
                ])
        return True
    except Exception as e:
        print(f"Error saving to Comments CSV: {e}")
        return False

def delete_comment(comment_id):
    """Deletes a comment by ID."""
    comments = read_comments_from_csv()
    new_comments = [c for c in comments if str(c['id']) != str(comment_id)]
    if len(comments) == len(new_comments):
        return False
    return save_comments_to_csv(new_comments)

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