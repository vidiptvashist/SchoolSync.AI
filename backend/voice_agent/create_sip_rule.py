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
        # 1. Delete old rule
        try:
            await lkapi.sip.delete_dispatch_rule(
                api.DeleteSIPDispatchRuleRequest(
                    sip_dispatch_rule_id="SDR_idhdPjGKjv5r"
                )
            )
            print("Successfully deleted old rule SDR_idhdPjGKjv5r")
        except Exception as e:
            print(f"Failed to delete old rule: {e}")
            
        # 2. Check SIPDispatchRuleCallee attributes
        print("Checking api attributes...")
        print("api has SIPDispatchRuleCallee:", hasattr(api, "SIPDispatchRuleCallee"))
        
        # 3. Define callee rule
        rule = api.SIPDispatchRule(
            dispatch_rule_callee=api.SIPDispatchRuleCallee(
                room_prefix="",
                randomize=False
            )
        )
        
        # 4. Define room config with the agent
        room_config = api.RoomConfiguration(
            agents=[
                api.RoomAgentDispatch(
                    agent_name="school-voice-agent"
                )
            ]
        )
        
        # 5. Create request
        request = api.CreateSIPDispatchRuleRequest(
            name="Inbound Callee Room Rule",
            rule=rule,
            room_config=room_config
        )
        
        # 6. Create the dispatch rule
        dispatch_rule = await lkapi.sip.create_dispatch_rule(request)
        print(f"Successfully created SIP Callee Dispatch Rule!")
        print(f"Rule ID: {dispatch_rule.sip_dispatch_rule_id}")
        print(f"Name: {dispatch_rule.name}")
        print(f"Rule Detail: {dispatch_rule.rule}")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await lkapi.aclose()

if __name__ == "__main__":
    asyncio.run(main())
