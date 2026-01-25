import requests
import json
import sys

url = "http://127.0.0.1:8000/api/prometheus"
payload = {"prompt": "Sentiment on $NVDA", "email": "guest"}
headers = {"Content-Type": "application/json"}

try:
    print(f"Connecting to {url}...")
    with requests.post(url, json=payload, headers=headers, stream=True) as r:
        r.raise_for_status()
        for line in r.iter_lines():
            if line:
                print(f"Received: {line.decode('utf-8')}")
except Exception as e:
    print(f"Error: {e}")
