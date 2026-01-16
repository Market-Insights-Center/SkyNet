import csv
import os
import json
import time
import random
import string
import uuid
from datetime import datetime, timedelta
from firebase_admin import firestore, auth
try:
    from backend.firebase_admin_setup import get_db, get_auth
except ImportError:
    from firebase_admin_setup import get_db, get_auth

# --- Paths ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
ARTICLES_CSV = os.path.join(DATA_DIR, 'articles.csv')
IDEAS_CSV = os.path.join(DATA_DIR, 'ideas.csv')
COMMENTS_CSV = os.path.join(DATA_DIR, 'comments.csv') 
TIER_LIMITS_CSV = os.path.join(DATA_DIR, 'tier_limits.csv')
POINTS_RULES_CSV = os.path.join(DATA_DIR, 'points_rules.csv')
CHATS_FILE = os.path.join(BASE_DIR, 'chats.json')
USER_PROFILES_CSV = os.path.join(BASE_DIR, 'user_profiles.csv')
BANNERS_FILE = os.path.join(DATA_DIR, 'banners.json')
BANNERS_DEFAULT_FILE = os.path.join(DATA_DIR, 'banners_default.json')

# Ensure data dir exists
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# Tier Hierarchy for upgrades
TIER_ORDER = ["Basic", "Pro", "Enterprise", "Singularity"]

# --- GLOBAL CACHE ---
_leaderboard_cache = {
    "data": [],
    "timestamp": 0
}

_rank_cache = {}

# --- CHAT CACHE ---
_chat_cache = {
    "data": [],
    "mtime": 0
}

# --- CONTENT CACHES ---
_banners_cache = {
    "data": [],
    "mtime": 0
}
_articles_cache = {
    "data": [],
    "mtime": 0
}
_ideas_cache = {
    "data": [],
    "mtime": 0
}
_comments_cache = {
    "data": [],
    "mtime": 0
}


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
        tier = "Basic" # Default
        
        # Hardcode Super Admin to Singularity to avoid DB sync issues
        SUPER_ADMIN_EMAIL = "marketinsightscenter@gmail.com"
        if email and email.lower().strip() == SUPER_ADMIN_EMAIL:
            tier = "Singularity"
        else:
            # Fetch from DB
            user_ref = db.collection('users').document(email)
            user_doc = user_ref.get()
            if user_doc.exists:
                tier = user_doc.to_dict().get('tier', 'Basic')

        if str(tier).strip().lower() == "singularity":
            try:
                add_points(email, product)
            except: pass
            return {"allowed": True, "reason": "no_limit", "message": "Singularity Access."}


            
        # 2. Get Limit for Tier/Product
        all_limits = load_tier_limits()
        tier_limits = all_limits.get(tier, {})
        limit_str = tier_limits.get(product, "NA") # Default to NA if not found
        
        # 3. Handle Special Cases
        if limit_str == "NA":
            next_tier = get_next_tier_with_access(tier, product)
            return {
                "allowed": False, 
                "reason": "locked", 
                "message": f"This feature is locked to the {next_tier} tier. Please upgrade to access {product}."
            }
            
        if limit_str == "NL":
            add_points(email, product)
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
            # AUTOMATICALLY AWARD POINTS FOR USAGE
            # This ensures every successful command usage that hits a limit check gets points.
            try:
                 add_points(email, product)
            except Exception as e:
                 print(f"Error auto-awarding points for {product}: {e}")

            return {"allowed": True, "reason": "authorized", "message": "Access granted."}
        else:
             next_tier = get_next_tier_with_access(tier, product)
             return {
                 "allowed": False, 
                 "reason": "limit_exceeded", 
                 "message": f"You have reached your {limit_str} limit for {product}. Please upgrade to {next_tier} to increase your limits."
             }

    except Exception as e:
        print(f"Limit Check Error: {e}")
        return {"allowed": False, "reason": "error", "message": "An error occurred checking limits."}

def verify_storage_limit(email, product, current_count):
    """
    Checks if a user's current storage count exceeds the limit for their tier.
    Used for stored items like 'database_portfolio' or 'database_nexus'.
    """
    try:
        # 1. Get User Profile for Tier
        profile = get_user_profile(email)
        tier = profile.get('tier', 'Basic') if profile else 'Basic'
        
        # Super Admin Bypass
        if email and email.lower().strip() == "marketinsightscenter@gmail.com":
            tier = "Singularity"
            
        if tier and str(tier).strip().lower() == "singularity": return {"allowed": True}
            
        # 2. Get Limits
        limits = load_tier_limits()
        tier_limits = limits.get(tier, {})
        limit_str = tier_limits.get(product, "0") # Default to 0 if not defined
        
        # 3. Handle Special Strings
        if limit_str == "NL": return {"allowed": True}
        if limit_str == "NA": 
             next_tier = get_next_tier_with_access(tier, product)
             return {"allowed": False, "message": f"This feature is locked to the {next_tier} tier."}
        
        # 4. Check Count
        try:
             max_limit = int(limit_str)
             if current_count >= max_limit:
                 next_tier = get_next_tier_with_access(tier, product)
                 return {
                     "allowed": False, 
                     "message": f"You have reached your limit of {max_limit} for {product}. Upgrade to {next_tier} for more."
                 }
             return {"allowed": True}
        except ValueError:
            return {"allowed": False, "message": "Configuration Error"}
            
    except Exception as e:
        print(f"Storage Limit Check Error: {e}")
        return {"allowed": False, "message": "System Error"}

