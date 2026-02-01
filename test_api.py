import requests
import json

try:
    url = "http://localhost:8000/api/mlforecast"
    payload = {"ticker": "SPY", "email": "guest"}
    headers = {"Content-Type": "application/json"}
    
    print(f"Testing {url}...")
    response = requests.post(url, json=payload, headers=headers, timeout=60)
    
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        print("Success!")
        print(str(response.json())[:200]) # Print start of response
    else:
        print(f"Failed: {response.text}")

except Exception as e:
    print(f"Request Error: {e}")
