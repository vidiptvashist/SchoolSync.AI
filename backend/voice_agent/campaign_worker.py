import logging
import asyncio
import json
import httpx
from typing import Optional

from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
    metrics,
    BackgroundAudioPlayer
)
from livekit import rtc
from sqlalchemy import update

# Setup basic logging for the script
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("campaign-worker")

# Setup SQLAlchemy dependencies dynamically
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from database import SessionLocal
from models.call_log import CallLog

async def _update_call_log_status(call_sid: str, status: str):
    async with SessionLocal() as db:
        try:
            from sqlalchemy import select
            call_log = await db.scalar(
                select(CallLog).where(CallLog.exotel_call_sid == call_sid)
            )
            if call_log:
                await db.execute(
                    update(CallLog)
                    .where(CallLog.exotel_call_sid == call_sid)
                    .values(status=status)
                )
                await db.commit()
                logger.info(f"Updated CallLog status to {status} for {call_sid}")
        except Exception as e:
            logger.error(f"Failed to update CallLog status for {call_sid}: {e}")

async def _increment_campaign_answered_calls(campaign_id: str):
    async with SessionLocal() as db:
        try:
            from models.campaign import Campaign
            import uuid
            if isinstance(campaign_id, str):
                try:
                    campaign_id = uuid.UUID(campaign_id)
                except ValueError:
                    pass
            await db.execute(
                update(Campaign)
                .where(Campaign.id == campaign_id)
                .values(answered_calls=Campaign.answered_calls + 1)
            )
            await db.commit()
            logger.info(f"Incremented answered_calls for campaign {campaign_id}")
        except Exception as e:
            logger.error(f"Failed to increment campaign answered_calls for {campaign_id}: {e}")

async def _finalize_campaign_call_log(call_sid: str, campaign_id: str, duration: int):
    async with SessionLocal() as db:
        try:
            from sqlalchemy.future import select
            from models.campaign import Campaign
            from models.notice import Notice
            import uuid
            
            notice_title = "Voice Notice"
            if campaign_id:
                if isinstance(campaign_id, str):
                    try:
                        campaign_uuid = uuid.UUID(campaign_id)
                    except ValueError:
                        campaign_uuid = None
                else:
                    campaign_uuid = campaign_id
                
                if campaign_uuid:
                    campaign_res = await db.execute(select(Campaign).where(Campaign.id == campaign_uuid))
                    campaign = campaign_res.scalars().first()
                    if campaign:
                        notice_res = await db.execute(select(Notice).where(Notice.id == campaign.notice_id))
                        notice = notice_res.scalars().first()
                        if notice:
                            notice_title = notice.title
            
            summary = f"Voice Notice Broadcast: '{notice_title}' was played to the parent."
            await db.execute(
                update(CallLog)
                .where(CallLog.exotel_call_sid == call_sid)
                .values(status="answered", duration_seconds=duration, summary=summary)
            )
            await db.commit()
            logger.info(f"Finalized CallLog status for {call_sid} to answered with summary: {summary}")
        except Exception as e:
            logger.error(f"Failed to finalize CallLog for {call_sid}: {e}")

async def fetch_audio_to_source(url: str) -> Optional[rtc.AudioSource]:
    """
    Downloads audio from URL, decodes it into raw PCM frames, and streams to a new rtc.AudioSource.
    For simplicity, BackgroundAudioPlayer handles local file paths better, but let's just 
    use the built-in HTTP stream support or save to a tmp file.
    Wait! `BackgroundAudioPlayer` in livekit.agents is not strictly for local files, but it plays `rtc.AudioFrame`s.
    Actually, to avoid audio format complexity (WAV vs MP3 vs M4A), we can use `livekit.agents.tts.synthesize()`? No, we have a URL.
    Instead, let's write the URL contents to a temporary file, and use standard audio parsing, or rely on `pydub` or similar?
    Wait, `BackgroundAudioPlayer` might not parse WAV out of the box if we pass a file path? No, `BuiltinAudioClip` or `AudioSource`?
    LiveKit's `BackgroundAudioPlayer` doesn't natively parse audio files. It accepts an `AudioSource` that is already receiving frames.
    Let's just use `pydub` or `librosa` to read the audio and push frames? No, the standard `school-voice-platform` has `openai` TTS.
    Wait, let's just use a subprocess to stream ffmpeg to standard output, and read it into an AudioSource!
    """
    pass