# --- FIRESTORE USER HELPERS ---

def get_user_profile(email):
    """Fetches full user profile including tier and subscription status."""
    try:
        db = get_db()
        doc = db.collection('users').document(email).get()
        if doc.exists:
            data = doc.to_dict()
            # Auto-fix missing username on read
            if not data.get('username') or not data.get('username').strip():
                data['username'] = ensure_username(email)
            return data
        return None
    except Exception as e:
        print(f"Error fetching user profile: {e}")
        return None

# --- SHARED AUTOMATIONS (COMMUNITY) ---

def share_automation(automation_data, username):
    """
    Saves an automation to the public 'community_automations' collection.
    """
    try:
        db = get_db()
        # Create a new document in community_automations
        # sanitize data
        shared_doc = {
            "name": automation_data.get("name", "Untitled"),
            "description": automation_data.get("description", ""),
            "nodes": automation_data.get("nodes", []),
            "edges": automation_data.get("edges", []),
            "creator": username,
            "created_at": datetime.utcnow().isoformat(),
            "copy_count": 0,
            "original_id": automation_data.get("id")
        }
        res = db.collection('community_automations').add(shared_doc)
        return {"success": True, "id": res[1].id}
    except Exception as e:
        print(f"Error sharing automation: {e}")
        return {"success": False, "message": str(e)}

def get_community_automations(sort_by="recent"):
    """
    Fetches shared automations.
    sort_by: 'recent' or 'popular'
    """
    try:
        db = get_db()
        ref = db.collection('community_automations')
        
        if sort_by == 'popular':
            docs = ref.order_by('copy_count', direction=firestore.Query.DESCENDING).limit(50).stream()
        else:
            docs = ref.order_by('created_at', direction=firestore.Query.DESCENDING).limit(50).stream()
            
        results = []
        for d in docs:
            data = d.to_dict()
            data['id'] = d.id
            results.append(data)
        return results
    except Exception as e:
        print(f"Error fetching community automations: {e}")
        return []

def increment_copy_count(shared_id):
    try:
        db = get_db()
        ref = db.collection('community_automations').document(shared_id)
        ref.update({"copy_count": firestore.Increment(1)})
        return True
    except: return False

# --- SHARED PORTFOLIOS (COMMUNITY) ---

def share_portfolio(data, username):
    """
    Saves a portfolio/nexus code to 'community_portfolios'.
    """
    try:
        db = get_db()
        code_name = data.get('nexus_code') if data.get('type') == 'nexus' else data.get('portfolio_code')
        
        shared_doc = {
            "type": data.get("type", "portfolio"),
            "code": code_name, # Display name
            "data": data, # Full payload
            "creator": username,
            "created_at": datetime.utcnow().isoformat(),
            "copy_count": 0,
            "original_id": code_name
        }
        res = db.collection('community_portfolios').add(shared_doc)
        return {"success": True, "id": res[1].id}
    except Exception as e:
        print(f"Error sharing portfolio: {e}")
        return {"success": False, "message": str(e)}

def get_community_portfolios(sort_by="recent"):
    try:
        db = get_db()
        ref = db.collection('community_portfolios')
        
        if sort_by == 'popular':
            docs = ref.order_by('copy_count', direction=firestore.Query.DESCENDING).limit(50).stream()
        else:
            docs = ref.order_by('created_at', direction=firestore.Query.DESCENDING).limit(50).stream()
            
        results = []
        for d in docs:
            data = d.to_dict()
            data['id'] = d.id
            results.append(data)
        return results
    except Exception as e:
        print(f"Error fetching community portfolios: {e}")
        return []

def increment_portfolio_copy(shared_id):
    try:
        db = get_db()
        ref = db.collection('community_portfolios').document(shared_id)
        ref.update({"copy_count": firestore.Increment(1)})
        return True
    except: return False



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
        
        # Check for referral rewards
        check_referral_reward(email, tier)

        # AWARD POINTS FOR SUBSCRIPTION
        # Map tier to action key in points_rules.csv
        tier_action_map = {
            "Pro": "pro_month",
            "Enterprise": "enterprise_month"
        }
        action = tier_action_map.get(tier)
        if action:
            try:
                add_points(email, action)
                print(f"Awarded subscription points ({action}) to {email}")
            except Exception as e:
                print(f"Error awarding subscription points: {e}")
        
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
            # If no username provided, use email prefix
            if not username:
                username = email.split('@')[0]
            
            # Ensure uniqueness for FINAL username (whether provided or auto-generated)
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
                'portfolio_types': ['Stocks'], # Default
                'settings': {'show_leaderboard': True} # Default Opt-in
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
        docs = db.collection('users').where(field_path='username', op_string='==', value=username).stream()
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

