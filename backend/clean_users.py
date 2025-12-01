import firebase_admin
from firebase_admin import credentials, auth, firestore
import os

# 1. Setup - Same logic as main app to ensure we hit the same DB
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CRED_PATH = os.path.join(BASE_DIR, 'serviceAccountKey.json')

if not os.path.exists(CRED_PATH):
    print(f"ERROR: No serviceAccountKey.json found at {CRED_PATH}")
    exit(1)

cred = credentials.Certificate(CRED_PATH)
firebase_admin.initialize_app(cred)
db = firestore.client()

KEEP_EMAIL = "marketinsightscenter@gmail.com"

def clean_database():
    print("Fetching users from Firebase Auth...")
    
    try:
        # iterate_all() is crucial here to ensure we really get everyone
        all_users = list(auth.list_users().iterate_all())
    except Exception as e:
        print(f"Error fetching users: {e}")
        return

    users_to_delete = []
    
    print(f"\nFound {len(all_users)} users total.")
    print("-" * 40)
    
    for user in all_users:
        email = user.email.lower() if user.email else "no-email"
        print(f"- {email} (UID: {user.uid})")
        
        if email != KEEP_EMAIL.lower():
            users_to_delete.append(user)
        else:
            print(f"  >>> KEEPING SUPER ADMIN: {email}")

    if not users_to_delete:
        print("\nNo users to delete. Database is clean!")
        return

    print("-" * 40)
    confirm = input(f"\nWARNING: About to DELETE {len(users_to_delete)} users (everyone except {KEEP_EMAIL}).\nType 'DELETE' to confirm: ")
    
    if confirm != "DELETE":
        print("Operation cancelled.")
        return

    print("\nDeleting users...")
    for user in users_to_delete:
        try:
            # 1. Delete from Auth
            auth.delete_user(user.uid)
            # 2. Delete from Firestore Profile
            db.collection('users').document(user.email).delete()
            print(f"✓ Deleted {user.email}")
        except Exception as e:
            print(f"X Failed to delete {user.email}: {e}")

    print("\nCleanup complete.")

if __name__ == "__main__":
    clean_database()