import requests
import json

try:
    response = requests.post(
        "http://localhost:8000/api/market-data",
        json={"tickers": ["SPY"]},
        timeout=10
    )
    if response.status_code == 200:
        data = response.json()
        print("Success!")
        print(json.dumps(data, indent=2))
    else:
        print(f"Failed with code {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"Error: {e}")
