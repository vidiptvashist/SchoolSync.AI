import requests
import os
from dotenv import load_dotenv

load_dotenv()
EXOTEL_SID = os.getenv("EXOTEL_ACCOUNT_SID")
EXOTEL_KEY = os.getenv("EXOTEL_API_KEY")
EXOTEL_TOKEN = os.getenv("EXOTEL_API_TOKEN")

auth = (EXOTEL_KEY, EXOTEL_TOKEN)
resp = requests.get(
    f"https://api.exotel.com/v1/Accounts/{EXOTEL_SID}/Calls/e2ae3646580de97a2d876eb958091a6b.json",
    auth=auth
)
print(resp.status_code, resp.text)
