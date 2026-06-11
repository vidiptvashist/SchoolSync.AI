import requests
import os
from dotenv import load_dotenv

load_dotenv()
EXOTEL_SID = os.getenv("EXOTEL_ACCOUNT_SID")
EXOTEL_KEY = os.getenv("EXOTEL_API_KEY")
EXOTEL_TOKEN = os.getenv("EXOTEL_API_TOKEN")

auth = (EXOTEL_KEY, EXOTEL_TOKEN)

# Let's try calling a SIP URI directly using the Calls/connect API
data = {
    "From": "08447565985",
    "To": "sip:test1234@voiceai-b7wp6x99.sip.livekit.cloud",
    "CallerId": "01141189359",
    "CallType": "trans"
}
resp = requests.post(
    f"https://api.exotel.com/v1/Accounts/{EXOTEL_SID}/Calls/connect.json",
    auth=auth,
    data=data
)
print("SIP URI as To:")
print(resp.status_code, resp.text)
