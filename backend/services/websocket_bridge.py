import os
import json
import base64
import asyncio
import logging
import math
import wave
from fastapi import WebSocket, WebSocketDisconnect
import livekit.rtc as rtc
from livekit import api

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s [%(name)s] %(message)s')

# Exotel uses 8000Hz, 1 channel by default
SAMPLE_RATE = 8000
CHANNELS = 1

def _delete_session(call_sid: str) -> None:
    """Delete call session from Redis."""
    try:
        import redis
        from settings import REDIS_URL
        r = redis.from_url(REDIS_URL, decode_responses=True)
        keys = [f"call:{call_sid}", f"voice_call:{call_sid}"]
        r.delete(*keys)
        logger.info(f"Deleted Redis session keys in websocket bridge: {keys}")
    except Exception as e:
        logger.error(f"Failed to delete Redis session in websocket bridge: {e}")

def _get_session(call_sid: str) -> "dict | None":
    """Retrieve call session from Redis."""
    try:
        import redis
        from settings import REDIS_URL
        r = redis.from_url(REDIS_URL, decode_responses=True)
        for key in [f"call:{call_sid}", f"voice_call:{call_sid}"]:
            raw = r.get(key)
            if raw:
                return json.loads(raw)
        return None
    except Exception as e:
        logger.error(f"Failed to get Redis session in websocket bridge: {e}")
        return None

_lk_api_client = None

def _get_livekit_api() -> api.LiveKitAPI:
    global _lk_api_client
    if _lk_api_client is None:
        lk_url = os.environ.get("LIVEKIT_URL")
        lk_key = os.environ.get("LIVEKIT_API_KEY")
        lk_secret = os.environ.get("LIVEKIT_API_SECRET")
        _lk_api_client = api.LiveKitAPI(lk_url, lk_key, lk_secret)
    return _lk_api_client


# ───────────────── Campaign Audio Playout ─────────────────

async def _handle_campaign_playout(websocket: WebSocket, call_sid: str, campaign_id: str, stream_sid: str):
    """
    Play the notice audio file directly over the Exotel WebSocket.
    Reads the WAV from disk, chunks into 20ms frames, streams at real-time pace.
    """
    logger.info(f"Starting campaign audio playout for call {call_sid}, campaign {campaign_id}")

    # Look up the audio file path from the database
    audio_path = None
    try:
        from database import SessionLocal
        from models.campaign import Campaign
        from models.notice import Notice
        from sqlalchemy.future import select

        async with SessionLocal() as db:
            campaign_result = await db.execute(
                select(Campaign).filter(Campaign.id == campaign_id)
            )
            campaign = campaign_result.scalars().first()
            if not campaign:
                logger.error(f"Campaign {campaign_id} not found in DB")
                return

            notice_result = await db.execute(
                select(Notice).filter(Notice.id == campaign.notice_id)
            )
            notice = notice_result.scalars().first()
            if not notice or not notice.audio_url:
                logger.error(f"Notice or audio_url not found for campaign {campaign_id}")
                return

            audio_url = notice.audio_url
            # Convert URL path like /uploads/audio/xxx/yyy.wav to local filesystem path
            if audio_url.startswith("/"):
                audio_path = audio_url.lstrip("/")
            else:
                audio_path = audio_url

    except Exception as e:
        logger.error(f"Failed to look up campaign audio: {e}", exc_info=True)
        return

    if not audio_path or not os.path.exists(audio_path):
        logger.error(f"Audio file not found at path: {audio_path}")
        return

    # Read the WAV file
    try:
        with wave.open(audio_path, "rb") as wf:
            n_channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            framerate = wf.getframerate()
            n_frames = wf.getnframes()
            pcm_data = wf.readframes(n_frames)

        logger.info(
            f"Loaded WAV: {n_channels}ch, {sample_width}B, {framerate}Hz, "
            f"{n_frames} frames, {len(pcm_data)} bytes, "
            f"duration={n_frames / framerate:.2f}s"
        )

        # The TTS service already generates 8kHz mono 16-bit PCM WAVs,
        # so no resampling should be needed. Log a warning if format differs.
        if framerate != 8000 or n_channels != 1 or sample_width != 2:
            logger.warning(
                f"Audio format mismatch! Expected 8000Hz/mono/16bit, "
                f"got {framerate}Hz/{n_channels}ch/{sample_width * 8}bit. "
                f"Streaming as-is — Exotel may not play correctly."
            )
    except Exception as e:
        logger.error(f"Failed to read WAV file {audio_path}: {e}", exc_info=True)
        return

    # Stream PCM data in 20ms chunks (160 samples * 2 bytes = 320 bytes at 8kHz)
    chunk_size = 320  # 20ms of 8kHz mono 16-bit PCM
    total_chunks = (len(pcm_data) + chunk_size - 1) // chunk_size
    logger.info(f"Streaming {total_chunks} chunks (20ms each) to Exotel...")

    try:
        for i in range(total_chunks):
            start = i * chunk_size
            end = min(start + chunk_size, len(pcm_data))
            chunk = pcm_data[start:end]

            # Pad last chunk if needed
            if len(chunk) < chunk_size:
                chunk = chunk + b'\x00' * (chunk_size - len(chunk))

            payload = base64.b64encode(chunk).decode("utf-8")
            msg = {
                "event": "media",
                "streamSid": stream_sid,
                "stream_sid": stream_sid,
                "media": {"payload": payload}
            }
            await websocket.send_text(json.dumps(msg))

            # Pace at real-time (20ms per chunk)
            await asyncio.sleep(0.02)

        # Send a brief silence tail (500ms) to ensure Exotel flushes audio buffers
        silence_chunk = base64.b64encode(b'\x00' * chunk_size).decode("utf-8")
        for _ in range(25):  # 25 * 20ms = 500ms
            msg = {
                "event": "media",
                "streamSid": stream_sid,
                "stream_sid": stream_sid,
                "media": {"payload": silence_chunk}
            }
            await websocket.send_text(json.dumps(msg))
            await asyncio.sleep(0.02)

        logger.info(f"Campaign audio playout complete for call {call_sid}")

    except WebSocketDisconnect:
        logger.info(f"Exotel disconnected during campaign playout for {call_sid}")
    except Exception as e:
        logger.error(f"Error during campaign playout: {e}", exc_info=True)


