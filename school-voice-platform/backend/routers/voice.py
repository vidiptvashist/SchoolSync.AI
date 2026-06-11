"""
Voice Router — Handles inbound call webhooks from Exotel.

POST /voice/inbound   → Called when a parent dials the school's Exotel number
POST /voice/call-ended → Called when the call disconnects
"""

import json
import logging
import uuid
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Request, Response, BackgroundTasks, Depends, WebSocket
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import SessionLocal, get_db
from models.call_log import CallLog
from models.school import School
from services.websocket_bridge import handle_exotel_stream
from models.student import Student
from models.user import User
from core.dependencies import get_current_user
from settings import (
    LIVEKIT_URL,
    LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET,
    GEMINI_API_KEY,
    REDIS_URL,
)

logger = logging.getLogger("voice_router")
router = APIRouter(prefix="/voice", tags=["Voice"])
CALL_SESSION_PREFIX = "call"
LEGACY_CALL_SESSION_PREFIX = "voice_call"


# ───────────────── Redis helpers ─────────────────

def _get_redis():
    import redis
    return redis.from_url(REDIS_URL, decode_responses=True)


def _session_keys(call_sid: str) -> list[str]:
    return [
        f"{CALL_SESSION_PREFIX}:{call_sid}",
        f"{LEGACY_CALL_SESSION_PREFIX}:{call_sid}",
    ]


def _store_session(call_sid: str, data: dict) -> None:
    """Save call session to Redis with 1-hour TTL."""
    try:
        r = _get_redis()
        payload = json.dumps(data)
        for key in _session_keys(call_sid):
            r.setex(key, 3600, payload)
        logger.info(f"Stored Redis session for call {call_sid}")
    except Exception as e:
        logger.error(f"Redis store failed: {e}")


def _get_session(call_sid: str) -> Optional[dict]:
    """Retrieve call session from Redis."""
    try:
        r = _get_redis()
        for key in _session_keys(call_sid):
            raw = r.get(key)
            if raw:
                return json.loads(raw)
        return None
    except Exception as e:
        logger.error(f"Redis get failed: {e}")
        return None


def _delete_session(call_sid: str) -> None:
    """Delete call session from Redis."""
    try:
        r = _get_redis()
        r.delete(*_session_keys(call_sid))
        logger.info(f"Deleted Redis session for call {call_sid}")
    except Exception as e:
        logger.error(f"Redis delete failed: {e}")


def _parse_started_at(started_at_str: Optional[str]) -> Optional[datetime]:
    if not started_at_str:
        return None
    try:
        normalized = started_at_str.replace("Z", "+00:00")
        started_at = datetime.fromisoformat(normalized)
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        return started_at.astimezone(timezone.utc)
    except Exception:
        return None


# ───────────────── LiveKit helpers ─────────────────

async def _create_livekit_room_and_dispatch(call_sid: str, metadata: dict) -> None:
    """
    Background task:
    1. Create a LiveKit room named after the CallSid.
    2. Dispatch an agent worker to join that room.
    """
    from livekit.api import LiveKitAPI, CreateAgentDispatchRequest
    from livekit.api.room_service import CreateRoomRequest

    metadata_json = json.dumps(metadata)

    try:
        lk = LiveKitAPI(
            url=LIVEKIT_URL,
            api_key=LIVEKIT_API_KEY,
            api_secret=LIVEKIT_API_SECRET,
        )

        # 1. Create the room
        room = await lk.room.create_room(
            CreateRoomRequest(
                name=call_sid,
                metadata=metadata_json,
                empty_timeout=300,       # 5 min auto-close if empty
                max_participants=2,      # agent + caller
            )
        )
        logger.info(f"LiveKit room created: {room.name} (sid={room.sid})")

        # 2. Dispatch an agent to this room
        dispatch = await lk.agent_dispatch.create_dispatch(
            CreateAgentDispatchRequest(
                agent_name="school-voice-agent",
                room=call_sid,
                metadata=metadata_json,
            )
        )
        logger.info(f"Agent dispatched to room {call_sid}: {dispatch}")

        await lk.aclose()

    except Exception as e:
        logger.error(f"LiveKit room/dispatch failed for {call_sid}: {e}", exc_info=True)


# ───────────────── Gemini summary helper ─────────────────

