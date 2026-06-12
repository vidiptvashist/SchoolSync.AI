import asyncio
import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from livekit import api

async def main():
    url = os.getenv("LIVEKIT_URL")
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")

    lkapi = api.LiveKitAPI(
        url=url,
        api_key=api_key,
        api_secret=api_secret
    )

    try:
        # Delete old inbound trunks
        trunks = await lkapi.sip.list_inbound_trunk(api.ListSIPInboundTrunkRequest())
        for t in trunks.items:
            print(f"Deleting old Inbound Trunk: {t.name} ({t.sip_trunk_id})...")
            await lkapi.sip.delete_trunk(
                api.DeleteSIPTrunkRequest(sip_trunk_id=t.sip_trunk_id)
            )

        # Create new Inbound Trunk with numbers=[]
        request = api.CreateSIPInboundTrunkRequest(
            trunk=api.SIPInboundTrunkInfo(
                name="Vobiz Inbound Trunk Wildcard",
                numbers=[], # Completely empty array
                allowed_addresses=["0.0.0.0/0"]
            )
        )
        
        trunk = await lkapi.sip.create_inbound_trunk(request)
        print("\n[+] Successfully created Inbound Trunk with empty numbers array!")
        print(f"    Trunk ID: {trunk.sip_trunk_id}")
        print(f"    Numbers: {list(trunk.numbers)}")
        print(f"    Allowed IPs: {list(trunk.allowed_addresses)}")

    except Exception as e:
        print(f"\n[!] Error: {e}")
    finally:
        await lkapi.aclose()

if __name__ == "__main__":
    asyncio.run(main())
