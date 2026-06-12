import logging
import json
from sqlalchemy import update
from settings import (
    LIVEKIT_URL,
    LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET,
    VOBIZ_OUTBOUND_TRUNK_ID,
    PUBLIC_URL
)
from livekit import api
from database import SessionLocal
from models.call_log import CallLog
from models.campaign import Campaign

logger = logging.getLogger("campaign_service")

class CampaignService:
    async def launch_bulk_campaign(self, phone_numbers: list[str], audio_url: str, campaign_id: str, school_id: str):
        """
        Runs asynchronously as a background task.
        Loops through target phone numbers, launches LiveKit Outbound SIP calls, and logs initial call statuses.
        """
        logger.info(f"Launching bulk campaign {campaign_id} for {len(phone_numbers)} numbers via LiveKit SIP.")
        
        # 1. Ensure we have the full public URL for the audio notice file
        full_audio_url = audio_url
        if audio_url.startswith("/"):
            public_url = PUBLIC_URL or "http://localhost:8000"
            full_audio_url = f"{public_url}{audio_url}"
            
        if not VOBIZ_OUTBOUND_TRUNK_ID:
            logger.error("VOBIZ_OUTBOUND_TRUNK_ID is not configured. Cannot launch campaign.")
            return

        # Update Campaign status to 'running'
        async with SessionLocal() as db:
            await db.execute(
                update(Campaign)
                .where(Campaign.id == campaign_id)
                .values(status="running", total_calls=len(phone_numbers))
            )
            await db.commit()
            
        success_count = 0
        lkapi = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        
        try:
            # 3. Dispatch calls to each phone number
            for phone in phone_numbers:
                room_name = f"campaign_{campaign_id}_{phone}"
                call_status = "failed"
                
                # Format phone number for SIP standard if needed
                formatted_phone = phone
                if not formatted_phone.startswith("+"):
                    if len(formatted_phone) == 10:
                        formatted_phone = f"+91{formatted_phone}"
                    elif formatted_phone.startswith("91") and len(formatted_phone) == 12:
                        formatted_phone = f"+{formatted_phone}"
                        
                try:
                    # 3a. Explicitly create the room and attach the audio URL in metadata
                    metadata = json.dumps({
                        "audio_url": full_audio_url,
                        "campaign_id": campaign_id,
                        "school_id": school_id
                    })
                    
                    logger.info(f"Creating Room {room_name} for Campaign.")
                    await lkapi.room.create_room(
                        api.CreateRoomRequest(
                            name=room_name,
                            metadata=metadata,
                            empty_timeout=2 * 60 # Close after 2 mins if no one joins
                        )
                    )
                    
                    # 3b. Dispatch the "campaign-player" agent to this specific room
                    logger.info(f"Dispatching campaign-player agent to Room {room_name}.")
                    await lkapi.agent_dispatch.create_dispatch(
                        api.CreateAgentDispatchRequest(
                            agent_name="campaign-player",
                            room=room_name
                        )
                    )
                    
                    # 3c. Create SIP Participant to dial out
                    logger.info(f"Triggering Outbound SIP Call to {formatted_phone} on Room {room_name}.")
                    sip_participant = await lkapi.sip.create_sip_participant(
                        api.CreateSIPParticipantRequest(
                            sip_trunk_id=VOBIZ_OUTBOUND_TRUNK_ID,
                            sip_call_to=formatted_phone,
                            room_name=room_name,
                            participant_identity=f"sip_{formatted_phone}",
                            play_ringtone=False
                        )
                    )
                    
                    call_status = "dialing"
                    success_count += 1
                    
                except Exception as e:
                    logger.error(f"Failed to trigger LiveKit SIP Outbound for {phone}: {e}")
                    
                # 4. Log the initial call state in database
                async with SessionLocal() as db:
                    new_log = CallLog(
                        school_id=school_id,
                        campaign_id=campaign_id,
                        caller_phone=phone,
                        direction="outbound",
                        status=call_status,
                        # Use the room name as the unique identifier for LiveKit campaign calls
                        exotel_call_sid=room_name, 
                        duration_seconds=0
                    )
                    db.add(new_log)
                    await db.commit()
                    
        finally:
            await lkapi.aclose()
                    
        # Update Campaign status to 'completed' (or 'failed' if all calls failed)
        # Note: 'completed' means fully dispatched, not necessarily that calls were answered.
        final_status = "completed" if success_count > 0 or len(phone_numbers) == 0 else "failed"
        async with SessionLocal() as db:
            await db.execute(
                update(Campaign)
                .where(Campaign.id == campaign_id)
                .values(status=final_status)
            )
            await db.commit()
            
        logger.info(f"Finished bulk campaign dispatch {campaign_id}. Success: {success_count}/{len(phone_numbers)}")

campaign_service = CampaignService()
