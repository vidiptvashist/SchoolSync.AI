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

    print(f"Connecting to LiveKit: {url}")
    lkapi = api.LiveKitAPI(
        url=url,
        api_key=api_key,
        api_secret=api_secret
    )

    try:
        # 1. List and Delete old dispatch rules
        rules = await lkapi.sip.list_sip_dispatch_rule(api.ListSIPDispatchRuleRequest())
        for r in rules.items:
            print(f"Deleting old rule: {r.name} ({r.sip_dispatch_rule_id})...")
            await lkapi.sip.delete_dispatch_rule(
                api.DeleteSIPDispatchRuleRequest(sip_dispatch_rule_id=r.sip_dispatch_rule_id)
            )

        # 2. Define the new Individual rule
        rule = api.SIPDispatchRule(
            dispatch_rule_individual=api.SIPDispatchRuleIndividual(
                room_prefix="inbound_",
                no_randomness=False
            )
        )

        # 3. Define room config with our agent
        room_config = api.RoomConfiguration(
            agents=[
                api.RoomAgentDispatch(
                    agent_name="school-voice-agent"
                )
            ]
        )

        # 4. Create the new rule
        request = api.CreateSIPDispatchRuleRequest(
            name="Inbound Individual Room Rule",
            rule=rule,
            room_config=room_config
        )

        new_rule = await lkapi.sip.create_dispatch_rule(request)
        print("\n[+] Successfully created Inbound Individual Dispatch Rule!")
        print(f"    Rule ID: {new_rule.sip_dispatch_rule_id}")
        print(f"    Name:    {new_rule.name}")

    except Exception as e:
        print(f"\n[!] Error updating dispatch rule: {e}")
    finally:
        await lkapi.aclose()

if __name__ == "__main__":
    asyncio.run(main())