# ───────────────── Main WebSocket Handler ─────────────────

async def handle_exotel_stream(websocket: WebSocket, call_sid: str, caller_phone: str):
    await websocket.accept()
    accept_time = asyncio.get_event_loop().time()
    logger.info(f"Accepted Exotel WebSocket connection for call: {call_sid}")

    # Track the last time audio was sent to Exotel to maintain comfort noise and connection state
    state = {
        "last_sent_time": asyncio.get_event_loop().time(),
        "agent_audio_received": False
    }

    # Wait for the first message (connected or start)
    try:
        data = await websocket.receive_text()
        msg = json.loads(data)
        event = msg.get("event")
        if event == "connected":
            logger.info("Exotel WebSocket connected event received.")
    except Exception as e:
        logger.error(f"Failed to receive initial message: {e}")
        await websocket.close()
        return

    # Read until we get the start event to ensure Exotel is ready to stream
    stream_sid = "unknown"
    while True:
        try:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("event") == "start":
                logger.info(f"Full Exotel start message: {msg}")
                stream_sid = msg.get("stream_sid", "unknown")
                custom_params = msg.get("start", {}).get("customParameters", {})
                
                if custom_params and "call_sid" in custom_params:
                    call_sid = custom_params.get("call_sid")
                    caller_phone = custom_params.get("caller_phone", "unknown")
                
                logger.info(f"Exotel stream started: {stream_sid}, Final CallSid: {call_sid}")
                break
            elif msg.get("event") == "media":
                break
        except Exception as e:
            logger.error(f"Error waiting for start event: {e}")
            break

    # ── Check if this is a campaign call ──
    session = _get_session(call_sid)
    campaign_id = session.get("campaign_id") if session else None

    if campaign_id:
        # ── Campaign playout mode ──
        logger.info(f"WebSocket bridge entering CAMPAIGN PLAYOUT mode for call {call_sid}")
        try:
            await _handle_campaign_playout(websocket, call_sid, campaign_id, stream_sid)
        finally:
            _delete_session(call_sid)
            try:
                await websocket.close()
            except Exception:
                pass
        return

    # ── Regular interactive agent mode below ──
    lk_url = os.environ.get("LIVEKIT_URL")
    lk_key = os.environ.get("LIVEKIT_API_KEY")
    lk_secret = os.environ.get("LIVEKIT_API_SECRET")

    room = rtc.Room()
    audio_source = rtc.AudioSource(SAMPLE_RATE, CHANNELS)
    local_audio_track = rtc.LocalAudioTrack.create_audio_track("exotel_mic", audio_source)
    
    audio_stream = None
    stream_task = None
    
    @room.on("track_subscribed")
    def on_track_subscribed(track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        nonlocal audio_stream, stream_task, stream_sid
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info(f"Subscribed to AI Agent's audio track in room {call_sid}")
            audio_stream = rtc.AudioStream(track)
            stream_task = asyncio.create_task(send_livekit_audio_to_exotel(audio_stream, websocket, stream_sid, state))

    # State flags
    is_connected = False
    received_first_media = False

    # Background task to connect to LiveKit and dispatch agent
    async def connect_livekit():
        nonlocal is_connected
        token = api.AccessToken(lk_key, lk_secret) \
            .with_identity(caller_phone) \
            .with_name(caller_phone) \
            .with_grants(api.VideoGrants(
                room_join=True,
                room=call_sid,
            )).to_jwt()

        try:
            # Dispatch agent and connect bridge to LiveKit room concurrently
            async def dispatch_agent():
                try:
                    from livekit.protocol.agent_dispatch import CreateAgentDispatchRequest
                    lkapi = _get_livekit_api()
                    req = CreateAgentDispatchRequest(agent_name="school-voice-agent", room=call_sid)
                    await lkapi.agent_dispatch.create_dispatch(req)
                    logger.info(f"Successfully dispatched agent to room {call_sid}")
                except Exception as e:
                    logger.error(f"Failed to dispatch agent: {e}")

            logger.info("Connecting bridge and dispatching agent concurrently...")
            await asyncio.gather(
                dispatch_agent(),
                room.connect(lk_url, token)
            )
            logger.info(f"Bridge connected to LiveKit room: {call_sid}")
            
            options = rtc.TrackPublishOptions()
            options.source = rtc.TrackSource.SOURCE_MICROPHONE
            await room.local_participant.publish_track(local_audio_track, options)
            logger.info(f"Published Exotel audio stream to LiveKit room: {call_sid}")
                
            is_connected = True
        except Exception as e:
            logger.error(f"Failed to connect to LiveKit or dispatch agent: {e}")
            await websocket.close()

    lk_task = asyncio.create_task(connect_livekit())

    # Send ringing/silence packets to keep the media stream alive and cover startup delay
    async def send_silence_loop():
        # Pre-generate 100ms of a 400Hz tone at 8000Hz sample rate (800 samples * 2 bytes = 1600 bytes)
        amplitude = 4000  # Soft telephone volume
        tone_data = bytearray()
        for n in range(800):
            val = int(amplitude * math.sin(2 * math.pi * 400 * n / 8000))
            tone_data.extend(val.to_bytes(2, byteorder='little', signed=True))
        tone_payload = base64.b64encode(tone_data).decode("utf-8")
        
        silence_payload = base64.b64encode(b'\x00' * 1600).decode("utf-8")
        
        logger.info("Starting silent/waiting audio stream loop to prevent call drop...")
        chunk_count = 0
        while True:
            try:
                await asyncio.sleep(0.05)  # Check every 50ms
                now = asyncio.get_event_loop().time()
                if now - state["last_sent_time"] >= 0.1:  # If no audio sent for 100ms
                    if stream_sid != "unknown":
                        if not state.get("agent_audio_received", False):
                            # Play ringback tone: 1s on (10 chunks), 2s off (20 chunks)
                            if chunk_count < 10:
                                await _send_frame_payload(tone_payload, websocket, stream_sid, state)
                            else:
                                await _send_frame_payload(silence_payload, websocket, stream_sid, state)
                            chunk_count = (chunk_count + 1) % 30
                        else:
                            # Standard comfort noise/silence after agent starts
                            await _send_frame_payload(silence_payload, websocket, stream_sid, state)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in send_silence_loop: {e}")
                break
        logger.info("Stopped silent/waiting audio stream loop.")

    silence_task = asyncio.create_task(send_silence_loop())

    # Now listen for media
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            event = msg.get("event")
            if event == "media":
                if not received_first_media:
                    logger.info("Received first media packet from Exotel.")
                    received_first_media = True
                    
                payload = msg.get("media", {}).get("payload")
                if payload and is_connected:
                    pcm_bytes = base64.b64decode(payload)
                    samples_per_channel = len(pcm_bytes) // 2 
                    frame = rtc.AudioFrame(
                        data=pcm_bytes,
                        sample_rate=SAMPLE_RATE,
                        num_channels=CHANNELS,
                        samples_per_channel=samples_per_channel
                    )
                    await audio_source.capture_frame(frame)
            elif event == "stop":
                logger.info(f"Exotel WebSocket stream stopped.")
                break
    except WebSocketDisconnect:
        logger.info(f"Exotel WebSocket disconnected for {call_sid}")
    except Exception as e:
        logger.error(f"Error handling WebSocket message: {e}")
    finally:
        silence_task.cancel()
        lk_task.cancel()
        if stream_task:
            stream_task.cancel()
        await room.disconnect()

        # Clean up Redis session
        _delete_session(call_sid)

        # Database cleanup fail-safe
        try:
            from database import SessionLocal
            from models.call_log import CallLog
            from sqlalchemy.future import select
            
            # Calculate duration based on time elapsed since connection accepted
            connection_duration = int(asyncio.get_event_loop().time() - accept_time)
            
            async with SessionLocal() as db:
                # Find call log matching this CallSid
                stmt = select(CallLog).filter(CallLog.exotel_call_sid == call_sid)
                res = await db.execute(stmt)
                call_log = res.scalars().first()
                
                if call_log and call_log.status == "in_progress":
                    # Determine status: if we received media, it was answered, otherwise failed
                    final_status = "answered" if received_first_media else "failed"
                    call_log.status = final_status
                    call_log.duration_seconds = max(connection_duration, 0)
                    await db.commit()
                    logger.info(f"Database fail-safe cleanup: updated CallLog {call_log.id} to status={final_status}, duration={call_log.duration_seconds}s")
        except Exception as e:
            logger.error(f"Failed to perform database fail-safe cleanup for call {call_sid}: {e}")

async def send_livekit_audio_to_exotel(audio_stream: rtc.AudioStream, websocket: WebSocket, stream_sid: str, state: dict):
    resampler = None
    resampler_input_rate = None
    
    try:
        async for frame_event in audio_stream:
            state["agent_audio_received"] = True
            frame = frame_event.frame
            
            if frame.sample_rate != 8000:
                if resampler is None or resampler_input_rate != frame.sample_rate:
                    logger.info(f"Creating AudioResampler dynamically for input rate: {frame.sample_rate} -> 8000")
                    resampler = rtc.AudioResampler(
                        input_rate=frame.sample_rate, 
                        output_rate=8000,
                        quality=rtc.AudioResamplerQuality.MEDIUM
                    )
                    resampler_input_rate = frame.sample_rate
                frames = resampler.push(frame)
                for f in frames:
                    await _send_frame(f, websocket, stream_sid, state)
            else:
                await _send_frame(frame, websocket, stream_sid, state)
                
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.error(f"Error in send_livekit_audio_to_exotel: {e}")

async def _send_frame(frame: rtc.AudioFrame, websocket: WebSocket, stream_sid: str, state: dict):
    try:
        pcm_bytes = bytes(frame.data)
        encoded = base64.b64encode(pcm_bytes).decode("utf-8")
        await _send_frame_payload(encoded, websocket, stream_sid, state)
    except Exception as e:
        logger.error(f"Failed to send frame to Exotel: {type(e).__name__} - {str(e)}")

async def _send_frame_payload(payload: str, websocket: WebSocket, stream_sid: str, state: dict):
    msg = {
        "event": "media",
        "streamSid": stream_sid,
        "stream_sid": stream_sid,
        "media": {
            "payload": payload
        }
    }
    await websocket.send_text(json.dumps(msg))
    state["last_sent_time"] = asyncio.get_event_loop().time()