def ensure_username(email, input_username=None):
    """
    Ensures a user has a username. 
    If not, generates one from email, checks uniqueness, and saves it.
    Returns the final username.
    """
    if input_username and input_username.strip():
        return input_username
        
    # Generate from email
    base_name = email.split('@')[0]
    username = base_name
    
    # Ensure uniqueness
    if check_username_taken(username):
        count = 1
        username = f"{base_name} {count}"
        while check_username_taken(username):
             count += 1
             username = f"{base_name} {count}"

    # Update DB
    try:
        db = get_db()
        db.collection('users').document(email).set({'username': username}, merge=True)
        print(f"Auto-assigned username '{username}' to {email}")
    except Exception as e:
        print(f"Error auto-assigning username: {e}")
        
    return username

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
            # Prioritize Firestore username
            username = profile.get('username')
            
            # Auto-fix missing username
            if not username or not username.strip():
                 # Use Auth display name as fallback seed if no username in DB
                 # But prompt says "first part of their email"
                 # Only use display name if it LOOKS like a username (no spaces? or valid?)
                 # Actually, prompt says: "set their username automatically to whatever the first part of their email is"
                 # So we prioritize email prefix over potentially random Auth display name "User" or "Jasper P" if it's not in DB.
                 # Let's stick to email prefix as requested.
                 username = ensure_username(email, username)
            
            final_list.append({
                'email': email,
                'username': username,
                'uid': user.uid,
                'tier': profile.get('tier', 'Basic'),
                'subscription_status': profile.get('subscription_status', 'none'),
                'last_seen': profile.get('last_seen', None) # Return last_seen
            })
        return final_list
    except Exception as e:
        print(f"Error fetching users: {e}")
        return []

def update_user_heartbeat(email):
    """Updates the user's last_seen timestamp."""
    try:
        db = get_db()
        db.collection('users').document(email).set({
            'last_seen': firestore.SERVER_TIMESTAMP
        }, merge=True)
        return True
    except Exception as e:
        print(f"Error updating heartbeat: {e}")
        return False

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
    global _articles_cache
    if not os.path.exists(ARTICLES_CSV):
        init_articles_csv()
        return []
    
    try:
        current_mtime = os.path.getmtime(ARTICLES_CSV)
        if current_mtime <= _articles_cache["mtime"]:
            return _articles_cache["data"]

        articles = []
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
        
        # Update Cache
        _articles_cache = {"data": articles, "mtime": current_mtime}
        return articles

    except Exception as e:
        print(f"Error reading CSV: {e}")
        return []

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
    global _ideas_cache
    if not os.path.exists(IDEAS_CSV):
        init_ideas_csv()
        return []
    
    try:
        current_mtime = os.path.getmtime(IDEAS_CSV)
        if current_mtime <= _ideas_cache["mtime"]:
            return _ideas_cache["data"]

        ideas = []
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
        
        # Update Cache
        _ideas_cache = {"data": ideas, "mtime": current_mtime}
        return ideas

    except Exception as e:
        print(f"Error reading Ideas CSV: {e}")
        return []

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
    global _comments_cache
    if not os.path.exists(COMMENTS_CSV):
        init_comments_csv()
        return []
    
    try:
        current_mtime = os.path.getmtime(COMMENTS_CSV)
        if current_mtime <= _comments_cache["mtime"]:
            return _comments_cache["data"]

        comments = []
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
        
        # Update Cache
        _comments_cache = {"data": comments, "mtime": current_mtime}
        return comments

    except Exception as e:
        print(f"Error reading Comments CSV: {e}")
        return []

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
    global _chat_cache
    if not os.path.exists(CHATS_FILE):
        return []
    
    try:
        current_mtime = os.path.getmtime(CHATS_FILE)
        if current_mtime > _chat_cache["mtime"]:
             with open(CHATS_FILE, 'r') as f:
                 data = json.load(f)
             _chat_cache["data"] = data
             _chat_cache["mtime"] = current_mtime
             return data
        return _chat_cache["data"]
    except:
        return []

def save_chats(chats):
    try:
        with open(CHATS_FILE, 'w') as f:
            json.dump(chats, f, indent=4)
        return True
    except:
        return False

# --- BANNERS HELPERS ---

BANNERS_FILE = os.path.join(BASE_DIR, 'banners.json')
BANNERS_DEFAULT_FILE = os.path.join(BASE_DIR, 'banners_default.json')

def get_banners(include_inactive=False):
    """
    Reads banners from banners.json using caching.
    """
    global _banners_cache

    # Auto-initialize if missing
    if not os.path.exists(BANNERS_FILE):
        if os.path.exists(BANNERS_DEFAULT_FILE):
            try:
                with open(BANNERS_DEFAULT_FILE, 'r') as src, open(BANNERS_FILE, 'w') as dst:
                    dst.write(src.read())
            except Exception as e:
                print(f"Error initializing banners.json: {e}")
                return []
        else:
            # Fallback if default is also missing
            with open(BANNERS_FILE, 'w') as f:
                f.write('[]')
    
    try:
        current_mtime = os.path.getmtime(BANNERS_FILE)
        banners = []
        if current_mtime <= _banners_cache["mtime"]:
            banners = _banners_cache["data"]
        else:
            with open(BANNERS_FILE, 'r') as f:
                banners = json.load(f)
            _banners_cache = {"data": banners, "mtime": current_mtime}
        
        if not include_inactive:
            return [b for b in banners if b.get('active', True)]
        return banners
    except Exception as e:
        print(f"Error reading banners.json: {e}")
        return []

def save_banners(banners):
    """Writes list of banners to banners.json."""
    try:
        with open(BANNERS_FILE, 'w') as f:
            json.dump(banners, f, indent=4)
        return True
    except Exception as e:
        print(f"Error saving banners.json: {e}")
        return False

