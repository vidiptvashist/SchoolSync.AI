import asyncio
import os
import sys
from dotenv import load_dotenv

# Ensure paths are set correctly for backend imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from livekit import api

async def main():
    url = os.getenv("LIVEKIT_URL")
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")

    # Read Vobiz SIP Outbound settings from environment
    vobiz_domain = os.getenv("VOBIZ_SIP_DOMAIN")
    vobiz_user = os.getenv("VOBIZ_USERNAME")
    vobiz_pass = os.getenv("VOBIZ_PASSWORD")
    vobiz_number = os.getenv("VOBIZ_OUTBOUND_NUMBER")

    if not all([vobiz_domain, vobiz_user, vobiz_pass, vobiz_number]):
        print("\n[!] Error: VOBIZ SIP credentials missing in your .env file.")
        print("Please configure these in school-voice-platform/backend/.env first:")
        print("  VOBIZ_SIP_DOMAIN=...")
        print("  VOBIZ_USERNAME=...")
        print("  VOBIZ_PASSWORD=...")
        print("  VOBIZ_OUTBOUND_NUMBER=+918065481432")
        return

    print(f"Connecting to LiveKit: {url}")
    lkapi = api.LiveKitAPI(
        url=url,
        api_key=api_key,
        api_secret=api_secret
    )

    try:
        # Create/Register Outbound Trunk pointing to Vobiz
        request = api.CreateSIPOutboundTrunkRequest(
            trunk=api.SIPOutboundTrunkInfo(
                name="Vobiz Outbound Trunk",
                address=vobiz_domain,
                auth_username=vobiz_user,
                auth_password=vobiz_pass,
                numbers=[vobiz_number]
            )
        )
        
        trunk = await lkapi.sip.create_outbound_trunk(request)
        print("\n[+] Successfully created Vobiz SIP Outbound Trunk in LiveKit!")
        print(f"    Trunk ID: {trunk.sip_trunk_id}")
        print(f"    Name: {trunk.name}")
        print(f"    Address: {trunk.address}")
        print(f"    Bound Numbers: {trunk.numbers}")
        print("\n--> Add this Trunk ID to your .env file as:")
        print(f"    VOBIZ_OUTBOUND_TRUNK_ID={trunk.sip_trunk_id}")
        
    except Exception as e:
        print(f"\n[!] Error creating outbound trunk: {e}")
    finally:
        await lkapi.aclose()

if __name__ == "__main__":
    asyncio.run(main())
