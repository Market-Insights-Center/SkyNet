
import requests
try:
    res = requests.get('http://localhost:8000/api/automations')
    data = res.json()
    for auto in data:
        if 'last_error' in auto:
             print(f"[{auto['name']}] Last Error: {auto['last_error']}")
        else:
             print(f"[{auto['name']}] No Last Error")
except Exception as e:
    print(e)
