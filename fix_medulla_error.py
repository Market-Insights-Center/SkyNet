
import requests
import json

def fix_medulla():
    print("Fetching current state...")
    try:
        res = requests.get('http://localhost:8000/api/automations')
        data = res.json()
        
        medulla = next((a for a in data if 'Medulla' in a.get('name', '')), None)
        if not medulla:
            print("Medulla not found")
            return

        if 'last_error' in medulla:
            print(f"Found Error: {medulla['last_error']}")
            print("Cleaning error...")
            del medulla['last_error']
            
            # Save back
            save_url = 'http://localhost:8000/api/automations/save'
            # Convert to save request format (matches schema?)
            # Schema: id, name, active, nodes, edges, user_email...
            save_payload = {
                "id": medulla['id'],
                "name": medulla['name'],
                "active": medulla['active'],
                "nodes": medulla['nodes'],
                "edges": medulla['edges'],
                "user_email": medulla['user_email'],
                "description": medulla.get('description', ''),
                "next_run": medulla.get('next_run'),
                "last_run": medulla.get('last_run')
            }
            
            save_res = requests.post(save_url, json=save_payload)
            if save_res.ok:
                print("✅ Successfully saved cleaned automation.")
            else:
                print(f"❌ Failed to save: {save_res.text}")
        else:
            print("Medulla has no last_error.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_medulla()
