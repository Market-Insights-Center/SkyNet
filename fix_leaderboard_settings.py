import sys
import os
from firebase_admin import firestore

# Setup path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from backend.firebase_admin_setup import get_db

def fix_settings():
    print("Fixing Leaderboard Settings...")
    db = get_db()
    
    # 1. SuperAdmin
    sa_email = "marketinsightscenter@gmail.com"
    sa_ref = db.collection('users').document(sa_email)
    
    try:
        sa_ref.set({
            'settings': {'show_leaderboard': True},
            'settings': {'show_leaderboard': True},
            'username': 'Verzogerung',
            'tier': 'Founder' # Set Founder tier
        }, merge=True)
        print(f"Enabled leaderboard for {sa_email}")
    except Exception as e:
        print(f"Error SA: {e}")

    # 2. All Users Backfill
    print("Backfilling all users...")
    try:
        users = db.collection('users').stream()
        count = 0
        for user in users:
            try:
                data = user.to_dict()
                # If setting missing, add it
                settings = data.get('settings', {})
                if 'show_leaderboard' not in settings:
                    db.collection('users').document(user.id).set({
                        'settings': {'show_leaderboard': True}
                    }, merge=True)
                    print(f"Enabled leaderboard for {user.id}")
                    count += 1
            except Exception as e:
                print(f"Error updating {user.id}: {e}")
        print(f"Backfilled {count} users.")
    except Exception as e:
        print(f"Error Main Loop: {e}")

if __name__ == "__main__":
    fix_settings()
