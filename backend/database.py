import csv
import os
import json
import time
from datetime import datetime
from firebase_admin import firestore, auth
from backend.firebase_admin_setup import get_db, get_auth

# --- Paths ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
ARTICLES_CSV = os.path.join(DATA_DIR, 'articles.csv')
IDEAS_CSV = os.path.join(DATA_DIR, 'ideas.csv')
COMMENTS_CSV = os.path.join(DATA_DIR, 'comments.csv') 
TIER_LIMITS_CSV = os.path.join(DATA_DIR, 'tier_limits.csv')
CHATS_FILE = os.path.join(BASE_DIR, 'chats.json')
USER_PROFILES_CSV = os.path.join(BASE_DIR, 'user_profiles.csv')

# Ensure data dir exists
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# Tier Hierarchy for upgrades
TIER_ORDER = ["Basic", "Pro", "Enterprise", "Singularity"]

# --- LIMIT LOGIC (NEW) ---

def load_tier_limits():
    """Reads the CSV and returns a nested dictionary of limits."""
    limits = {}
    if os.path.exists(TIER_LIMITS_CSV):
        try:
            with open(TIER_LIMITS_CSV, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    tier = row['Tier'].strip()
                    product = row['Product'].strip()
                    limit_str = row['Limit'].strip()
                    
                    if tier not in limits: limits[tier] = {}
                    limits[tier][product] = limit_str
        except Exception as e:
            print(f"Error loading limits CSV: {e}")
    return limits

def get_next_tier_with_access(current_tier, product):
    """Finds the next higher tier that has access (not NA)."""
    try:
        current_idx = TIER_ORDER.index(current_tier)
    except ValueError:
        current_idx = -1 # Treat as below Basic
        
    limits = load_tier_limits()
    
    for i in range(current_idx + 1, len(TIER_ORDER)):
        next_tier = TIER_ORDER[i]
        tier_limits = limits.get(next_tier, {})
        limit = tier_limits.get(product, "NA")
        if limit != "NA":
            return next_tier
    return "Enterprise" # Fallback

def verify_access_and_limits(email, product):
    """
    Checks if a user can access a product based on tier and limits.
    Returns dict: { "allowed": bool, "reason": str, "message": str }
    """
    try:
        db = get_db()
        
        # 1. Get User Tier
        # Hardcode Super Admin to Singularity to avoid DB sync issues
        SUPER_ADMIN_EMAIL = "marketinsightscenter@gmail.com"
        if email.lower() == SUPER_ADMIN_EMAIL:
            tier = "Singularity"
        else:
            user_ref = db.collection('users').document(email)
            user_doc = user_ref.get()
            tier = 'Basic'
            if user_doc.exists:
                tier = user_doc.to_dict().get('tier', 'Basic')
            
        # 2. Get Limit for Tier/Product
        all_limits = load_tier_limits()
        tier_limits = all_limits.get(tier, {})
        limit_str = tier_limits.get(product, "NA") # Default to NA if not found
        
        # 3. Handle Special Cases
        if limit_str == "NA":
            next_tier = get_next_tier_with_access(tier, product)
            return {
                "allowed": False, 
                "reason": "no_access", 
                "message": f"Your current tier ({tier}) does not have access to {product}. Please upgrade to {next_tier}."
            }
            
        if limit_str == "NL":
            return {"allowed": True, "reason": "no_limit", "message": "Access granted."}

        # 4. Parse Limit (e.g., "10/day")
        try:
            limit_val_str, unit = limit_str.split('/')
            limit_val = int(limit_val_str)
        except:
            print(f"Invalid limit format for {tier}/{product}: {limit_str}")
            return {"allowed": False, "reason": "error", "message": "System configuration error."}

        # 5. Determine Time Window Key
        now = datetime.utcnow()
        if unit == 'second': time_key = now.strftime('%Y-%m-%d-%H-%M-%S')
        elif unit == 'minute': time_key = now.strftime('%Y-%m-%d-%H-%M')
        elif unit == 'hour': time_key = now.strftime('%Y-%m-%d-%H')
        elif unit == 'day': time_key = now.strftime('%Y-%m-%d')
        elif unit == 'week': time_key = now.strftime('%Y-%W')
        elif unit == 'month': time_key = now.strftime('%Y-%m')
        else: time_key = now.strftime('%Y-%m-%d') # Default to day

        # 6. Check Usage in Firestore
        usage_ref = user_ref.collection('usage_logs').document(f"{product}_{time_key}")
        
        @firestore.transactional
        def increment_usage(transaction, ref):
            snapshot = transaction.get(ref)
            current_count = 0
            if snapshot.exists:
                current_count = snapshot.get('count') or 0
            
            if current_count < limit_val:
                transaction.set(ref, {'count': current_count + 1}, merge=True)
                return True
            return False

        transaction = db.transaction()
        success = increment_usage(transaction, usage_ref)
        
        if success:
            return {"allowed": True, "reason": "authorized", "message": "Access granted."}
        else:
             return {
                 "allowed": False, 
                 "reason": "limit_exceeded", 
                 "message": f"You have reached your {product} limit of {limit_str}. Please upgrade to increase your limits."
             }

    except Exception as e:
        print(f"Limit Check Error: {e}")
        return {"allowed": False, "reason": "error", "message": "An error occurred checking limits."}

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

def create_user_profile(email, uid, username=None):
    """Creates a new user profile in Firestore."""
    try:
        db = get_db()
        # Check if exists first to avoid overwriting
        doc_ref = db.collection('users').document(email)
        doc = doc_ref.get()
        
        if not doc.exists:
            # If no username provided, generate a temp one
            if not username:
                username = f"User_{int(time.time())}"
            else:
                 # Ensure uniqueness for provided username
                 original_username = username
                 count = 1
                 while check_username_taken(username):
                      username = f"{original_username} {count}"
                      count += 1

            data = {
                'email': email,
                'uid': uid,
                'username': username,
                'tier': 'Basic',
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

def check_username_taken(username):
    """Checks if a username is already taken by ANOTHER user."""
    try:
        db = get_db()
        # Query users collection where username == username
        docs = db.collection('users').where('username', '==', username).stream()
        for _ in docs:
            return True # Found a match
        return False
    except Exception as e:
        print(f"Error checking username: {e}")
        return True # Fail safe: assume taken if error to prevent dupes

def update_user_username(email, new_username):
    """Updates username if unique."""
    if check_username_taken(new_username):
        return {"success": False, "message": "Username already taken"}
        
    try:
        db = get_db()
        db.collection('users').document(email).set({'username': new_username}, merge=True)
        return {"success": True, "message": "Username updated"}
    except Exception as e:
        return {"success": False, "message": str(e)}

def get_all_users_from_db():
    """Fetches ALL users from Auth and merges with Firestore Tier data."""
    try:
        # 1. Get all Auth users (Source of Truth)
        auth_users = []
        page = get_auth().list_users()
        while page:
            auth_users.extend(page.users)
            page = page.get_next_page()
            
        # 2. Get all Firestore profiles (Tiers)
        db = get_db()
        docs = db.collection('users').stream()
        db_data = {doc.id: doc.to_dict() for doc in docs}
        
        # 3. Merge
        final_list = []
        for user in auth_users:
            email = user.email
            if not email: continue
            
            profile = db_data.get(email, {})
            # Get display name or fallback to "User"
            username = user.display_name if user.display_name else "User"
            
            final_list.append({
                'email': email,
                'username': username, # Added username
                'uid': user.uid,
                'tier': profile.get('tier', 'Basic'),
                'subscription_status': profile.get('subscription_status', 'none')
            })
        return final_list
    except Exception as e:
        print(f"Error fetching users: {e}")
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