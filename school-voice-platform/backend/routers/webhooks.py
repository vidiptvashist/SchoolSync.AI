from fastapi import APIRouter, Request, Response, status
from sqlalchemy.future import select
from sqlalchemy import update
from uuid import UUID
from typing import Optional
import logging

from database import SessionLocal
from models.call_log import CallLog
from models.campaign import Campaign
from models.notice import Notice

logger = logging.getLogger("webhooks_router")
router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

# --- Helper to map Exotel call status to our status schema ---
def map_exotel_status(status_str: str) -> str:
    """
    Maps Exotel's terminal Call status to our CallLog status schema:
    answered, missed, failed, busy.
    """
    if not status_str:
        return "failed"
        
    status_lower = status_str.lower()
    if status_lower == "completed":
        return "answered"
    elif status_lower == "no-answer":
        return "missed"
    elif status_lower == "busy":
        return "busy"
    else:
        # e.g. 'failed', 'canceled', etc.
        return "failed"

# --- Endpoints ---

@router.api_route("/exotel/play-audio", methods=["GET", "POST"])
@router.api_route("/exotel/play-audio/{campaign_id}", methods=["GET", "POST"])
async def play_audio_exoml(request: Request, campaign_id: Optional[str] = None):
    """
    ExoML Endpoint: Exotel queries this URL when the call connects.
    Returns ExoML instructing Exotel to play the WAV notice audio.
    Supports path parameter campaign_id, or fetching campaign_id from CustomField/campaign_id
    query or form parameters.
    """
    resolved_campaign_id = None

    # 1. Check path parameter
    if campaign_id:
        try:
            resolved_campaign_id = UUID(campaign_id)
        except ValueError:
            logger.error(f"Invalid UUID in path parameter: {campaign_id}")

    # 2. Check query parameters
    if not resolved_campaign_id:
        query_params = request.query_params
        for key in ["CustomField", "campaign_id", "campaignid", "customfield"]:
            val = query_params.get(key)
            if val:
                try:
                    resolved_campaign_id = UUID(val)
                    break
                except ValueError:
                    logger.error(f"Invalid UUID in query parameter {key}: {val}")

    # 3. Check form parameters (if POST)
    if not resolved_campaign_id and request.method == "POST":
        try:
            form_data = await request.form()
            for key in ["CustomField", "campaign_id", "campaignid", "customfield"]:
                val = form_data.get(key)
                if val:
                    try:
                        resolved_campaign_id = UUID(val)
                        break
                    except ValueError:
                        logger.error(f"Invalid UUID in form parameter {key}: {val}")
        except Exception as e:
            logger.debug(f"Could not parse form data in play_audio_exoml: {e}")

    if not resolved_campaign_id:
        logger.error("Campaign ID not found in path, query, or form parameters for play-audio.")
        return Response(
            content='<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>',
            media_type="text/xml"
        )

    async with SessionLocal() as db:
        # Fetch campaign
        campaign_result = await db.execute(
            select(Campaign).filter(Campaign.id == resolved_campaign_id)
        )
        campaign = campaign_result.scalars().first()
        if not campaign:
            logger.error(f"Campaign not found for ID: {resolved_campaign_id}")
            return Response(
                content='<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>',
                media_type="text/xml"
            )
            
        # Fetch notice
        notice_result = await db.execute(
            select(Notice).filter(Notice.id == campaign.notice_id)
        )
        notice = notice_result.scalars().first()
        if not notice or not notice.audio_url:
            logger.error(f"Notice or audio URL not found for Campaign ID: {resolved_campaign_id}")
            return Response(
                content='<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>',
                media_type="text/xml"
            )
            
        from settings import PUBLIC_URL
        public_url = PUBLIC_URL or "http://localhost:8000"
        audio_url = notice.audio_url
        if audio_url.startswith("/"):
            audio_url = f"{public_url}{audio_url}"
            
        # Exotel Greeting applet with dynamic URL expects text/plain response
        # containing EITHER text to speak OR an audio file URL.
        # We return the audio file URL.
        logger.info(f"Returning audio URL: {audio_url} (campaign {resolved_campaign_id})")
        return Response(content=audio_url, media_type="text/plain")



