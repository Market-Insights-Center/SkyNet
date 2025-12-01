import firebase_admin
from firebase_admin import credentials, firestore, auth
import os
import sys

# Get the directory of the current file to ensure we find the key
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CRED_PATH = os.path.join(BASE_DIR, 'serviceAccountKey.json')

db = None

def initialize_firebase():
    global db
    try:
        if not firebase_admin._apps:
            if os.path.exists(CRED_PATH):
                cred = credentials.Certificate(CRED_PATH)
                firebase_admin.initialize_app(cred)
                print(f"SUCCESS: Firebase Admin initialized with {CRED_PATH}")
            else:
                print("\n" + "="*60)
                print(f"CRITICAL ERROR: serviceAccountKey.json NOT FOUND at:")
                print(f"{CRED_PATH}")
                print("Users will NOT load. Please upload the key to the 'backend' folder.")
                print("="*60 + "\n")
                # Don't crash, but warn heavily. Auth calls will fail later.
        
        if not db:
            db = firestore.client()
            
    except Exception as e:
        print(f"CRITICAL FIREBASE INIT ERROR: {e}")

# Initialize immediately
initialize_firebase()

def get_db():
    if not db: initialize_firebase()
    return db

def get_auth():
    return auth