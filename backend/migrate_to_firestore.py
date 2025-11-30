import json
import csv
import os
from firebase_admin import firestore  # <--- Added this missing import
from firebase_admin_setup import get_db

# Files to migrate
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
USERS_FILE = os.path.join(BASE_DIR, 'users.json')
PROFILES_FILE = os.path.join(BASE_DIR, 'user_profiles.csv')

def migrate():
    print("Starting Migration to Firestore...")
    db = get_db()
    users_ref = db.collection('users')
    
    # 1. Load Legacy Data
    legacy_users = []
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r') as f:
            legacy_users = json.load(f)
            
    legacy_profiles = {}
    if os.path.exists(PROFILES_FILE):
        with open(PROFILES_FILE, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('email'):
                    legacy_profiles[row['email']] = row

    # 2. Upload to Firestore
    count = 0
    for user in legacy_users:
        email = user.get('email')
        if not email: continue
        
        # Merge basic data and profile data
        profile_data = legacy_profiles.get(email, {})
        
        # Default document structure
        doc_data = {
            'email': email,
            'tier': user.get('subscription_plan', 'Free'),
            'subscription_status': 'active' if user.get('subscription_plan') != 'Free' else 'none',
            'subscription_cost': user.get('subscription_cost', 0.0),
            'profile': profile_data,
            'migrated_at': firestore.SERVER_TIMESTAMP
        }
        
        # 3. SPECIAL HANDLE: The Owner
        if email == "marketinsightscenter@gmail.com":
            print(f"--> Found Owner: {email}. Setting to Singularity Tier.")
            doc_data['tier'] = "Singularity"
            doc_data['role'] = "super_admin"
            doc_data['subscription_status'] = "active"

        users_ref.document(email).set(doc_data, merge=True)
        count += 1

    print(f"Migration Complete. {count} users moved to Firestore.")

if __name__ == "__main__":
    migrate()