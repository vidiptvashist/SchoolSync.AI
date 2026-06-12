import asyncio
import httpx
import sys
import os

# Add backend root to path to ensure settings works
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from settings import (
    EXOTEL_ACCOUNT_SID,
    EXOTEL_API_KEY,
    EXOTEL_API_TOKEN,
    EXOTEL_CALLER_ID,
    EXOTEL_TEST_FROM
)

async def test_call():
    account_sid = EXOTEL_ACCOUNT_SID
    api_key = EXOTEL_API_KEY
    api_token = EXOTEL_API_TOKEN
    caller_id = EXOTEL_CALLER_ID
    test_from = EXOTEL_TEST_FROM
    
    print(f"Account SID: {account_sid}")
    print(f"API Key: {api_key}")
    print(f"Caller ID: {caller_id}")
    print(f"Test From: {test_from}")
    
    exotel_url = f"https://api.exotel.com/v1/Accounts/{account_sid}/Calls/connect.json"
    auth = (api_key, api_token)
    
    # We will test different payloads to see what works and what returns 400.
    # Payload 1: Minimal payload matching current implementation
    payload1 = {
        "From": test_from,
        "CallerId": caller_id,
        "CallType": "trans",
        "Url": "https://bf6fc7e877667b.lhr.life/webhooks/exotel/play-audio/6b848a1f-71f2-480d-bd68-f0996e36f488",
        "StatusCallback": "https://bf6fc7e877667b.lhr.life/webhooks/exotel/call-status"
    }
    
    async with httpx.AsyncClient() as client:
        print("\n--- Testing Outbound Call with CallType=trans and tunnel URLs ---")
        try:
            response = await client.post(exotel_url, data=payload1, auth=auth, timeout=10.0)
            print(f"Status Code: {response.status_code}")
            print(f"Response Body: {response.text}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_call())
