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
    
    trunks = await lkapi.sip.list_sip_inbound_trunk(api.ListSIPInboundTrunkRequest())
    for t in trunks.items:
        print(f"Trunk: {t.name} (ID: {t.sip_trunk_id})")
        print(f"  Numbers: {t.numbers}")
        print(f"  Allowed Addresses: {t.allowed_addresses}")
        print(f"  Allowed Numbers: {t.allowed_numbers}")

    await lkapi.aclose()

if __name__ == "__main__":
    asyncio.run(main())
