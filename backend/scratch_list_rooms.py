import os
import sys
import asyncio
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from livekit import api

async def main():
    lkapi = api.LiveKitAPI(
        os.getenv("LIVEKIT_URL"),
        os.getenv("LIVEKIT_API_KEY"),
        os.getenv("LIVEKIT_API_SECRET"),
    )
    print("Listing rooms...")
    res = await lkapi.room.list_rooms(api.ListRoomsRequest())
    for room in res.rooms:
        print(f"Room: {room.name} (ID: {room.sid}) - Participants: {room.num_participants} - Metadata: {room.metadata}")
    
    await lkapi.aclose()

asyncio.run(main())
