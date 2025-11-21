import requests
import json

def test_invest():
    url = "http://localhost:8000/api/invest"
    payload = {
        "ema_sensitivity": 2,
        "amplification": 1.0,
        "sub_portfolios": [
            {
                "tickers": ["AAPL", "MSFT"],
                "weight": 100.0
            }
        ],
        "tailor_to_value": False,
        "total_value": 10000,
        "use_fractional_shares": False
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print("Response Data:", json.dumps(data, indent=2))
        else:
            print("Error Response:", response.text)
    except Exception as e:
        print(f"Request Failed: {e}")

if __name__ == "__main__":
    test_invest()
