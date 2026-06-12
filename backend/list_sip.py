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
    
    print("=== Trunks ===")
    trunks = await lkapi.sip.list_sip_inbound_trunk(api.ListSIPInboundTrunkRequest())
    for t in trunks.items:
        print(f"Trunk: {t.name} (ID: {t.sip_trunk_id}) - Numbers: {t.numbers}")
        
    print("\n=== Dispatch Rules ===")
    rules = await lkapi.sip.list_sip_dispatch_rule(api.ListSIPDispatchRuleRequest())
    for r in rules.items:
        print(f"Rule: {r.name} (ID: {r.sip_dispatch_rule_id}) - Rule: {r.rule}")

    await lkapi.aclose()

if __name__ == "__main__":
    asyncio.run(main())
