import requests
import time

def verify():
    url = "http://127.0.0.1:8000/api/market-data"
    payload = {"tickers": ["SPY"]}
    print(f"Testing {url}...")
    
    for i in range(5):
        try:
            res = requests.post(url, json=payload, timeout=10)
            if res.status_code == 200:
                data = res.json()
                print("Success!")
                print("Data:", data)
                # Check logic
                if isinstance(data, list) and len(data) > 0:
                    spy = data[0]
                    print(f"SPY Price: {spy.get('price')}")
                    print(f"SPY Change: {spy.get('change')}%")
                    if abs(spy.get('change', 0)) < 10: 
                        print("VERIFICATION PASSED: Change is reasonable.")
                    else:
                        print("VERIFICATION WARNING: Change seems high (or fix failed if ~100%).")
                return
            else:
               print(f"Failed: {res.status_code} {res.text}")
        except Exception as e:
            print(f"Attempt {i+1} failed: {e}")
            time.sleep(2)

if __name__ == "__main__":
    verify()
