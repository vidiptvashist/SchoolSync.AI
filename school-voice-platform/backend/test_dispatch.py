import os
import asyncio
from dotenv import load_dotenv
import livekit.api as api
from livekit.protocol.agent_dispatch import CreateAgentDispatchRequest

load_dotenv()
async def test():
    lk_url = os.environ.get("LIVEKIT_URL")
    lk_key = os.environ.get("LIVEKIT_API_KEY")
    lk_secret = os.environ.get("LIVEKIT_API_SECRET")
    
    async with api.LiveKitAPI(lk_url, lk_key, lk_secret) as lkapi:
        req = CreateAgentDispatchRequest(agent_name="school-voice-agent", room="test_room_123")
        await lkapi.agent_dispatch.create_dispatch(req)
        print("Dispatch successful")

asyncio.run(test())
