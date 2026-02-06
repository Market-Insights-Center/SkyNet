import os
import sys

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from backend.automation_storage import load_automations, save_automation

def reset_medulla():
    automations = load_automations()
    medulla = next((a for a in automations if "Medulla" in a.get('name', '')), None)
    
    if not medulla:
        print("Medulla automation not found.")
        return

    print(f"Found Medulla: {medulla['id']}")
    
    # 1. Reset Global 'last_run'
    if 'last_run' in medulla:
        print(f"Clearing global last_run: {medulla['last_run']}")
        del medulla['last_run']
        
    # 2. Reset 'last_run' in Time Interval Node
    nodes = medulla.get('nodes', [])
    for node in nodes:
        if node.get('type') == 'time_interval':
            data = node.get('data', {})
            if 'last_run' in data:
                 print(f"Clearing node last_run: {data['last_run']}")
                 # We can set it to None or delete it. 
                 # To be safe, let's set it to None so the key exists if logic expects it, 
                 # or delete it if logic checks for existence.
                 # Based on logic: `last_run_str = data.get('last_run')` -> None is safe.
                 data['last_run'] = None
                 
    # 3. Clear 'last_error' if any
    if 'last_error' in medulla:
        print("Clearing last_error")
        del medulla['last_error']

    save_automation(medulla)
    print("Medulla successfully reset.")

if __name__ == "__main__":
    reset_medulla()