@router.post("/exotel/call-status", status_code=status.HTTP_200_OK)
async def handle_exotel_call_status(
    request: Request,
    campaign_id: Optional[UUID] = None,
    school_id: Optional[UUID] = None,
    phone_number: Optional[str] = None
):
    """
    Callback Webhook: Exotel calls this when a call completes / changes status.
    Updates the call_logs and increments the campaign.answered_calls count if successful.
    """
    # Parse form data from request body (Exotel sends data as application/x-www-form-urlencoded)
    form_data = await request.form()
    
    call_sid = form_data.get("CallSid")
    exotel_status = form_data.get("Status")
    duration_str = form_data.get("ConversationDuration")
    
    logger.info(f"Webhook received: CallSid={call_sid}, Status={exotel_status}, Duration={duration_str}")
    
    if not call_sid:
        logger.warning("CallSid missing from webhook parameters. Skipping update.")
        return {"message": "CallSid missing"}
        
    # Parse duration
    try:
        duration_seconds = int(duration_str) if duration_str else 0
    except ValueError:
        duration_seconds = 0
        
    mapped_status = map_exotel_status(exotel_status)
    
    # Resolve IDs robustly
    resolved_campaign_id = campaign_id
    if not resolved_campaign_id:
        custom_field = form_data.get("CustomField")
        if custom_field:
            try:
                resolved_campaign_id = UUID(custom_field)
            except ValueError:
                pass
                
    resolved_school_id = school_id
    resolved_phone = phone_number or form_data.get("From") or form_data.get("To")
    
    # Use isolated database session to perform updates
    async with SessionLocal() as db:
        # 1. Search for existing CallLog matching the CallSid
        result = await db.execute(
            select(CallLog).filter(CallLog.exotel_call_sid == call_sid)
        )
        existing_log = result.scalars().first()
        
        is_newly_answered = False
        
        if existing_log:
            # Check if this is transitioning from dial/unanswered to answered
            if existing_log.status != "answered" and mapped_status == "answered":
                is_newly_answered = True
                
            existing_log.status = mapped_status
            existing_log.duration_seconds = duration_seconds
            
            resolved_campaign_id = resolved_campaign_id or existing_log.campaign_id
            logger.info(f"Updated existing CallLog {existing_log.id} to status {mapped_status}")
        else:
            # If log is missing, try to resolve school_id
            if resolved_campaign_id and not resolved_school_id:
                campaign_res = await db.execute(
                    select(Campaign).filter(Campaign.id == resolved_campaign_id)
                )
                camp = campaign_res.scalars().first()
                if camp:
                    resolved_school_id = camp.school_id
            
            if resolved_campaign_id and resolved_school_id:
                # Create a new CallLog entry if none existed (e.g. if pre-save call failed/was delayed)
                new_log = CallLog(
                    school_id=resolved_school_id,
                    campaign_id=resolved_campaign_id,
                    caller_phone=resolved_phone or "unknown",
                    direction="outbound",
                    status=mapped_status,
                    exotel_call_sid=call_sid,
                    duration_seconds=duration_seconds
                )
                db.add(new_log)
                if mapped_status == "answered":
                    is_newly_answered = True
                logger.info(f"Created new CallLog for CallSid {call_sid} with status {mapped_status}")
            else:
                logger.warning(
                    f"Unable to create CallLog for CallSid {call_sid} - "
                    f"missing campaign_id ({resolved_campaign_id}) or school_id ({resolved_school_id})"
                )
            
        await db.commit()
        
        # 2. Update campaign counter if call was successfully answered
        if is_newly_answered and resolved_campaign_id:
            await db.execute(
                update(Campaign)
                .where(Campaign.id == resolved_campaign_id)
                .values(answered_calls=Campaign.answered_calls + 1)
            )
            await db.commit()
            logger.info(f"Incremented answered_calls for campaign {resolved_campaign_id}")
            
    return {"message": "status updated successfully"}