async def entrypoint(ctx: JobContext):
    # Connect to the LiveKit Room
    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_NONE)
    logger.info(f"Connected to Campaign Room: {ctx.room.name}")
    
    # Wait for the remote SIP participant (parent) to join/answer
    logger.info("Waiting for parent to pick up the call...")
    try:
        participant = await ctx.wait_for_participant()
    except Exception as e:
        logger.error(f"Error waiting for participant to join: {e}")
        await _update_call_log_status(ctx.room.name, "failed")
        return
        
    logger.info("SIP Participant joined the room. Monitoring call status...")
    
    start_wait = asyncio.get_event_loop().time()
    answered = False
    
    # We will wait up to 45 seconds for the parent to answer
    while asyncio.get_event_loop().time() - start_wait < 45:
        call_status = participant.attributes.get("sip.callStatus")
        logger.info(f"Current SIP call status: {call_status}")
        
        if call_status == "active":
            answered = True
            break
        elif call_status in ("hangup", "completed", "failed"):
            logger.info("SIP Call disconnected or failed before answering.")
            break
            
        await asyncio.sleep(0.5)

    if not answered:
        logger.warning("Call was not answered within timeout. Hanging up.")
        await _update_call_log_status(ctx.room.name, "missed")
        try:
            await ctx.delete_room()
        except Exception:
            pass
        return
        
    logger.info("Parent answered! Sleeping for 1.5s to allow RTP stream to stabilize...")
    await asyncio.sleep(1.5)
    
    # Extract metadata to retrieve campaign_id, school_id, and audio_url
    campaign_id = None
    school_id = None
    audio_url = None
    try:
        metadata_str = ctx.room.metadata
        if metadata_str:
            metadata = json.loads(metadata_str)
            campaign_id = metadata.get("campaign_id")
            school_id = metadata.get("school_id")
            audio_url = metadata.get("audio_url")
    except Exception as e:
        logger.error(f"Error parsing metadata: {e}")

    if not audio_url:
        logger.error("No audio_url found in room metadata. Cannot play.")
        return

    # Update status to 'answered' and increment campaign answered calls
    await _update_call_log_status(ctx.room.name, "answered")
    if campaign_id:
        await _increment_campaign_answered_calls(campaign_id)
        
    start_time = asyncio.get_event_loop().time()

    try:
        logger.info(f"Downloading campaign audio from {audio_url}")
        
        # Download the audio file to a temporary location
        import tempfile
        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        tmp_path = tmp_file.name
        tmp_file.close()
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(audio_url)
            resp.raise_for_status()
            with open(tmp_path, "wb") as f:
                f.write(resp.content)
                
        logger.info(f"Audio downloaded to {tmp_path}")
        
        # Push Audio to Room
        source = rtc.AudioSource(16000, 1)
        track = rtc.LocalAudioTrack.create_audio_track("campaign-audio", source)
        options = rtc.TrackPublishOptions()
        options.source = rtc.TrackSource.SOURCE_MICROPHONE
        await ctx.room.local_participant.publish_track(track, options)
        
        logger.info("Playing audio via ffmpeg...")
        process = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-i", tmp_path,
            "-f", "s16le",
            "-ar", "16000",
            "-ac", "1",
            "-",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL
        )
        
        frame_duration_ms = 10
        samples_per_channel = 16000 * frame_duration_ms // 1000
        bytes_per_frame = samples_per_channel * 2 # 16-bit
        
        while True:
            audio_bytes = await process.stdout.read(bytes_per_frame)
            if not audio_bytes:
                break
                
            # If the last frame is incomplete, pad it
            if len(audio_bytes) < bytes_per_frame:
                audio_bytes += b'\x00' * (bytes_per_frame - len(audio_bytes))
                
            audio_frame = rtc.AudioFrame(
                data=audio_bytes,
                sample_rate=16000,
                num_channels=1,
                samples_per_channel=samples_per_channel
            )
            await source.capture_frame(audio_frame)
            await asyncio.sleep(frame_duration_ms / 1000.0) # sleep to mimic real-time

        # Cleanup
        os.remove(tmp_path)
        logger.info("Finished playing audio.")
        
        # Give it a second before hanging up so the last frames make it through
        await asyncio.sleep(2)
        
        duration = int(asyncio.get_event_loop().time() - start_time)
        await _finalize_campaign_call_log(ctx.room.name, campaign_id, duration)

    except Exception as e:
        logger.error(f"Error in campaign worker: {e}")
        try:
            if 'start_time' in locals():
                duration = int(asyncio.get_event_loop().time() - start_time)
                await _finalize_campaign_call_log(ctx.room.name, campaign_id, duration)
        except Exception as ex:
            logger.error(f"Failed to run fail-safe finalize in except block: {ex}")
    finally:
        logger.info("Deleting room and disconnecting.")
        try:
            await ctx.delete_room()
        except Exception as e:
            logger.error(f"Failed to delete room: {e}")
        try:
            await ctx.room.disconnect()
        except Exception as e:
            logger.error(f"Failed to disconnect room: {e}")


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="campaign-player",
            port=8082
        )
    )

