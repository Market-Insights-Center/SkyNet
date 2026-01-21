
import json
import os
import asyncio

# File to store usage statistics
# Check if running on Windows (Localhost) or Linux (VPS)
if os.name == 'nt':
    USAGE_FILE = os.path.join(os.path.dirname(__file__), 'data', 'usage_stats_local.json')
else:
    USAGE_FILE = os.path.join(os.path.dirname(__file__), 'data', 'usage_stats.json')
_usage_lock = asyncio.Lock()

def _load_usage():
    defaults = {
         "quickscore": 0, "sentinel": 0, "tracking": 0, "nexus": 0, "invest": 0, 
         "cultivate": 0, "assess": 0, "mlforecast": 0, "briefing": 0, 
         "fundamentals": 0, "breakout": 0, "sentiment": 0, "powerscore": 0,
         "automations_run": 0, "custom": 0, "market": 0, "summary": 0, "history": 0,
         "execution_run": 0, "stock_clicks": 0
    }
    if not os.path.exists(USAGE_FILE):
        return defaults
    try:
        with open(USAGE_FILE, 'r') as f:
            data = json.load(f)
            # Merge with defaults to ensure keys exist
            return {**defaults, **data}
    except:
        return defaults

def _save_usage(data):
    try:
        os.makedirs(os.path.dirname(USAGE_FILE), exist_ok=True)
        with open(USAGE_FILE, 'w') as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"Error saving usage stats: {e}")

async def increment_usage(product_key: str, user_email: str = None):
    """
    Increments the counter for a specific product/feature.
    """
    async with _usage_lock:
        stats = _load_usage()
        # Normalize key
        key = product_key.lower().strip()
        
        current = stats.get(key, 0)
        stats[key] = current + 1
        
        # Also track total system usage
        stats['total_system_actions'] = stats.get('total_system_actions', 0) + 1
        
        _save_usage(stats)
        
        # Log Recent Action
        if user_email:
            # Run in thread to avoid blocking lock
            await asyncio.to_thread(log_recent_action, key, user_email)
            
        return stats.get(key)

def get_all_usage():
    """Returns the complete dictionary of usage stats."""
    stats = _load_usage()
    
    # helper to get active strategy count dynamically
    try:
        # Import internally to avoid circular imports if any
        # We need to read the strategy_rankings.json file directly or use the module
        from backend.integration.strategy_ranking import load_rankings
        rankings = load_rankings()
        active_count = len(rankings.get("active", []))
        stats["active_strategies"] = active_count
    except ImportError:
        # Try relative import
        try:
            from integration.strategy_ranking import load_rankings
            rankings = load_rankings()
            active_count = len(rankings.get("active", []))
            stats["active_strategies"] = active_count
        except:
            stats["active_strategies"] = 0
    except Exception as e:
        print(f"[USAGE] Error fetching strategy count: {e}")
        stats["active_strategies"] = 0
        
    return stats

# --- RECENT ACTIONS LOGGING ---
if os.name == 'nt':
    RECENT_ACTIONS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'recent_actions.json')
else:
    RECENT_ACTIONS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'recent_actions.json')

def log_recent_action(action: str, user_email: str):
    """Logs a user action to the recent actions list, keeping only the last 100."""
    try:
        from datetime import datetime
        
        actions = []
        if os.path.exists(RECENT_ACTIONS_FILE):
             try:
                 with open(RECENT_ACTIONS_FILE, 'r') as f:
                     actions = json.load(f)
             except: actions = []
             
        new_entry = {
            "action": action,
            "user": user_email,
            "timestamp": datetime.now().isoformat()
        }
        
        # Prepend
        actions.insert(0, new_entry)
        
        # Keep last 1000
        actions = actions[:1000]
        
        # Ensure dir
        data_dir = os.path.dirname(RECENT_ACTIONS_FILE)
        if not os.path.exists(data_dir):
            os.makedirs(data_dir)
            
        with open(RECENT_ACTIONS_FILE, 'w') as f:
            json.dump(actions, f, indent=4)
            
    except Exception as e:
        print(f"Error logging recent action: {e}")

def get_recent_actions(limit: int = 50, user_filter = None):
    """Returns the list of recent actions, optionally filtered. user_filter can be str or list."""
    if not os.path.exists(RECENT_ACTIONS_FILE):
        return []
    try:
        with open(RECENT_ACTIONS_FILE, 'r') as f:
            actions = json.load(f)
            
        # Filter by user if provided
        if user_filter:
            if isinstance(user_filter, list):
                filters = [f.lower() for f in user_filter]
                actions = [a for a in actions if any(f in a.get('user', '').lower() for f in filters)]
            else:
                f_str = str(user_filter).lower()
                actions = [a for a in actions if f_str in a.get('user', '').lower()]
            
        # Apply limit
        return actions[:limit]
    except:
        return []
