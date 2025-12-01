import firebase_admin
from firebase_admin import credentials, firestore
import os

try:
    # Get the directory where this script is located
    base_dir = os.path.dirname(os.path.abspath(__file__))
    cred_path = os.path.join(base_dir, 'serviceAccountKey.json')
    print(f"Loading credentials from: {cred_path}")
    
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
    
    print("Firebase Admin initialized successfully.")
    
    db = firestore.client()
    print("Firestore client created.")
    
    # Try a simple read
    docs = db.collection('users').limit(1).get()
    print("Successfully connected to Firestore!")
    
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
