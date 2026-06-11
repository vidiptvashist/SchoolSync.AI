import livekit.api as api
import asyncio
async def test():
    async with api.LiveKitAPI() as lk:
        print(dir(lk.agent_dispatch))
asyncio.run(test())
