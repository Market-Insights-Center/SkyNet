import requests
import json
import sys

# Define the endpoint
url = "http://127.0.0.1:8000/api/nexus"

# Dummy payload matching the request structure
payload = {
    "nexus_code": "SKYNET", 
    "email": "test@example.com",
    "total_value": 5000, 
    "create_new": False,
    "components": [],
    "use_fractional_shares": True,
    "execute_rh": False,
    "email_to": "test@example.com",
    "send_email": False,
    "overwrite": False
}

try:
    with open("verification_output.txt", "w") as f:
        f.write(f"Testing streaming endpoint: {url}\n")
        try:
            with requests.post(url, json=payload, stream=True) as response:
                f.write(f"Response Code: {response.status_code}\n")
                if response.status_code != 200:
                    f.write(f"Error: {response.text}\n")
                    sys.exit(1)
                
                f.write("Reading stream...\n")
                for line in response.iter_lines():
                    if line:
                        decoded_line = line.decode('utf-8')
                        try:
                            data = json.loads(decoded_line)
                            
                            if 'type' not in data:
                                f.write(f"[WARNING] Missing 'type' field. Keys: {list(data.keys())}\n")
                                if 'status' in data:
                                    f.write(f"[OLD RESPONSE DETECTED] Status: {data.get('status')} Msg: {data.get('message')}\n")
                                    # Since we detected old response, we can break early as we know verification failed
                                    break
                            
                            event_type = data.get('type')
                            if event_type == 'progress':
                                f.write(f"[PROGRESS] {data['message']}\n")
                            elif event_type == 'result':
                                f.write(f"[RESULT] Got Result Payload (Keys: {list(data.get('payload', {}).keys())})\n")
                            elif event_type == 'error':
                                f.write(f"[ERROR] {data['message']}\n")
                        except json.JSONDecodeError:
                             f.write(f"[RAW] {decoded_line}\n")
        except Exception as inner_e:
             f.write(f"Stream Error: {inner_e}\n")

except Exception as e:
    with open("verification_output.txt", "w") as f:
        f.write(f"Connection Failed: {e}\nEnsure the server is running on localhost:8000")
    sys.exit(1)
