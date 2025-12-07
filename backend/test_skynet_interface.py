import asyncio
import websockets
import json
import time

WS_PORT = 8001

async def handler(websocket):
    print(f"Client connected: {websocket.remote_address}")
    
    # 1. Send Voice Log Confirmation
    print("Sending VOICE_HEARD test...")
    await websocket.send(json.dumps({
        "action": "VOICE_HEARD", 
        "payload": "TESTING: I can hear you."
    }))
    await asyncio.sleep(1)

    # 2. Send System Log
    print("Sending LOG test...")
    await websocket.send(json.dumps({
        "action": "LOG", 
        "log": "System Interface Verification: Active", 
        "type": "SYSTEM"
    }))
    await asyncio.sleep(2)

    # 3. Trigger Sidebar
    print("Triggering SIDEBAR...")
    await websocket.send(json.dumps({"action": "OPEN_SIDEBAR"}))
    await asyncio.sleep(3)

    # 4. Trigger Controls
    print("Triggering CONTROLS...")
    await websocket.send(json.dumps({"action": "OPEN_CONTROLS"}))
    await asyncio.sleep(3)

    # 5. Close Controls
    print("Closing CONTROLS...")
    await websocket.send(json.dumps({"action": "CLOSE_CONTROLS"}))
    await asyncio.sleep(1)
    
    # 6. Close Sidebar
    print("Closing SIDEBAR...")
    await websocket.send(json.dumps({"action": "CLOSE_SIDEBAR"}))

    print("Test Sequence Complete.")

async def main():
    print(f"Starting Test Server on {WS_PORT}...")
    try:
        async with websockets.serve(handler, "0.0.0.0", WS_PORT):
            print("Server Listening. Please refresh the SkyNet web page now.")
            await asyncio.get_running_loop().create_future()  # run forever
    except OSError as e:
        print(f"ERROR: Could not bind to port {WS_PORT}. This means SkyNet Backend is ALREADY RUNNING.")
        print("Please terminate the existing 'skynet_v2.py' process and run this test again.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