def create_banner(banner_data):
    """Adds a new banner."""
    banners = get_banners(include_inactive=True)
    
    # Generate ID
    new_id = 1
    if banners:
        new_id = max([int(b.get('id', 0)) for b in banners]) + 1
    
    new_banner = {
        "id": new_id,
        "text": banner_data.get('text', ''),
        "link": banner_data.get('link', ''),
        "type": banner_data.get('type', 'info'), # info, sale, launch
        "active": banner_data.get('active', True),
        "countdown_target": banner_data.get('countdown_target'),
        "created_at": datetime.utcnow().isoformat()
    }
    
    banners.append(new_banner)
    return save_banners(banners)

def update_banner(banner_id, banner_data):
    """Updates an existing banner."""
    banners = get_banners(include_inactive=True)
    found = False
    
    for b in banners:
        if str(b.get('id')) == str(banner_id):
            b.update(banner_data)
            # Ensure ID doesn't change
            b['id'] = int(banner_id)
            found = True
            break
            
    if found:
        return save_banners(banners)
    return False

def delete_banner(banner_id):
    """Deletes a banner."""
    banners = get_banners(include_inactive=True)
    initial_len = len(banners)
    banners = [b for b in banners if str(b.get('id')) != str(banner_id)]
    
    if len(banners) < initial_len:
        return save_banners(banners)
    return False

# --- STOCK SUMMARY CACHING (SQLite) ---

import sqlite3

STOCK_DB_FILE = os.path.join(DATA_DIR, 'stock_summaries.db')

def init_stock_db():
    """Initializes the SQLite database for stock summaries."""
    try:
        conn = sqlite3.connect(STOCK_DB_FILE)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS summaries (
                ticker TEXT PRIMARY KEY,
                summary TEXT,
                date TEXT
            )
        ''')
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error initializing stock DB: {e}")

def get_cached_summary(ticker):
    """
    Retrieves a cached summary for a ticker if it exists and is less than 180 days old.
    Returns the summary string or None.
    """
    if not os.path.exists(STOCK_DB_FILE):
        init_stock_db()
    
    try:
        conn = sqlite3.connect(STOCK_DB_FILE)
        cursor = conn.cursor()
        cursor.execute("SELECT summary, date FROM summaries WHERE ticker = ?", (ticker,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            summary, stored_date_str = row
            if stored_date_str:
                try:
                    stored_date = datetime.strptime(stored_date_str, '%Y-%m-%d')
                    days_diff = (datetime.utcnow() - stored_date).days
                    if days_diff < 180: # 6 months
                        return summary
                except ValueError:
                    pass # Invalid date format, regenerate
    except Exception as e:
        print(f"Error reading summary DB: {e}")
        return None
    
    return None

def save_cached_summary(ticker, summary):
    """
    Saves or updates a summary in the SQLite DB with the current date.
    """
    if not os.path.exists(STOCK_DB_FILE):
        init_stock_db()

    try:
        conn = sqlite3.connect(STOCK_DB_FILE)
        cursor = conn.cursor()
        current_date = datetime.utcnow().strftime('%Y-%m-%d')
        cursor.execute('''
            INSERT OR REPLACE INTO summaries (ticker, summary, date)
            VALUES (?, ?, ?)
        ''', (ticker, summary, current_date))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error saving summary to DB: {e}")
        return False

# --- SENTIMENT CACHING (SQLite) ---

SENTIMENT_DB_FILE = os.path.join(DATA_DIR, 'sentiment_scores.db')

def init_sentiment_db():
    """Initializes the SQLite database for sentiment scores."""
    try:
        conn = sqlite3.connect(SENTIMENT_DB_FILE)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sentiments (
                ticker TEXT PRIMARY KEY,
                data TEXT,
                date TEXT
            )
        ''')
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error initializing sentiment DB: {e}")