async def _generate_call_summary(call_sid: str) -> Optional[str]:
    """
    Use Gemini Flash to generate a one-line call summary from the Redis session.
    Returns something like: "Parent called and asked about attendance for Rahul"
    """
    try:
        import google.generativeai as genai

        session_data = _get_session(call_sid)
        if not session_data:
            return None

        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.5-flash")

        prompt = f"""You are summarizing a phone call to a school.
Based on this session data, generate a ONE sentence summary of what likely happened.
If there's a student name, include it. Keep it under 20 words.

Session data: {json.dumps(session_data)}

Examples:
- "Parent called and asked about attendance for Rahul in Class 5A"
- "Parent inquired about fee payment status"
- "Unidentified caller asked about admission process"

Summary:"""

        response = model.generate_content(prompt)
        summary = response.text.strip().strip('"')
        return summary

    except Exception as e:
        logger.error(f"Gemini summary generation failed: {e}")
        return "Call completed (summary generation failed)"


# ───────────────── Endpoints ─────────────────


@router.api_route("/inbound", methods=["GET", "POST"])
async def handle_inbound_call(request: Request, background_tasks: BackgroundTasks):
    """
    Called by Exotel when a parent calls the school's number.

    Exotel sends (as form-data or query params):
        CallSid, From, To, Direction, CallType, CurrentTime

    This endpoint:
        1. Looks up the school by Exotel number
        2. Checks if the parent phone is in the students table
        3. Creates a LiveKit room and dispatches an agent
        4. Saves session to Redis and creates a call_log
        5. Returns ExoML XML to connect the call via passthru applet
    """
    # ── Parse Exotel parameters ──
    params = dict(request.query_params)
    if request.method == "POST":
        form = await request.form()
        params.update(dict(form))

    call_sid = params.get("CallSid", f"call-{uuid.uuid4().hex[:12]}")
    caller_phone = params.get("From", "unknown")
    school_phone = params.get("To", "unknown")
    direction = params.get("Direction", "incoming")
    custom_field = params.get("CustomField", "")

    logger.info(
        f"Inbound call: CallSid={call_sid}, From={caller_phone}, "
        f"To={school_phone}, Direction={direction}, CustomField={custom_field}"
    )

    # ── Campaign detection ──
    # When exotel_service.launch_bulk_campaign triggers a call, it sets
    # CustomField=campaign_id.  The same Exotel Flow routes back here,
    # so we detect it and short-circuit into a "play notice audio" path
    # instead of the interactive AI agent flow.
    campaign_id = None
    if custom_field:
        try:
            uuid.UUID(custom_field)  # validate
            campaign_id = custom_field
        except ValueError:
            pass

    if campaign_id:
        logger.info(f"Detected CAMPAIGN call (campaign_id={campaign_id}). "
                     f"Skipping interactive agent, will play notice audio.")
        # Store a minimal session so websocket_bridge can look up the campaign
        session_data = {
            "campaign_id": campaign_id,
            "caller_phone": caller_phone,
            "direction": "outbound",
            "started_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        _store_session(call_sid, session_data)

        # Return WebSocket URL — the bridge will handle audio playout
        public_url_ws = os.environ.get("PUBLIC_URL", "").strip().replace("https://", "wss://").replace("http://", "ws://")
        wss_url = f"{public_url_ws}/voice/stream/{call_sid}/{caller_phone}"
        logger.info(f"Returning campaign WSS URL for call {call_sid}: {wss_url}")
        from fastapi.responses import JSONResponse
        return JSONResponse(content={"url": wss_url})

    # ── Regular inbound call flow below ──

    # ── 1. Look up school by Exotel number ──
    school = None
    school_id = None
    school_name = "Unknown School"

    async with SessionLocal() as db:
        # Normalize phone: strip leading +91 / 0 for matching
        normalized = caller_phone.lstrip("+").lstrip("91").lstrip("0")
        school_normalized = school_phone.lstrip("+").lstrip("91").lstrip("0")

        result = await db.execute(select(School))
        all_schools = result.scalars().all()

        for s in all_schools:
            if s.exotel_number:
                s_num = s.exotel_number.lstrip("+").lstrip("91").lstrip("0")
                if s_num == school_normalized or s.exotel_number == school_phone:
                    school = s
                    break

        # Fallback: use the first school
        if not school and all_schools:
            school = all_schools[0]
            logger.warning(
                f"No school matched Exotel number {school_phone}, "
                f"falling back to {school.name}"
            )

        if school:
            school_id = str(school.id)
            school_name = school.name

        # ── 2. Check if parent phone exists in students ──
        authenticated = False
        student_id = None
        student_name = None
        parent_name = None
        class_name = None

        if school:
            student_result = await db.execute(
                select(Student).filter(Student.school_id == school.id)
            )
            students = student_result.scalars().all()

            for st in students:
                st_phone = st.parent_phone.lstrip("+").lstrip("91").lstrip("0")
                if st_phone == normalized or st.parent_phone == caller_phone:
                    authenticated = True
                    student_id = str(st.id)
                    student_name = st.name
                    parent_name = st.parent_name
                    c_name = st.class_name
                    sec = st.section
                    class_name = f"{c_name}-{sec}" if (c_name and sec) else (c_name or "N/A")
                    logger.info(
                        f"Auto-authenticated: parent of {st.name} "
                        f"(phone={caller_phone})"
                    )
                    break

        # ── 3. Save session to Redis ──
        session_data = {
            "school_id": school_id,
            "school_name": school_name,
            "caller_phone": caller_phone,
            "parent_name": parent_name if parent_name else "Unknown Parent",
            "class_name": class_name if class_name else "N/A",
            "authenticated": authenticated,
            "student_id": student_id,
            "student_name": student_name if student_name else "N/A",
            "direction": "inbound",
            "started_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        _store_session(call_sid, session_data)

        # ── 4. Create call_log entry ──
        call_log = CallLog(
            school_id=school.id if school else uuid.uuid4(),
            caller_phone=caller_phone,
            direction="inbound",
            status="in_progress",
            exotel_call_sid=call_sid,
        )
        db.add(call_log)
        await db.commit()
        logger.info(f"CallLog created: {call_log.id} for call {call_sid}")

    # ── 5. Setup LiveKit SIP routing ──
    host_part = LIVEKIT_URL.replace("wss://", "").replace("ws://", "").strip("/")
    if host_part.endswith(".livekit.cloud"):
        sip_host = host_part.replace(".livekit.cloud", ".sip.livekit.cloud")
    else:
        sip_host = f"{host_part}.sip.livekit.cloud"
    sip_uri = f"sip:{call_sid}@{sip_host}"

    # ── 6. Return JSON response for Exotel Voicebot Applet ──
    # Exotel Dynamic URL in Voicebot Applet expects a JSON response with 'url'
    
    # Get the public URL of our FastAPI backend
    public_url_ws = os.environ.get("PUBLIC_URL", "").strip().replace("https://", "wss://").replace("http://", "ws://")
    # Exotel might strip query params, so put them in the path!
    wss_url = f"{public_url_ws}/voice/stream/{call_sid}/{caller_phone}"
    
    response_data = {
        "url": wss_url
    }

    logger.info(f"Returning Dynamic Voicebot WSS URL for call {call_sid}: {wss_url}")

    from fastapi.responses import JSONResponse
    return JSONResponse(content=response_data)


@router.post("/call-ended")
async def handle_call_ended(request: Request):
    """
    Called by Exotel when the call ends.

    Updates the call_log with final status, duration, and AI-generated summary.
    Cleans up the Redis session.

    Exotel sends:
        CallSid, Status, ConversationDuration, Direction, From, To
    """
    # ── Parse parameters ──
    params = dict(request.query_params)
    try:
        form = await request.form()
        params.update(dict(form))
    except Exception:
        pass

    call_sid = params.get("CallSid")
    exotel_status = params.get("Status", "completed")
    duration_str = params.get("ConversationDuration", "0")

    if not call_sid:
        logger.warning("call-ended webhook missing CallSid")
        return {"message": "CallSid missing"}

    logger.info(
        f"Call ended: CallSid={call_sid}, Status={exotel_status}, "
        f"Duration={duration_str}"
    )

    # Parse duration
    try:
        duration_seconds = int(duration_str)
    except (ValueError, TypeError):
        duration_seconds = 0

    # Map Exotel status
    status_map = {
        "completed": "answered",
        "no-answer": "missed",
        "busy": "busy",
        "failed": "failed",
        "canceled": "failed",
    }
    mapped_status = status_map.get(exotel_status.lower(), "answered")

    # ── Generate summary with Gemini ──
    summary = await _generate_call_summary(call_sid)

    # ── Update call_log in database ──
    async with SessionLocal() as db:
        result = await db.execute(
            select(CallLog).filter(CallLog.exotel_call_sid == call_sid)
        )
        call_log = result.scalars().first()

        if call_log:
            call_log.status = mapped_status
            call_log.duration_seconds = duration_seconds
            if summary:
                call_log.summary = summary
            await db.commit()
            logger.info(
                f"CallLog {call_log.id} updated: status={mapped_status}, "
                f"duration={duration_seconds}s, summary={summary}"
            )
        else:
            logger.warning(f"No CallLog found for CallSid {call_sid}")

    # ── Clean up Redis session ──
    _delete_session(call_sid)

    return {
        "message": "call ended processed",
        "call_sid": call_sid,
        "status": mapped_status,
        "duration": duration_seconds,
        "summary": summary,
    }


@router.get("/calls/live")
async def get_live_calls(current_user: User = Depends(get_current_user)):
    """
    Query Redis for all keys matching 'call:*'.
    Filter by current_user.school_id.
    Return list of active calls.
    """
    school_id_str = str(current_user.school_id)
    active_by_sid = {}

    try:
        r = _get_redis()
        keys = []
        for pattern in (f"{CALL_SESSION_PREFIX}:*", f"{LEGACY_CALL_SESSION_PREFIX}:*"):
            keys.extend(r.keys(pattern))
    except Exception as e:
        logger.error(f"Redis live call query failed: {e}")
        return []

    for key in keys:
        try:
            raw = r.get(key)
            if not raw:
                continue

            data = json.loads(raw)
            if str(data.get("school_id")) != school_id_str:
                continue

            call_sid = key.split(":", 1)[1] if ":" in key else key
            started_at_str = data.get("started_at")
            started_at = _parse_started_at(started_at_str)
            duration_seconds = 0
            if started_at:
                duration_seconds = int(
                    (datetime.now(timezone.utc) - started_at).total_seconds()
                )
                duration_seconds = max(duration_seconds, 0)

            active_by_sid[call_sid] = {
                "call_sid": call_sid,
                "caller_phone": data.get("caller_phone", data.get("caller", "unknown")),
                "parent_name": data.get("parent_name", "Unknown Parent"),
                "student_name": data.get("student_name", "N/A"),
                "class_name": data.get("class_name", "N/A"),
                "authenticated": bool(data.get("authenticated", False)),
                "current_topic": data.get("current_topic") or data.get("intent") or "unknown",
                "started_at": started_at_str,
                "duration_seconds": duration_seconds,
            }
        except Exception as e:
            logger.error(f"Error parsing live call from Redis for key {key}: {e}")

    active_calls = sorted(
        active_by_sid.values(),
        key=lambda call: call.get("started_at") or "",
        reverse=True,
    )
    return active_calls


@router.get("/calls/recent")
async def get_recent_calls(
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db),
    limit: int = 20,
    skip: int = 0
):
    """
    Query call_logs table: WHERE school_id = ? ORDER BY created_at DESC LIMIT 20
    Returns completed calls with parent_name, student_name, etc.
    """
    limit = min(max(limit, 1), 100)
    skip = max(skip, 0)

    stmt = (
        select(CallLog)
        .filter(CallLog.school_id == current_user.school_id, CallLog.status != "in_progress")
        .order_by(CallLog.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    logs = result.scalars().all()
    
    student_stmt = select(Student).filter(Student.school_id == current_user.school_id)
    student_res = await db.execute(student_stmt)
    students = student_res.scalars().all()
    
    def clean_p(ph):
        return ph.lstrip("+").lstrip("91").lstrip("0") if ph else ""
        
    phone_map = {}
    for st in students:
        cleaned = clean_p(st.parent_phone)
        if cleaned:
            phone_map[cleaned] = st
            
    recent_calls = []
    for log in logs:
        cleaned_caller = clean_p(log.caller_phone)
        student = phone_map.get(cleaned_caller)
        
        recent_calls.append({
            "id": str(log.id),
            "caller_phone": log.caller_phone,
            "parent_name": student.parent_name if student else "Unknown Parent",
            "student_name": student.name if student else "N/A",
            "direction": log.direction,
            "status": log.status,
            "duration_seconds": log.duration_seconds,
            "intent": log.intent or "unknown",
            "summary": log.summary or "No summary available",
            "created_at": log.created_at.isoformat() if log.created_at else None
        })
        
    return recent_calls

@router.websocket("/stream/{call_sid}/{caller_phone}")
async def websocket_endpoint(websocket: WebSocket, call_sid: str, caller_phone: str):
    """
    WebSocket endpoint for Exotel Voicebot Applet.
    This bridges the raw Exotel WebSocket media stream to LiveKit WebRTC.
    """
    await handle_exotel_stream(websocket, call_sid, caller_phone)
