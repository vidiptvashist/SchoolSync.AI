import asyncio
import os
from livekit import api
from dotenv import load_dotenv

load_dotenv()

async def main():
    lkapi = api.LiveKitAPI(
        os.getenv("LIVEKIT_URL"),
        os.getenv("LIVEKIT_API_KEY"),
        os.getenv("LIVEKIT_API_SECRET"),
    )
    
    print("Creating new trunk with wildcard IPs...")
    new_trunk = await lkapi.sip.create_inbound_trunk(api.CreateSIPInboundTrunkRequest(
        trunk=api.SIPInboundTrunkInfo(
            name="Wildcard Inbound Trunk",
            numbers=[""],
            allowed_addresses=["0.0.0.0/0"],
            allowed_numbers=[".*"],
        )
    ))
    print(f"Created new trunk: {new_trunk.sip_trunk_id}")

    await lkapi.aclose()

if __name__ == "__main__":
    asyncio.run(main())
