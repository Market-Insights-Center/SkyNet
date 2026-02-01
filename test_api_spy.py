import requests
import json

try:
    url = "http://127.0.0.1:8000/api/market-data"
    payload = {"tickers": ["SPY"]}
    print(f"POST {url} with {payload}")
    
    resp = requests.post(url, json=payload)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code == 200:
        data = resp.json()
        print(json.dumps(data, indent=2))
        
        # specific check
        if isinstance(data, list) and len(data) > 0:
            item = data[0]
            print(f"\nTicker: {item.get('ticker')}")
            print(f"Price: {item.get('price')}")
            print(f"Change: {item.get('change')}%")
            
            # Check if cache headers exist or if we can infer age (optional)
    else:
        print("Error:", resp.text)

except Exception as e:
    print(f"Failed: {e}")
