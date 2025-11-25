import firebase_admin
from firebase_admin import credentials, firestore, auth
import os

# Path to service account key
cred_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'serviceAccountKey.json')

# Initialize Firebase Admin
if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

def get_db():
    return db

def get_auth():
    return auth
