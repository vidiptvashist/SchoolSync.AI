import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from livekit import api

print("CreateSIPParticipantRequest fields:")
print(list(api.CreateSIPParticipantRequest.DESCRIPTOR.fields_by_name.keys()))
