import argparse
import asyncio
import os
import sys
import json
import random
from dotenv import load_dotenv

# Ensure paths are set correctly for backend imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from livekit import api

async def main():
    parser = argparse.ArgumentParser(description="Place an outbound call via LiveKit + Vobiz SIP.")
    parser.add_argument("--to", required=True, help="The destination phone number to call (e.g. +91XXXXXXXXXX)")
    parser.add_argument("--school", help="Optional school ID to pass to agent session", default="")
    parser.add_argument("--student", help="Optional student ID to pass to agent session", default="")
    
    args = parser.parse_args()
    phone_number = args.to.strip()
    
    if not phone_number.startswith("+"):
        print("Error: Phone number must start with '+' and country code (e.g. +91XXXXXXXXXX)")
        return

    url = os.getenv("LIVEKIT_URL")
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")
    trunk_id = os.getenv("VOBIZ_OUTBOUND_TRUNK_ID")

    if not trunk_id:
        print("\n[!] Error: VOBIZ_OUTBOUND_TRUNK_ID not found in .env.")
        print("Please run 'python voice_agent/setup_vobiz_trunk.py' first to register the trunk and save its ID.")
        return

    print(f"Connecting to LiveKit: {url}")
    lkapi = api.LiveKitAPI(
        url=url,
        api_key=api_key,
        api_secret=api_secret
    )

    # Generate a unique room name for the call
    random_suffix = random.randint(1000, 9999)
    room_name = f"call_{phone_number.replace('+', '')}_{random_suffix}"
    
    # Store dynamic metadata about the call (school ID, student ID, caller phone)
    metadata_payload = {
        "school_id": args.school,
        "student_id": args.student,
        "caller_phone": phone_number,
        "authenticated": False
    }

    try:
        print(f"Initiating outbound call to {phone_number} via Trunk {trunk_id}...")
        
        request = api.CreateSIPParticipantRequest(
            sip_trunk_id=trunk_id,
            sip_call_to=phone_number,
            room_name=room_name,
            participant_identity=f"phone_{phone_number}",
            participant_name="Parent",
            participant_metadata=json.dumps(metadata_payload)
        )
        
        participant = await lkapi.sip.create_sip_participant(request)
        
        # Explicitly dispatch agent worker to the room
        from livekit.protocol.agent_dispatch import CreateAgentDispatchRequest
        dispatch_req = CreateAgentDispatchRequest(
            agent_name="school-voice-agent",
            room=room_name
        )
        await lkapi.agent_dispatch.create_dispatch(dispatch_req)
        
        print("\n[+] Call triggered and agent dispatched successfully!")
        print(f"    Room Name:   {room_name}")
        print(f"    Participant: {participant.participant_identity}")
        print("\nMake sure your local agent worker is running ('python voice_agent/agent.py start') to answer the call!")

    except Exception as e:
        print(f"\n[!] Error dialing number: {e}")
    finally:
        await lkapi.aclose()

if __name__ == "__main__":
    asyncio.run(main())
