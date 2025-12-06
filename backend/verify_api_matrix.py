import requests
import json
import base64

BASE_URL = "http://localhost:8000"
EMAIL = "vic.tor@gmail.com"

def test_quickscore():
    print("\nTesting /api/quickscore...")
    try:
        payload = {"ticker": "AAPL", "email": EMAIL}
        resp = requests.post(f"{BASE_URL}/api/quickscore", json=payload)
        if resp.status_code == 200:
            data = resp.json()
            print("Success!")
            print(f"Score: {data.get('scores', {}).get('2')}") # Daily score
            if data.get('chart_image'):
                print("Chart image received.")
            else:
                print("No chart image.")
        else:
            print(f"Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"Error: {e}")

def test_market():
    print("\nTesting /api/market...")
    try:
        payload = {"email": EMAIL, "market_type": "sp500", "sensitivity": 2}
        resp = requests.post(f"{BASE_URL}/api/market", json=payload)
        if resp.status_code == 200:
            data = resp.json()
            if "error" in data:
                print(f"API Error: {data['error']}")
            else:
                print("Success!")
                print(f"Top 1: {data.get('top_10', [{}])[0].get('ticker')}")
                if data.get('chart_image'):
                    print("Chart visualization received.")
        else:
            print(f"Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"Error: {e}")

def test_breakout():
    print("\nTesting /api/breakout...")
    try:
        payload = {"email": EMAIL}
        resp = requests.post(f"{BASE_URL}/api/breakout", json=payload)
        if resp.status_code == 200:
            data = resp.json()
            print("Success!")
            print(f"Message: {data.get('message')}")
            breakouts = data.get('current_breakout_stocks', [])
            print(f"Found {len(breakouts)} breakouts.")
            if len(breakouts) > 0:
                ticker = breakouts[0].get('Ticker')
                if data.get('charts', {}).get(ticker):
                    print(f"Chart received for {ticker}.")
        else:
            print(f"Failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Ensure backend is up
    try:
        requests.get(f"{BASE_URL}/docs")
        print("Backend is reachable.")
    except:
        print("Backend not reachable. Ensure it is running.")
        exit(1)

    test_quickscore()
    test_market()
    test_breakout()
