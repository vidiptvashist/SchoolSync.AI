import httpx
import urllib.parse
import logging
from sqlalchemy import update
from settings import (
    EXOTEL_ACCOUNT_SID,
    EXOTEL_API_KEY,
    EXOTEL_API_TOKEN,
    EXOTEL_CALLER_ID,
    PUBLIC_URL,
    EXOTEL_APP_ID
)
from database import SessionLocal
from models.call_log import CallLog
from models.campaign import Campaign

logger = logging.getLogger("exotel_service")

class ExotelService:
    def __init__(self):
        self.account_sid = EXOTEL_ACCOUNT_SID
        self.api_key = EXOTEL_API_KEY
        self.api_token = EXOTEL_API_TOKEN
        self.caller_id = EXOTEL_CALLER_ID
        self.public_url = PUBLIC_URL or "http://localhost:8000"
        
    async def launch_bulk_campaign(self, phone_numbers: list[str], audio_url: str, campaign_id: str, school_id: str):
        """
        Runs asynchronously as a background task.
        Loops through target phone numbers, launches Exotel calls, and logs initial call statuses.
        """
        logger.info(f"Launching bulk campaign {campaign_id} for {len(phone_numbers)} numbers.")
        
        # 1. Ensure we have the full public URL for the audio notice file
        full_audio_url = audio_url
        if audio_url.startswith("/"):
            full_audio_url = f"{self.public_url}{audio_url}"
            
        # 2. Prepare Exotel API configurations
        exotel_url = f"https://api.exotel.com/v1/Accounts/{self.account_sid}/Calls/connect.json"
        auth = (self.api_key, self.api_token)
        
        # Exotel v1 Connect API only works with internal flow URLs.
        # Direct custom HTTP URLs are silently ignored (call connects then hangs up).
        # We must route through an Exotel flow that has a Greeting applet configured
        # with our dynamic URL.
        exotel_url_param = f"http://my.exotel.com/{self.account_sid}/exoml/start_voice/{EXOTEL_APP_ID}"
        logger.info(f"Using Exotel Flow {EXOTEL_APP_ID}, Url={exotel_url_param}")
            
        # Status callback URL for Exotel call events
        status_callback_base = f"{self.public_url}/webhooks/exotel/call-status?campaign_id={campaign_id}&school_id={school_id}"
        
        # Update Campaign status to 'running'
        async with SessionLocal() as db:
            await db.execute(
                update(Campaign)
                .where(Campaign.id == campaign_id)
                .values(status="running", total_calls=len(phone_numbers))
            )
            await db.commit()
            
        success_count = 0
        
        # 3. Dispatch calls to each phone number
        async with httpx.AsyncClient() as client:
            for phone in phone_numbers:
                payload = {
                    "From": phone,
                    "CallerId": self.caller_id,
                    "CallType": "trans",
                    "Url": exotel_url_param,
                    "StatusCallback": f"{status_callback_base}&phone_number={phone}",
                    "CustomField": str(campaign_id)
                }
                
                exotel_call_sid = None
                call_status = "failed"
                
                try:
                    response = await client.post(exotel_url, data=payload, auth=auth, timeout=10.0)
                    
                    if response.status_code == 200:
                        res_data = response.json()
                        exotel_call_sid = res_data.get("Call", {}).get("Sid")
                        call_status = "dialing" # Initial state while connecting
                        success_count += 1
                        logger.info(f"Successfully triggered Exotel call for {phone}. SID: {exotel_call_sid}")
                    else:
                        logger.error(f"Exotel returned non-200 for {phone}: {response.status_code} - {response.text}")
                except Exception as e:
                    logger.error(f"Failed to connect to Exotel API for {phone}: {e}")
                    
                # 4. Log the initial call state in database
                async with SessionLocal() as db:
                    new_log = CallLog(
                        school_id=school_id,
                        campaign_id=campaign_id,
                        caller_phone=phone,
                        direction="outbound",
                        status=call_status,
                        exotel_call_sid=exotel_call_sid,
                        duration_seconds=0
                    )
                    db.add(new_log)
                    await db.commit()
                    
        # Update Campaign status to 'completed' (or 'failed' if all calls failed)
        final_status = "completed" if success_count > 0 or len(phone_numbers) == 0 else "failed"
        async with SessionLocal() as db:
            await db.execute(
                update(Campaign)
                .where(Campaign.id == campaign_id)
                .values(status=final_status)
            )
            await db.commit()
            
        logger.info(f"Finished bulk campaign {campaign_id}. Success: {success_count}/{len(phone_numbers)}")
