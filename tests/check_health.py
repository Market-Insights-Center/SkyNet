
import requests
import sys

try:
    resp = requests.get("http://localhost:8000/")
    print(f"Root: {resp.status_code}")
except Exception as e:
    print(f"Root failed: {e}")

try:
    resp = requests.get("http://localhost:8000/health")
    print(f"Health: {resp.status_code} - {resp.text}")
except Exception as e:
    print(f"Health failed: {e}")
