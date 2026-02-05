
import json
import os
import time
from typing import List, Dict, Any

HISTORY_FILE = "data/sentinel_history.json"

def _load_history():
    if not os.path.exists(HISTORY_FILE):
        os.makedirs(os.path.dirname(HISTORY_FILE), exist_ok=True)
        return []
    try:
        with open(HISTORY_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def _save_history(history):
    os.makedirs(os.path.dirname(HISTORY_FILE), exist_ok=True)
    with open(HISTORY_FILE, 'w') as f:
        json.dump(history, f, indent=2)

def save_session(email: str, prompt: str, steps: List[Any], summary: str, log_summary: str):
    history = _load_history()
    
    session_id = f"{int(time.time())}_{abs(hash(prompt))}"
    
    new_entry = {
        "id": session_id,
        "email": email,
        "timestamp": time.time(),
        "prompt": prompt,
        "steps": steps, # The execution plan
        "final_summary": summary,
        "log_summary": log_summary # A brief snippet of logs or full logs if needed? Let's just store "completed" or status
    }
    
    # Prepend
    history.insert(0, new_entry)
    
    # Limit to last 50
    if len(history) > 50:
        history = history[:50]
        
    _save_history(history)
    return session_id

def get_user_history(email: str):
    all_hist = _load_history()
    # Filter by email
    return [h for h in all_hist if h.get('email') == email]

def delete_session(session_id: str):
    history = _load_history()
    history = [h for h in history if h['id'] != session_id]
    _save_history(history)
    return True
