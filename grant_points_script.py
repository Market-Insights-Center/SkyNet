import sys
import os
from firebase_admin import firestore

# Setup path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from backend.firebase_admin_setup import get_db

def grant_points():
    print("Starting Points Grant...")
    db = get_db()
    
    # 1. SuperAdmin Grant (100k)
    sa_email = "marketinsightscenter@gmail.com"
    sa_ref = db.collection('users').document(sa_email)
    sa_doc = sa_ref.get()
    
    if sa_doc.exists:
        data = sa_doc.to_dict()
        curr = data.get('points', 0)
        sa_ref.update({'points': curr + 100000})
        print(f"Granted 100,000 points to {sa_email}. New Balance: {curr + 100000}")
    else:
        # Create if doesn't exist? Unlikely for superadmin.
        print(f"SuperAdmin {sa_email} not found!")

    # 2. Singularity Tier Grant (10k)
    try:
        users = db.collection('users').where('tier', '==', 'Singularity').stream()
        count = 0
        for user in users:
            if user.id == sa_email: continue # Skip SA
            
            ref = db.collection('users').document(user.id)
            curr = user.to_dict().get('points', 0)
            ref.update({'points': curr + 10000})
            print(f"Granted 10,000 points to {user.id}")
            count += 1
        print(f"Granted 10k points to {count} Singularity users.")
    except Exception as e:
        print(f"Error granting to Singularity users: {e}")

if __name__ == "__main__":
    grant_points()
