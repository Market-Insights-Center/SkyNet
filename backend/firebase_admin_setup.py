import firebase_admin
from firebase_admin import credentials, firestore, auth
import os
import json

# Path to service account key (Fallback)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
cred_path = os.path.join(BASE_DIR, 'serviceAccountKey.json')

# Initialize Firebase Admin
if not firebase_admin._apps:
    try:
        # 1. Try Loading from Environment Variable (Best for VPS)
        env_creds = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')
        
        if env_creds:
            # Parse the JSON string from the env var
            cred_dict = json.loads(env_creds)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            print("SUCCESS: Firebase initialized using Environment Variable.")
            
        # 2. Try Loading from File (Best for Localhost)
        elif os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            print(f"SUCCESS: Firebase initialized using file: {cred_path}")
            
        else:
            print("CRITICAL WARNING: No Firebase credentials found! (Checked Env Var & File)")
            
    except Exception as e:
        print(f"CRITICAL ERROR initializing Firebase: {e}")

db = firestore.client()

def get_db():
    return db

def get_auth():
    return auth