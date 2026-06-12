import asyncio
import os
import sys
from dotenv import load_dotenv

# Ensure backend root is on path for settings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from livekit import api

async def main():
    url = os.getenv("LIVEKIT_URL")
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")
    
    print(f"Connecting to LiveKit: {url}")
    lkapi = api.LiveKitAPI(
        url=url,
        api_key=api_key,
        api_secret=api_secret
    )
    
    try:
        # Create Inbound Trunk
        request = api.CreateSIPInboundTrunkRequest(
            trunk=api.SIPInboundTrunkInfo(
                name="Wildcard Inbound Trunk",
                numbers=[""] # Wildcard to accept any number
            )
        )
        trunk = await lkapi.sip.create_inbound_trunk(request)
        print(f"Successfully created Wildcard Inbound Trunk!")
        print(f"Trunk ID: {trunk.sip_trunk_id}")
        print(f"Name: {trunk.name}")
        print(f"Numbers: {trunk.numbers}")
        
    except Exception as e:
        print(f"Error creating inbound trunk: {e}")
    finally:
        await lkapi.aclose()

if __name__ == "__main__":
    asyncio.run(main())
