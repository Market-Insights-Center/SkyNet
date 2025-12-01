import requests
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def test_endpoint(name, endpoint, payload):
    print(f"Testing {name} ({endpoint})...")
    try:
        response = requests.post(f"{BASE_URL}{endpoint}", json=payload)
        if response.status_code == 200:
            print(f"✅ {name} Success: {response.status_code}")
            # print(json.dumps(response.json(), indent=2))
            return True
        else:
            print(f"❌ {name} Failed: {response.status_code}")
            print(response.text)
            return False
    except Exception as e:
        print(f"❌ {name} Error: {e}")
        return False

def main():
    # Test Invest
    invest_payload = {
        "ema_sensitivity": 2,
        "amplification": 1.0,
        "sub_portfolios": [{"tickers": "AAPL", "weight": 100}],
        "tailor_to_value": True,
        "total_value": 10000,
        "use_fractional_shares": False
    }
    test_endpoint("Invest", "/api/invest", invest_payload)

    # Test Cultivate
    cultivate_payload = {
        "email_to": "test@example.com",
        "cultivate_code": "A",
        "portfolio_value": 10000,
        "use_fractional_shares": False,
        "action": "run_analysis"
    }
    test_endpoint("Cultivate", "/api/cultivate", cultivate_payload)

    # Test Custom
    custom_payload = {
        "portfolio_code": "My Strategy",
        "tailor_to_value": True,
        "total_value": 10000,
        "use_fractional_shares": False,
        "action": "run_analysis",
        "sub_portfolios": [],
        "ema_sensitivity": 2,
        "amplification": 1.0,
        "email_to": "test@example.com",
        "risk_tolerance": 10,
        "vote_type": "stock",
        "overwrite": False
    }
    test_endpoint("Custom", "/api/custom", custom_payload)

    # Test Tracking
    tracking_payload = {
        "portfolio_code": "My Strategy",
        "tailor_to_value": True,
        "total_value": 10000,
        "use_fractional_shares": False,
        "action": "run_analysis",
        "sub_portfolios": [],
        "ema_sensitivity": 2,
        "amplification": 1.0,
        "email_to": "test@example.com",
        "risk_tolerance": 10,
        "vote_type": "stock",
        "overwrite": False
    }
    test_endpoint("Tracking", "/api/tracking", tracking_payload)

if __name__ == "__main__":
    main()
