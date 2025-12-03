import json
with open('backend/serviceAccountKey.json') as f:
    print(json.dumps(json.load(f)))