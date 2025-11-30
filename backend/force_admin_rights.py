import os
from firebase_admin import firestore
from firebase_admin_setup import get_db

def force_admin():
    print("🚀 Initiating God Mode for Market Insights Center...")
    db = get_db()
    email = "marketinsightscenter@gmail.com"
    
    # Force update the user document
    doc_ref = db.collection('users').document(email)
    doc_ref.set({
        'email': email,
        'tier': 'Singularity',  # The infinite tier
        'role': 'super_admin',
        'subscription_status': 'active',
        'subscription_id': 'manual_override',
        'updated_at': firestore.SERVER_TIMESTAMP
    }, merge=True)
    
    print(f"✅ SUCCESS: {email} is now permanently set to Singularity/Super Admin.")

if __name__ == "__main__":
    force_admin()