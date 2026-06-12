import os
import sys
import asyncio
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from livekit import api

async def main():
    lkapi = api.LiveKitAPI(
        os.getenv("LIVEKIT_URL"),
        os.getenv("LIVEKIT_API_KEY"),
        os.getenv("LIVEKIT_API_SECRET"),
    )
    print("Listing outbound trunks...")
    res = await lkapi.sip.list_outbound_trunk(api.ListSIPOutboundTrunkRequest())
    for t in res.items:
        print(f"Trunk: {t.name} (ID: {t.sip_trunk_id}) - Address: {t.address} - Numbers: {t.numbers}")
    
    await lkapi.aclose()

asyncio.run(main())
