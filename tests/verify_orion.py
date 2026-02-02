import asyncio
import websockets
import json

async def test():
    uri = "ws://localhost:8001"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected!")
            
            # Send Start Vision
            print("Sending START_VISION...")
            await websocket.send(json.dumps({"action": "START_VISION"}))
            print("Sent. Waiting for response...")
            
            # Wait for response
            for _ in range(5):
                resp = await websocket.recv()
                print(f"Received: {resp}")
                data = json.loads(resp)
                if data.get("action") == "VISION_STATUS":
                    print("SUCCESS: Vision Status Update Received.")
                    break
    except Exception as e:
        print(f"Test Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test())
