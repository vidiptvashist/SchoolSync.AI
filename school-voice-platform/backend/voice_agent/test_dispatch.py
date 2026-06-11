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
    
    room_name = "test-room-2"
    print(f"Creating room {room_name} and dispatching agent...")
    
    # Create the room
    await lkapi.room.create_room(api.CreateRoomRequest(name=room_name))
    
    # Dispatch the agent to the room
    try:
        dispatch = await lkapi.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                agent_name="school-voice-agent",
                room=room_name,
            )
        )
        print(f"Agent dispatched successfully: {dispatch.id}")
    except Exception as e:
        print(f"Failed to dispatch: {e}")
        
    print(f"Go to https://agents-playground.livekit.io/ to connect to this room.")
    
    # Generate token for the user to join
    token = api.AccessToken(
        os.getenv("LIVEKIT_API_KEY"),
        os.getenv("LIVEKIT_API_SECRET")
    ).with_identity("test-user").with_name("Test User").with_grants(
        api.VideoGrants(
            room_join=True,
            room=room_name,
        )
    ).to_jwt()
    print(f"Token: {token}")

    await lkapi.aclose()

if __name__ == "__main__":
    asyncio.run(main())
