import firebase_admin
from firebase_admin import credentials, firestore, auth
import os
import json
import base64
import logging

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("firebase_setup")

# Path to service account key (Fallback for Localhost)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
cred_path = os.path.join(BASE_DIR, 'serviceAccountKey.json')

# Initialize Firebase Admin
if not firebase_admin._apps:
    try:
        # 1. Try Base64 Encoded Env Var (Safest for VPS)
        env_base64 = os.environ.get('FIREBASE_SERVICE_ACCOUNT_BASE64')
        
        # 2. Try Raw JSON Env Var (Legacy/Backup)
        env_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')

        cred = None

        if env_base64:
            try:
                # Decode Base64 -> JSON String -> Dict
                decoded_json = base64.b64decode(env_base64).decode('utf-8')
                cred_dict = json.loads(decoded_json)
                cred = credentials.Certificate(cred_dict)
                logger.info("SUCCESS: Firebase initialized using BASE64 Environment Variable.")
            except Exception as e:
                logger.error(f"Failed to decode BASE64 credentials: {e}")

        elif env_json:
            try:
                cred_dict = json.loads(env_json)
                cred = credentials.Certificate(cred_dict)
                logger.info("SUCCESS: Firebase initialized using JSON Environment Variable.")
            except Exception as e:
                logger.error(f"Failed to parse JSON Environment Variable: {e}")

        # 3. Try Loading from File (Best for Localhost)
        elif os.path.exists(cred_path):
            try:
                cred = credentials.Certificate(cred_path)
                logger.info(f"SUCCESS: Firebase initialized using file: {cred_path}")
            except Exception as e:
                 logger.error(f"Failed to load credential file: {e}")
            
        else:
            logger.critical("CRITICAL WARNING: No Firebase credentials found! Checked Base64 Env, JSON Env, and File.")
            
        if cred:
            firebase_admin.initialize_app(cred)
            
    except Exception as e:
        logger.critical(f"CRITICAL ERROR initializing Firebase: {e}")

db = firestore.client()

def get_db():
    return db

def get_auth():
    return auth