import asyncio
import websockets

async def test():
    uri = "ws://localhost:8000/voice/stream?call_sid=test123&caller_phone=123"
    try:
        async with websockets.connect(uri) as ws:
            print("Connected to WebSocket endpoint!")
            # Send fake connected
            await ws.send('{"event": "connected"}')
            print("Sent connected event")
            # Wait a sec
            await asyncio.sleep(1)
            # Send start
            await ws.send('{"event": "start", "stream_sid": "stream-123"}')
            print("Sent start event")
            # Wait for any response (maybe nothing, since we don't send until livekit audio arrives)
            await asyncio.sleep(2)
            print("Test successful")
    except Exception as e:
        print(f"Failed: {e}")

asyncio.run(test())
