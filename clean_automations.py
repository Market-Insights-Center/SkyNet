
import json
import os

def clean_automations():
    path = 'backend/data/automations.json'
    try:
        with open(path, 'r') as f:
            autos = json.load(f)
        
        found = False
        for auto in autos:
            if 'last_error' in auto:
                print(f"Found error in {auto.get('name')}: {auto['last_error']}")
                del auto['last_error']
                found = True
        
        if found:
            with open(path, 'w') as f:
                json.dump(autos, f, indent=4)
            print("✅ cleaned automations.json")
        else:
            print("No last_error found in automations.json")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    clean_automations()
