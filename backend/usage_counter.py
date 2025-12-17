
import json
import os
import asyncio

# File to store usage statistics
USAGE_FILE = os.path.join(os.path.dirname(__file__), 'data', 'usage_stats.json')
_usage_lock = asyncio.Lock()

def _load_usage():
    defaults = {
         "quickscore": 0, "sentinel": 0, "tracking": 0, "nexus": 0, "invest": 0, 
         "cultivate": 0, "assess": 0, "mlforecast": 0, "briefing": 0, 
         "fundamentals": 0, "breakout": 0, "sentiment": 0, "powerscore": 0,
         "automations_ran": 0, "custom": 0
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

async def increment_usage(product_key: str):
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
        return stats.get(key)

def get_all_usage():
    """Returns the complete dictionary of usage stats."""
    # Read-only access doesn't strictly need async lock if just reading file, 
    # but for consistency we just load direct. 
    # To avoid async overhead in synch endpoints, we'll just read.
    return _load_usage()