def get_cached_sentiment(ticker):
    """
    Retrieves cached sentiment if < 7 days old.
    Returns: dict (parsed JSON) or None
    """
    if not os.path.exists(SENTIMENT_DB_FILE):
        init_sentiment_db()
        return None
        
    try:
        conn = sqlite3.connect(SENTIMENT_DB_FILE)
        cursor = conn.cursor()
        cursor.execute("SELECT data, date FROM sentiments WHERE ticker = ?", (ticker,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            json_str, stored_date_str = row
            if stored_date_str:
                try:
                    stored_dt = datetime.fromisoformat(stored_date_str)
                    # Check if older than 7 days
                    if (datetime.utcnow() - stored_dt).days < 7:
                        return json.loads(json_str)
                except ValueError:
                    pass
    except Exception as e:
        print(f"Error reading sentiment DB: {e}")
    return None

def save_cached_sentiment(ticker, sentiment_data):
    """
    Saves sentiment data to SQLite with current ISO timestamp.
    """
    if not os.path.exists(SENTIMENT_DB_FILE):
        init_sentiment_db()

    try:
        conn = sqlite3.connect(SENTIMENT_DB_FILE)
        cursor = conn.cursor()
        
        # Serialize data to JSON string
        json_str = json.dumps(sentiment_data)
        current_date = datetime.utcnow().isoformat()
        
        cursor.execute('''
            INSERT OR REPLACE INTO sentiments (ticker, data, date)
            VALUES (?, ?, ?)
        ''', (ticker, json_str, current_date))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error saving sentiment to DB: {e}")
        return False

# --- POINTS & REFERRALS SYSTEM ---

def load_points_rules():
    """Loads points rules from CSV."""
    rules = {}
    if os.path.exists(POINTS_RULES_CSV):
        try:
            with open(POINTS_RULES_CSV, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        rules[row['action']] = int(row['points'])
                    except: pass
        except Exception as e:
            print(f"Error loading points rules: {e}")
    return rules

def add_points(email, action):
    """Adds points to a user's profile based on the action and tier rules."""
    try:
        rules = load_points_rules()
        points_to_add = rules.get(action, 0)
        
        if points_to_add == 0:
            return False
            
        db = get_db()
        user_ref = db.collection('users').document(email)
        
        @firestore.transactional
        def update_points_txn(transaction, ref):
            res = transaction.get(ref)
            # Fix for generator result (common in some lib versions)
            snapshot = next(res) if hasattr(res, '__iter__') and not hasattr(res, 'exists') else res

            if not snapshot.exists: return False
            
            user_data = snapshot.to_dict()
            tier = user_data.get('tier', 'Basic')
            
            # Singularity Logic: Instant
            if tier == 'Singularity':
                current_points = user_data.get('points', 0)
                new_total = current_points + points_to_add
                transaction.update(ref, {'points': new_total})
                
                # USER DEBUG
                print(f"\n[POINTS DEBUG] Adding Instant Points for {email} (Singularity Tier)")
                print(f" > Action: {action}")
                print(f" > Amount: {points_to_add}")
                print(f" > Status: INSTANT")
                print(f" > Old Balance: {current_points}")
                print(f" > New Balance: {new_total}\n")
                return True
            
            # Basic/Pro/Enterprise Logic: Pending 24h
            else:
                release_time = datetime.utcnow().timestamp() + (24 * 3600)
                pending_txn = {
                    "amount": points_to_add,
                    "action": action,
                    "release_at": release_time,
                    "created_at": datetime.utcnow().isoformat()
                }
                
                current_pending = user_data.get('pending_transactions', [])
                current_pending.append(pending_txn)
                
                transaction.update(ref, {
                    'pending_transactions': current_pending
                })
                
                # USER DEBUG:
                print(f"\n[POINTS DEBUG] Queueing Points for {email}")
                print(f" > Action: {action}")
                print(f" > Amount: {points_to_add}")
                print(f" > Release Delay: 24 Hours")
                print(f" > Release Time (UTC): {datetime.fromtimestamp(release_time)}")
                print(f" > Status: PENDING")
                print(f" > Current Available Balance: {user_data.get('points', 0)}")
                print(f" > Projected Balance (After Release): {user_data.get('points', 0) + points_to_add}\n")
                
                return True
            
        transaction = db.transaction()
        return update_points_txn(transaction, user_ref)
    except Exception as e:
        print(f"Error adding points for {email}: {e}")
        return False

def calculate_user_rank(points):
    """Calculates rank based on points (Higher points = Lower Rank Number)."""
    try:
        db = get_db()
        # Count users with MORE points than this user
        
        # Check Cache for Rank
        # For simplicity, we can use a small in-memory LRU or similar, but global dict with timestamp works for single worker
        global _rank_cache
        
        # Cache Key: Points (Rank depends on points value mostly, but actually depends on others. 
        # Ideally key is user_email, but rank function only takes points. 
        # Let's trust that identical points = identical rank roughly. 
        # BUT this function is `calculate_user_rank(points)`, so it returns standard rank for that score.
        cache_key = f"rank_{points}"
        if cache_key in _rank_cache:
            data, timestamp = _rank_cache[cache_key]
            if time.time() - timestamp < 300: # 5 mins
                return data

        try:
            # Method 1: Efficient Count (Requires newer firebase-admin)
            query = db.collection('users').where(field_path='points', op_string='>', value=points).count()
            results = query.get()
            rank = results[0][0].value + 1
            
        except (AttributeError, Exception) as e:
            # Method 2: Fallback for older versions or if aggregation fails
            # Stream keys only if possible, or just huge query (warning: read costs)
            print(f"Rank calc fallback (count() failed): {e}")
            docs = db.collection('users').where(field_path='points', op_string='>', value=points).stream()
            count = sum(1 for _ in docs)
            rank = count + 1

        # Save to Cache
        _rank_cache[cache_key] = (rank, time.time())
        return rank
            
    except Exception as e:
        print(f"Error calculating rank: {e}")
        return 0

def get_user_points(email):
    """Returns user's points and rank."""
    try:
        db = get_db()
        doc = db.collection('users').document(email).get()
        if doc.exists:
            data = doc.to_dict()
            pending = data.get('pending_transactions', [])
            pending_total = sum(t.get('amount', 0) for t in pending)
            points = data.get('points', 0)
            
            # Calculate Rank (Safe Call)
            try:
                rank = calculate_user_rank(points)
            except Exception as re:
                print(f"Failed to calculate rank for {email}: {re}")
                rank = 0
            
            return {
                "points": points, 
                "tier": data.get('tier', 'Basic'),
                "pending_points": pending_total,
                "rank": rank
            }
        return {"points": 0, "tier": "Basic", "pending_points": 0, "rank": 0}
    except Exception as e:
        print(f"Error getting points for {email}: {e}")
        return {"points": 0, "tier": "Basic", "pending_points": 0, "rank": 0}

def get_leaderboard(limit=50):
    """Returns top users who opted in to show points. Caches for 5 minutes."""
    global _leaderboard_cache
    try:
        # Check Cache
        if time.time() - _leaderboard_cache['timestamp'] < 300:
            if _leaderboard_cache['data']:
                return _leaderboard_cache['data']

        db = get_db()
        # Use keyword args to avoid warning
        docs = db.collection('users')\
                 .where(field_path='settings.show_leaderboard', op_string='==', value=True)\
                 .order_by('points', direction=firestore.Query.DESCENDING)\
                 .limit(limit).stream()
        
        leaderboard = []
        for doc in docs:
            d = doc.to_dict()
            username = d.get('username')
            if not username:
                email = d.get('email', '')
                username = email.split('@')[0] if '@' in email else 'Anonymous'

            joined_at = d.get('created_at')
            
            # SELF-HEAL: If date joined is missing, fetch from Auth and save permenantly
            if not joined_at:
                try:
                    # doc.id is email in this schema
                    user_record = auth.get_user_by_email(doc.id)
                    if user_record.user_metadata and user_record.user_metadata.creation_timestamp:
                        ts = user_record.user_metadata.creation_timestamp
                        # Convert ms timestamp to ISO format
                        dt_obj = datetime.utcfromtimestamp(ts / 1000.0)
                        joined_at = dt_obj.isoformat()
                        
                        # Save to Firestore
                        db.collection('users').document(doc.id).set({
                            'created_at': joined_at
                        }, merge=True)
                except Exception as e:
                    # Keep as None/Unknown if auth fetch fails
                    pass

            leaderboard.append({
                "username": username,
                "points": d.get('points', 0),
                "tier": d.get('tier', 'Basic'),
                "joined_at": joined_at,
                "highest_rank": d.get('highest_rank')
            })
            
        # Update Cache
        _leaderboard_cache['data'] = leaderboard
        _leaderboard_cache['timestamp'] = time.time()
        
        return leaderboard
    except Exception as e:
        print(f"Leaderboard Error: {e}")
        return []

def generate_referral_code(email):
    """Generates a unique referral code for the user."""
    try:
        db = get_db()
        user_ref = db.collection('users').document(email)
        user_doc = user_ref.get()
        
        if user_doc.exists and user_doc.get('referral_code'):
            return user_doc.get('referral_code')
            
        # Generate new code
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        
        # Ensure Uniqueness (simple check)
        existing = db.collection('users').where(field_path='referral_code', op_string='==', value=code).get()
        if len(existing) > 0:
            return generate_referral_code(email) # Retry
            
        user_ref.set({'referral_code': code}, merge=True)
        return code
    except Exception as e:
        print(f"Error generating referral code: {e}")
        return None

def process_referral_signup(new_user_email, referral_code):
    """Links new user to referrer."""
    try:
        db = get_db()
        # Find referrer
        referrer_docs = db.collection('users').where(field_path='referral_code', op_string='==', value=referral_code).limit(1).get()
        if not referrer_docs: return False
        
        referrer_email = referrer_docs[0].id
        if referrer_email == new_user_email: return False # Cannot refer self
        
        # Link
        db.collection('users').document(new_user_email).set({'referred_by': referrer_email}, merge=True)
        return True
    except Exception as e:
        print(f"Referral Signup Error: {e}")
        return False

def check_referral_reward(user_email, new_tier):
    """
    Called when a user upgrades tier. Checks if their referrer deserves a reward.
    """
    try:
        if new_tier == "Basic": return # Only paid plans trigger rewards
        
        db = get_db()
        user_ref = db.collection('users').document(user_email)
        user_doc = user_ref.get()
        
        if not user_doc.exists: return
        data = user_doc.to_dict()
        
        referrer_email = data.get('referred_by')
        if not referrer_email: return
        
        # Check if already rewarded for this user? 
        # For now, allow one reward per referred user
        if data.get('referral_reward_processed'): return
        
        # Grant Reward to Referrer
        trigger_reward(referrer_email)
        
        # Mark processed
        user_ref.set({'referral_reward_processed': True}, merge=True)
        
    except Exception as e:
        print(f"Check Referral Reward Error: {e}")

def trigger_reward(referrer_email):
    """
    Calculates and applies the reward to the referrer.
    """
    try:
        db = get_db()
        ref_doc_ref = db.collection('users').document(referrer_email)
        ref_doc = ref_doc_ref.get()
        if not ref_doc.exists: return
        
        ref_data = ref_doc.to_dict()
        current_tier = ref_data.get('tier', 'Basic')
        
        reward_months = 0
        target_tier = "Pro"
        
        if current_tier == "Basic":
            target_tier = "Pro"
            reward_months = 3
        elif current_tier == "Pro":
            target_tier = "Enterprise"
            reward_months = 3
        elif current_tier == "Enterprise":
            target_tier = "Enterprise"
            reward_months = 3
        elif current_tier == "Singularity":
             # Admin or top tier, maybe points instead?
             add_points(referrer_email, "enterprise_month") # Fallback to points
             return

        # Apply Reward (Extending expiry)
        now = datetime.utcnow()
        current_expiry = ref_data.get('free_tier_expiry')
        
        if current_expiry:
            expiry_dt = datetime.fromisoformat(current_expiry)
            if expiry_dt < now: expiry_dt = now
        else:
            expiry_dt = now
            
        # Add months (approx 30 days)
        new_expiry = expiry_dt + datetime.timedelta(days=30 * reward_months)
        
        ref_doc_ref.set({
            'tier': target_tier,
            'free_tier_expiry': new_expiry.isoformat(),
            'original_tier': ref_data.get('original_tier', current_tier) # Store original to revert
        }, merge=True)
        
        print(f"Granted {reward_months} months of {target_tier} to {referrer_email}")
        
    except Exception as e:
        print(f"Trigger Reward Error: {e}")

# --- MARKET PREDICTIONS SYSTEM ---

def create_prediction(title, stock, end_date, market_condition, wager_logic, author_email, category="Stocks"):
    """Creates a new prediction event."""
    try:
        db = get_db()
        prediction_id = str(uuid.uuid4())
        
        data = {
            "id": prediction_id,
            "title": title,
            "stock": stock.upper(),
            "end_date": end_date, # ISO string
            "market_condition": market_condition, # e.g. "Up > 5%"
            "wager_type": wager_logic, # "binary_odds"
            "status": "active",
            "created_by": author_email,
            "created_at": datetime.utcnow().isoformat(),
            "total_pool_yes": 0,
            "total_pool_no": 0,
            "category": category,
            "history": [] 
        }
        
        db.collection('predictions').document(prediction_id).set(data)
        return data
    except Exception as e:
        print(f"Create Prediction Error: {e}")
        return False

def place_bet(email, prediction_id, choice, amount):
    """
    Places a bet on a prediction.
    choice: 'yes' or 'no'
    amount: int (points)
    """
    try:
        db = get_db()
        user_ref = db.collection('users').document(email)
        pred_ref = db.collection('predictions').document(prediction_id)
        
        @firestore.transactional
        def bet_txn(transaction, u_ref, p_ref):
            # Fix for generator result
            u_res = transaction.get(u_ref)
            p_res = transaction.get(p_ref)
            
            # If generator, consume it
            u_snap = next(u_res) if hasattr(u_res, '__iter__') and not hasattr(u_res, 'exists') else u_res
            p_snap = next(p_res) if hasattr(p_res, '__iter__') and not hasattr(p_res, 'exists') else p_res
            
            if not p_snap.exists: raise Exception("Prediction not found")
            if not u_snap.exists: raise Exception("User not found")
            
            p_data = p_snap.to_dict()
            if p_data.get('status') != 'active': raise Exception("Prediction closed")
            
            # Check Balance
            points = u_snap.get('points') or 0
            if points < amount: raise Exception("Insufficient points")
            
            # Deduct Points
            transaction.update(u_ref, {'points': points - amount})
            
            # Record Bet
            bet_id = str(uuid.uuid4())
            bet_data = {
                "id": bet_id,
                "user": email,
                "prediction_id": prediction_id,
                "choice": choice,
                "amount": amount,
                "timestamp": datetime.utcnow().isoformat(),
                "status": "pending"
            }
            transaction.set(db.collection('bets').document(bet_id), bet_data)
            
            # Update Pool
            pool_key = f"total_pool_{choice.lower()}"
            current_pool = p_data.get(pool_key, 0)
            new_pool_total = current_pool + amount
            transaction.update(p_ref, {pool_key: new_pool_total})
            
            # Record History (Current state after bet)
            # We need the OTHER side's pool to be accurate
            other_side = "no" if choice.lower() == "yes" else "yes"
            other_pool = p_data.get(f"total_pool_{other_side}", 0)
            
            history_entry = {
                "timestamp": datetime.utcnow().isoformat(),
                "yes": new_pool_total if choice.lower() == "yes" else other_pool,
                "no": new_pool_total if choice.lower() == "no" else other_pool
            }
            # Append using arrayUnion is cleaner if no race condition on reading full array, 
            # but Firestore transaction ensures we read latest. 
            transaction.update(p_ref, {"history": firestore.ArrayUnion([history_entry])})
            
            return bet_id

        transaction = db.transaction()
        val = bet_txn(transaction, user_ref, pred_ref)
        # Note: bet_txn returns True, but we need bet_id. 
        # Actually bet_txn runs inner logic. We can't easily extract bet_id from outside unless we refactor or assign it to a nonlocal.
        # But wait, transaction.set uses bet_id.
        
        # Let's do a trick or refactor slightly.
        # Ideally bet_txn returns the bet_id.
        # But transaction functions usually return the result of the callback.
        # So I will make bet_txn return the bet_id.
        return {"success": True, "bet_id": val}
        
    except Exception as e:
        print(f"Place Bet Error: {e}")
        return {"success": False, "message": str(e)}

def get_active_predictions(include_recent=False):
    try:
        db = get_db()
        # If include_recent, we get active OR ended recently.
        # Firestore OR queries are limited. Best to query all active, and separate query for ended recently.
        
        active_docs = db.collection('predictions').where(field_path='status', op_string='==', value='active').stream()
        results = [d.to_dict() for d in active_docs]
        
        if include_recent:
            # Get ended in last 24h
            yesterday = (datetime.utcnow() - timedelta(hours=24)).isoformat()
            ended_docs = db.collection('predictions')\
                           .where(field_path='status', op_string='==', value='ended')\
                           .where(field_path='end_date', op_string='>=', value=yesterday)\
                           .stream() # Index might be needed for composite query
            
            # Fallback if index missing: Get all ended and filter in memory (safer for small scale)
            # Or just return all 'ended' and let frontend filter? Data size risk.
            # Let's try simple query. If it fails due to index, we catch exception.
            try:
                 # Check if we can do this query.
                 # status == ended AND end_date >= yesterday. Requires composite index.
                 # Optimization: Just get all recent updates? resolved_at?
                 pass 
            except: pass
            
            # Simple InMemory Fallback for ended (assuming not millions)
            # PROD: Ensure Index. 
            # DEV: Just fetch recent ended or all ended (limit 20)
            ended_ref = db.collection('predictions').where(field_path='status', op_string='==', value='ended').limit(20).stream()
            for d in ended_ref:
                data = d.to_dict()
                # Check resolved_at or end_date
                end_iso = data.get('end_date')
                if end_iso and end_iso >= yesterday:
                    results.append(data)

        # Deduplicate by ID just in case
        seen = set()
        unique_results = []
        for r in results:
            if r['id'] not in seen:
                seen.add(r['id'])
                unique_results.append(r)
                
        return unique_results
    except Exception as e:
        print(f"Get Active Predictions Error: {e}")
        return []

def get_user_bets(email):
    try:
        db = get_db()
        docs = db.collection('bets').where(field_path='user', op_string='==', value=email).stream()
        bets = [d.to_dict() for d in docs]
        # Sort in memory to avoid index requirement
        bets.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        return bets
    except: return []


def resolve_prediction(pred_id, outcome):
    """
    Resolves a prediction.
    outcome: 'yes' or 'no'
    Sets status to 'resolved' and records winning outcome.
    """
    try:
        db = get_db()
        # Update Prediction
        db.collection('predictions').document(pred_id).update({
            "status": "resolved",
            "winning_outcome": outcome,
            "resolved_at": datetime.utcnow().isoformat()
        })
        
        # We could also loop through bets and mark them won/lost here for faster querying later,
        # but for now we can calculate on fly in leaderboard or user profile.
        # Ideally, we update all bets with 'won': true/false.
        
        batch = db.batch()
        bets_ref = db.collection('bets').where(field_path='prediction_id', op_string='==', value=pred_id).stream()
        
        for bet in bets_ref:
            b_data = bet.to_dict()
            won = (b_data.get('choice') == outcome)
            batch.update(bet.reference, {"status": "resolved", "won": won})
            
            # Payout? (Optional, if we had a coin system)
            # if won: ...
            
        batch.commit()
        return True
    except Exception as e:
        print(f"Resolve Error: {e}")
        return False

def get_predictions_leaderboard(limit=50):
    try:
        db = get_db()
        # We need to aggregate bets to calculate accuracy.
        # Fetch ALL bets that are resolved? That might be heavy.
        # Optimization: Store user stats in user profile (prediction_stats: { wins: 5, total: 10 })
        # But since I cannot migrate all data easily, I will support on-the-fly calc for now with limits.
        # OR: Just query users who have 'prediction_stats' if I add that.
        
        # Let's try querying 'bets' where status == 'resolved'.
        # If dataset is small (<10k bets), this is fine.
        
        bets = db.collection('bets').where(field_path='status', op_string='==', value='resolved').stream()
        
        user_stats = {} # { email: { wins: 0, total: 0 } }
        
        for b in bets:
            d = b.to_dict()
            email = d.get('user')
            won = d.get('won', False)
            
            if email not in user_stats:
                user_stats[email] = { "wins": 0, "total": 0 }
            
            user_stats[email]["total"] += 1
            if won:
                user_stats[email]["wins"] += 1
                
        # Filter and Rank
        results = []
        for email, stats in user_stats.items():
            if stats["total"] < 10: continue

            # Get User Profile for Username/Opt-out
            # This is N+1 query problem. Optimize by fetching all users or caching.
            # For now, fetch individually (cached internally by firebase client somewhat? No.)
            # Better: get all users once.
            pass # See below
            
        # Bulk fetch users (only those in list)
        qualifiers = [e for e, s in user_stats.items() if s["total"] >= 10]
        if not qualifiers: return []
        
        # Fetch user profiles
        # chunks of 10 for 'in' query
        users_map = {}
        for i in range(0, len(qualifiers), 10):
            chunk = qualifiers[i:i+10]
            if not chunk: continue
            # user doc ID is email
            u_docs = db.collection('users').where(field_path=firestore.FieldPath.document_id(), op_string='in', value=chunk).stream()
            for u in u_docs:
                users_map[u.id] = u.to_dict()
                
        leaderboard = []
        for email in qualifiers:
            u_data = users_map.get(email)
            if not u_data: continue
            
            # Check Opt-out
            settings = u_data.get('settings', {})
            if settings.get('show_leaderboard') is False: # Explicit false check
                continue
                
            stats = user_stats[email]
            accuracy = (stats["wins"] / stats["total"]) * 100
            
            username = u_data.get('username')
            if not username: username = email.split('@')[0]
            
            leaderboard.append({
                "username": username,
                "accuracy": round(accuracy, 2),
                "total_bets": stats["total"],
                "wins": stats["wins"],
                "tier": u_data.get('tier', 'Basic')
            })
            
        # Sort: Accuracy Desc, then Total Bets Desc
        leaderboard.sort(key=lambda x: (x['accuracy'], x['total_bets']), reverse=True)
        
        return leaderboard[:limit]
        
    except Exception as e:
        print(f"Predictions Leaderboard Error: {e}")
        return []

