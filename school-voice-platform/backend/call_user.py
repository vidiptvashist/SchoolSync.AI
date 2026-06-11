import requests
import os
from dotenv import load_dotenv

load_dotenv()
EXOTEL_SID = os.getenv("EXOTEL_ACCOUNT_SID")
EXOTEL_KEY = os.getenv("EXOTEL_API_KEY")
EXOTEL_TOKEN = os.getenv("EXOTEL_API_TOKEN")

to_number = "08447565985"
caller_id = "01141189359"
url = "https://atlas-flexibility-combining-sympathy.trycloudflare.com/voice/inbound"

auth = (EXOTEL_KEY, EXOTEL_TOKEN)
data = {
    "From": to_number,
    "CallerId": caller_id,
    "Url": url,
    "CallType": "trans"
}
resp = requests.post(
    f"https://api.exotel.com/v1/Accounts/{EXOTEL_SID}/Calls/connect.json",
    auth=auth,
    data=data
)
print(resp.status_code, resp.text)
