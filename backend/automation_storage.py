import json
import os
from typing import List, Dict, Any

# Path config
# Path config
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# NEW: Use a 'live' file that is NOT tracked by git (ensure this is in .gitignore)
DATA_FILE = os.path.join(BASE_DIR, 'data', 'automations_live.json')
LEGACY_DATA_FILE = os.path.join(BASE_DIR, 'data', 'automations.json')

def load_automations() -> List[Dict[str, Any]]:
    """Loads all automations from JSON."""
    # MIGRATION LOGIC:
    # If live file doesn't exist but legacy does, copy legacy to live.
    if not os.path.exists(DATA_FILE) and os.path.exists(LEGACY_DATA_FILE):
        try:
            print("Migrating automations to live storage...")
            with open(LEGACY_DATA_FILE, 'r', encoding='utf-8') as f:
                legacy_data = json.load(f)
            # Save to new file immediately
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(legacy_data, f, indent=4)
            print(f"Migration successful. Created {DATA_FILE}")
        except Exception as e:
            print(f"Migration failed: {e}")
            # Fallback to empty if migration fails, or return legacy? 
            # Better to return empty safely than crash, but log heavily.

    if not os.path.exists(DATA_FILE):
        return []
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading automations: {e}")
        return []

def save_automations(automations: List[Dict[str, Any]]):
    """Saves list of automations to JSON."""
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(automations, f, indent=4)
    except Exception as e:
        print(f"Error saving automations: {e}")

def save_automation(automation_data: Dict[str, Any], overwrite: bool = True):
    """Saves or updates a single automation."""
    automations = load_automations()
    updated = False
    
    # Check if ID exists (assuming 'id' field)
    if 'id' not in automation_data:
        # Generate ID if missing? Or assume frontend sends it. 
        # For now, simplistic approach: require ID.
        pass

    for i, auto in enumerate(automations):
        if auto.get('id') == automation_data.get('id'):
            if overwrite:
                automations[i] = automation_data
                updated = True
            else:
                raise ValueError("Automation already exists.")
            break
    
    if not updated:
        automations.append(automation_data)
        
    save_automations(automations)

def delete_automation(automation_id: str):
    """Deletes an automation by ID."""
    automations = load_automations()
    automations = [a for a in automations if a.get('id') != automation_id]
    save_automations(automations)

def toggle_automation(automation_id: str, active: bool):
    """Toggles active state."""
    automations = load_automations()
    for auto in automations:
        if auto.get('id') == automation_id:
            auto['active'] = active
            break
    save_automations(automations)
