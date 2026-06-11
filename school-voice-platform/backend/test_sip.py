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
    
    print(dir(lkapi.sip))
    await lkapi.aclose()

if __name__ == "__main__":
    asyncio.run(main())
