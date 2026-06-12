import os
import asyncio
from dotenv import load_dotenv
load_dotenv()
from livekit import api
async def main():
    lkapi = api.LiveKitAPI()
    jobs = await lkapi.job.list_jobs(api.ListJobsRequest())
    print("Jobs:", jobs)
    await lkapi.aclose()
asyncio.run(main())
