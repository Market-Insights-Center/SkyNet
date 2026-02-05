
import json
import urllib.request
import urllib.error
import sys
import time

URL = "http://127.0.0.1:8000/api/sentinel/execute"
EMAIL = "marketinsightscenter@gmail.com"
PROMPT = """I have the following list of tickers:
LITE, DXYZ, TER, PALL, SFTBY
Please compare all of the tickers using your general research, their ML forecast numbers on each time frame, their quickscore numbers on each time frame, and their AAPC, IV, IVR, Beta, and Correlation using Assess score A.

Please make sure to generate a final summary ordering the assets based on the strongest buy based on the found and calculated information to the weakest buy signal"""

payload = {
    "user_prompt": PROMPT,
    "email": EMAIL,
    "execution_mode": "auto"
    # No plan override
}

data = json.dumps(payload).encode('utf-8')
headers = {
    "Content-Type": "application/json",
    "Accept": "application/x-ndjson"
}

print(f"Sending request to {URL}...")
print(f"Payload: {payload}")

try:
    req = urllib.request.Request(URL, data=data, headers=headers)
    with urllib.request.urlopen(req) as response:
        print(f"Response Status: {response.status}")
        
        for line in response:
            decoded_line = line.decode('utf-8').strip()
            if not decoded_line: continue
            
            try:
                msg = json.loads(decoded_line)
                msg_type = msg.get("type", "unknown")
                msg_content = msg.get("message", "")
                
                print(f"[{msg_type.upper()}] {msg_content}")
                
                if msg_type == "error":
                    print("!!! ERROR DETECTED IN STREAM !!!")
                    print(decoded_line)
                    # Don't exit immediately, see if it recovers (unlikely)
                    
                if msg_type == "final":
                    print("SUCCESS: Final context received.")
                    sys.exit(0)
                    
            except json.JSONDecodeError:
                print(f"[RAW] {decoded_line}")

except urllib.error.URLError as e:
    print(f"Connection Failed: {e}")
    print("Ensure the backend server is running on localhost:8000")
    sys.exit(1)
except Exception as e:
    print(f"Unexpected Error: {e}")
    sys.exit(1)
