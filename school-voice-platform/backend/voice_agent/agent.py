"""
LiveKit Voice Agent for School Inbound Calling System.

Runs as a standalone worker process that connects to LiveKit Cloud.
Uses:
  - Deepgram STT (Speech-to-Text)
  - Silero VAD (Voice Activity Detection)
  - Google Gemini Flash (LLM)
  - Custom Sarvam AI TTS (Text-to-Speech)

Start with:
  python voice_agent/agent.py dev
"""

from __future__ import annotations

import json
import logging
import os
import sys
import re
import random

# Ensure the voice_agent directory is on sys.path for local imports
sys.path.insert(0, os.path.dirname(__file__))

# Also add backend root for settings if needed
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from typing import Annotated
from pydantic import Field
import psycopg2
import redis as redis_lib

import asyncio
import google.generativeai as genai

from livekit.agents import (
    Agent,
    AgentSession,
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    llm,
    StopResponse,
    tts,
)
from livekit.plugins import deepgram, google, silero

from sarvam_tts import SarvamTTS

logger = logging.getLogger("voice_agent")
logger.setLevel(logging.INFO)

# ─────────────────────────── Config ───────────────────────────

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
DATABASE_URL = os.getenv("DATABASE_URL", "")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")

# ─────────────────────────── DB Helpers ───────────────────────


def get_school_info(school_id: str) -> dict | None:
    """
    Fetch school name and details from PostgreSQL (synchronous).
    Returns dict with 'name', 'phone', or None if not found.
    """
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, phone FROM schools WHERE id = %s",
            (school_id,),
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row:
            return {"id": str(row[0]), "name": row[1], "phone": row[2]}
        return None
    except Exception as e:
        logger.error(f"Failed to fetch school info for {school_id}: {e}")
        return None


def get_default_school() -> dict | None:
    """Fetch the first school from the database as a fallback."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("SELECT id, name, phone FROM schools ORDER BY created_at LIMIT 1")
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row:
            return {"id": str(row[0]), "name": row[1], "phone": row[2]}
        return None
    except Exception as e:
        logger.error(f"Failed to fetch default school: {e}")
        return None


def get_school_notices(school_id: str) -> list[str]:
    """Fetch active notice titles for context."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute(
            "SELECT title, message FROM notices WHERE school_id = %s "
            "ORDER BY created_at DESC LIMIT 5",
            (school_id,),
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [f"{r[0]}: {r[1]}" for r in rows]
    except Exception as e:
        logger.error(f"Failed to fetch notices for {school_id}: {e}")
        return []


# ─────────────────────────── Redis Helpers ────────────────────


def get_redis_client() -> redis_lib.Redis:
    return redis_lib.from_url(REDIS_URL, decode_responses=True)


def call_session_keys(call_id: str) -> list[str]:
    return [f"call:{call_id}", f"voice_call:{call_id}"]


def store_call_session(call_id: str, school_id: str, caller: str) -> None:
    """Store call session in Redis with 1-hour TTL."""
    try:
        r = get_redis_client()
        payload = json.dumps(
            {
                "school_id": school_id,
                "caller": caller,
                "status": "active",
            }
        )
        for key in call_session_keys(call_id):
            r.setex(key, 3600, payload)
        logger.info(f"Stored call session: {call_id}")
    except Exception as e:
        logger.error(f"Failed to store call session: {e}")


def cleanup_call_session(call_id: str) -> None:
    """Remove call session from Redis."""
    try:
        r = get_redis_client()
        r.delete(*call_session_keys(call_id))
        logger.info(f"Cleaned up call session: {call_id}")
    except Exception as e:
        logger.error(f"Failed to cleanup call session: {e}")


def get_redis_session(call_id: str) -> dict:
    """Retrieve call session dict from Redis."""
    try:
        r = get_redis_client()
        raw = None
        for key in call_session_keys(call_id):
            raw = r.get(key)
            if raw:
                break
        return json.loads(raw) if raw else {}
    except Exception as e:
        logger.error(f"Failed to fetch Redis session for {call_id}: {e}")
        return {}


# ─────────────────────────── Redis & DB Updates ────────────────
def update_redis_session(call_id: str, updates: dict) -> None:
    try:
        r = get_redis_client()
        raw = None
        for key in call_session_keys(call_id):
            raw = r.get(key)
            if raw:
                break
        data = json.loads(raw) if raw else {}
        data.update(updates)
        payload = json.dumps(data)
        for key in call_session_keys(call_id):
            r.setex(key, 3600, payload)
        logger.info(f"Updated Redis session for call {call_id} with updates {updates}")
    except Exception as e:
        logger.error(f"Failed to update Redis session: {e}")


async def save_call_intent(call_id: str, school_id: str, intent: str) -> None:
    # 1. Update Redis session
    update_redis_session(call_id, {"intent": intent})

    # 2. Update PostgreSQL call_log
    try:
        def _db_update():
            conn = psycopg2.connect(DATABASE_URL)
            cur = conn.cursor()
            cur.execute(
                "UPDATE call_logs SET intent = %s WHERE exotel_call_sid = %s",
                (intent, call_id),
            )
            conn.commit()
            cur.close()
            conn.close()
            logger.info(f"Updated PostgreSQL call log {call_id} intent to: {intent}")

        await asyncio.to_thread(_db_update)
    except Exception as e:
        logger.error(f"Failed to update PostgreSQL call log intent: {e}")


def format_date_for_speech(date_str: str) -> str:
    if not date_str:
        return "July 15th"
    try:
        from datetime import datetime
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        day = dt.day
        if 11 <= day <= 13:
            suffix = "th"
        else:
            suffix = {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
        month_name = dt.strftime("%B")
        return f"{month_name} {day}{suffix}"
    except Exception:
        return date_str


async def send_otp_sms(otp: int, phone: str) -> None:
    # Fetch credentials
    fast2sms_key = os.getenv("FAST2SMS_API_KEY")
    msg91_key = os.getenv("MSG91_AUTH_KEY")
    msg91_template = os.getenv("MSG91_TEMPLATE_ID")
    
    clean_phone = phone.lstrip("+").lstrip("91")
    logger.info(f"[SMS] Attempting to send OTP {otp} to {phone}")
    
    import httpx
    async with httpx.AsyncClient() as client:
        try:
            if fast2sms_key:
                logger.info("Sending OTP via Fast2SMS...")
                url = "https://www.fast2sms.com/dev/bulkV2"
                params = {
                    "authorization": fast2sms_key,
                    "route": "otp",
                    "variables_values": str(otp),
                    "numbers": clean_phone
                }
                res = await client.get(url, params=params)
                logger.info(f"Fast2SMS Response: {res.status_code} - {res.text}")
            elif msg91_key and msg91_template:
                logger.info("Sending OTP via MSG91...")
                url = "https://control.msg91.com/api/v5/otp"
                headers = {
                    "authkey": msg91_key,
                    "Content-Type": "application/json"
                }
                body = {
                    "template_id": msg91_template,
                    "mobile": f"91{clean_phone}",
                    "otp": str(otp)
                }
                res = await client.post(url, json=body, headers=headers)
                logger.info(f"MSG91 Response: {res.status_code} - {res.text}")
            else:
                logger.warning(f"[SMS MOCK] No Fast2SMS or MSG91 keys configured. Mock sending OTP {otp} to registered number {phone}.")
        except Exception as e:
            logger.error(f"Failed to send OTP via SMS provider: {e}")


# ─────────────────────────── Intent Classifier ────────────────
async def classify_utterance_intent(utterance: str, school_name: str) -> str:
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        classify_prompt = f"""You are an intent classifier for a school receptionist voice call at {school_name}.
Classify the following parent utterance into exactly one of these categories:
- general_faq (school timings, holidays, admissions, calendar, rules, syllabus, and general school information)
- attendance_query (when asking about their child's attendance, presence, or absence)
- fee_query (when asking about fee details, dues, payments, or structure)
- human_transfer (when the parent explicitly asks to connect or speak to human staff, receptionist, principal, teacher, or office personnel)
- unknown (greetings, general conversational fillers like "yes", "no", "ok", "who is this", or anything else)

Utterance: "{utterance}"

Respond with ONLY the category name. Do not include any other text or punctuation."""

        response = await asyncio.to_thread(model.generate_content, classify_prompt)
        intent = response.text.strip().lower()
        
        for option in ["general_faq", "attendance_query", "fee_query", "human_transfer", "unknown"]:
            if option in intent:
                return option
        return "unknown"
    except Exception as e:
        logger.error(f"Error classifying intent: {e}")
        return "unknown"


# ─────────────────────────── Tools ───────────────────────────
class SchoolVoiceAgentTools:
    """Tools exposed to the agent for parent verification."""
    def __init__(self, school_id: str, caller_phone: str, call_id: str):
        self.school_id = school_id
        self.caller_phone = caller_phone
        self.call_id = call_id
        self.agent = None

    def _get_redis_session(self) -> dict:
        return get_redis_session(self.call_id)

    @llm.function_tool(description="Verify parent identity using the child's roll number.")
    async def verify_roll_number(
        self,
        roll_number: Annotated[str, Field(description="The roll number of the student to verify identity.")]
    ) -> str:
        """Query the database to check if a student with the given roll number exists for this school."""
        try:
            logger.info(f"Verifying roll number: {roll_number} for school: {self.school_id}")
            def _db_query():
                conn = psycopg2.connect(DATABASE_URL)
                cur = conn.cursor()
                cur.execute(
                    "SELECT id, name, parent_phone, parent_name, class_name, section FROM students WHERE school_id = %s AND roll_number = %s",
                    (self.school_id, roll_number),
                )
                row = cur.fetchone()
                cur.close()
                conn.close()
                return row

            row = await asyncio.to_thread(_db_query)
            
            if row:
                student_id, student_name, parent_phone, parent_name, class_name, section = row
                class_str = f"{class_name}-{section}" if (class_name and section) else (class_name or "N/A")
                update_redis_session(self.call_id, {
                    "authenticated": True,
                    "student_id": str(student_id),
                    "student_name": student_name,
                    "parent_name": parent_name if parent_name else "Unknown Parent",
                    "class_name": class_str,
                })
                logger.info(f"Verification successful: {student_name}")
                
                # Update agent instructions to reflect authenticated status
                if self.agent:
                    school = get_school_info(self.school_id)
                    notices = get_school_notices(self.school_id)
                    school_info_str = f"- Phone: {school['phone'] or 'N/A'}"
                    new_prompt = build_system_prompt(
                        school["name"], 
                        school_info_str, 
                        notices, 
                        authenticated=True, 
                        student_name=student_name
                    )
                    await self.agent.update_instructions(new_prompt)
                    logger.info("Dynamically updated agent instructions to Authenticated")

                return f"Verification successful. The parent of {student_name} is now authenticated."
            else:
                logger.warning(f"Verification failed: no student with roll number {roll_number}")
                return "Verification failed. No student found with that roll number in this school."
        except Exception as e:
            logger.error(f"Error verifying roll number: {e}")
            return f"Error during verification: {str(e)}"

    @llm.function_tool(description="Get the student's attendance records for the current month. Caller must be authenticated first.")
    async def get_attendance_status(self) -> str:
        """Fetch attendance information for the verified student using the ERP adapter."""
        try:
            session_data = self._get_redis_session()
            if not session_data.get("authenticated", False):
                return "You must authenticate the parent by calling verify_roll_number before fetching attendance."
            
            student_id = session_data.get("student_id")
            if not student_id:
                return "No verified student ID found in session."
                
            from services.erp_adapter import get_erp_adapter
            adapter = get_erp_adapter(self.school_id)
            att = await adapter.get_attendance(student_id, self.school_id)
            
            if not att or not att.get("student_name"):
                return "Could not find attendance record for this student."
                
            return (
                f"For {att['student_name']}, the attendance for {att['month']} is "
                f"{att['present_days']} present days out of {att['total_days']} total school days, "
                f"which is {att['percentage']}%."
            )
        except Exception as e:
            logger.error(f"Error in get_attendance_status tool: {e}")
            return f"Error fetching attendance: {str(e)}"

    @llm.function_tool(description="Get the student's fee status, dues, and payment info. Caller must be authenticated first.")
    async def get_fee_status(self) -> str:
        """Fetch fee status and balance details for the verified student using the ERP adapter."""
        try:
            session_data = self._get_redis_session()
            if not session_data.get("authenticated", False):
                return "You must authenticate the parent by calling verify_roll_number before fetching fee details."
            
            student_id = session_data.get("student_id")
            if not student_id:
                return "No verified student ID found in session."
                
            from services.erp_adapter import get_erp_adapter
            adapter = get_erp_adapter(self.school_id)
            fee = await adapter.get_fee_status(student_id, self.school_id)
            
            if not fee or not fee.get("student_name"):
                return "Could not find fee status for this student."
                
            due = fee['amount_due']
            paid = fee['amount_paid']
            balance = due - paid
            status_str = fee['status']
            due_date = fee['due_date']
            
            response = f"For {fee['student_name']}, the total fee due is {due} rupees and {paid} rupees has been paid. "
            if status_str == "paid":
                response += "The fees are fully paid."
            elif status_str == "overdue":
                response += f"The payment is overdue. A balance of {balance} rupees was due on {due_date}."
            elif status_str == "partial":
                response += f"The payment is partially done. The remaining balance of {balance} rupees is due on {due_date}."
            else:
                response += f"The payment status is pending. A balance of {balance} rupees is due on {due_date}."
                
            return response
        except Exception as e:
            logger.error(f"Error in get_fee_status tool: {e}")
            return f"Error fetching fee status: {str(e)}"


# ─────────────────────── System Prompt Builder ────────────────
def build_system_prompt(
    school_name: str, school_info: str, notices: list[str], authenticated: bool, student_name: str | None = None
) -> str:
    notices_text = ""
    if notices:
        notices_text = (
            "\n\nRecent School Notices:\n" + "\n".join(f"- {n}" for n in notices)
        )
        
    auth_status = f"Authenticated as parent of student: {student_name}" if (authenticated and student_name) else "NOT Authenticated"

    return f"""You are a helpful voice assistant for {school_name} school.
You speak in a warm, professional tone like a school receptionist.

CRITICAL RULES:
- Keep ALL responses under 2-3 short sentences. This is a PHONE CALL.
- Keep sentences extremely short and punchy (around 5-10 words per sentence). This minimizes TTS generation delay.
- Never use complex or compound sentences. Always write in simple, separate clauses.
- Never use bullet points, numbered lists, or formatting.
- Speak naturally, conversationally.
- If you don't know something, say "Let me connect you to our office staff."
- For sensitive info (attendance, fees, results), first verify the parent's identity.
  Ask: "For security, can you tell me your child's roll number?"
  If they provide it, use the `verify_roll_number` tool to authenticate them.
  Only answer queries about attendance, fees, or results if the caller is Authenticated.

Caller Authentication Status: {auth_status}

School Information:
- School Name: {school_name}
{school_info}{notices_text}

Start by greeting the caller warmly and asking how you can help them today.
"""


# ─────────────────────── Custom SchoolVoiceAgent ────────────────
class SchoolVoiceAgent(Agent):
    def __init__(self, school_id: str, school_name: str, call_id: str, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.school_id = school_id
        self.school_name = school_name
        self.call_id = call_id
        from services.knowledge_base import KnowledgeBaseService
        self.kb_service = KnowledgeBaseService()

    async def on_user_turn_completed(self, turn_ctx: llm.ChatContext, new_message: llm.ChatMessage) -> None:
        user_question = new_message.text_content
        logger.info(f"on_user_turn_completed called: '{user_question}'")
        
        if not user_question or not user_question.strip():
            return

        session_data = get_redis_session(self.call_id)
        authenticated = session_data.get("authenticated", False)
        otp_verified = session_data.get("otp_verified", False)
        student_id = session_data.get("student_id")
        student_name = session_data.get("student_name")
        caller_phone = session_data.get("caller") or session_data.get("caller_phone") or "unknown"

        # Check for OTP resend request
        if "resend" in user_question.lower() and "otp" in user_question.lower():
            otp = random.randint(1000, 9999)
            r = get_redis_client()
            r.setex(f"otp:{self.call_id}", 300, json.dumps({"otp": otp, "phone": caller_phone}))
            await send_otp_sms(otp, caller_phone)
            update_redis_session(self.call_id, {"awaiting_otp": True})
            self.session.say("I have resent the OTP to your registered mobile number. Please say the 4 digits.", add_to_chat_ctx=True)
            raise StopResponse()

        # State 1: Awaiting OTP
        if session_data.get("awaiting_otp", False):
            digits = "".join(re.findall(r"\d", user_question))
            logger.info(f"OTP Verification: received digits: '{digits}'")
            
            r = get_redis_client()
            stored_otp_data = r.get(f"otp:{self.call_id}")
            
            stored_otp = None
            if stored_otp_data:
                try:
                    otp_info = json.loads(stored_otp_data)
                    stored_otp = otp_info.get("otp")
                except Exception:
                    stored_otp = stored_otp_data
            
            if digits and stored_otp and digits == str(stored_otp):
                # OTP Verified successfully
                update_redis_session(self.call_id, {"otp_verified": True, "awaiting_otp": False})
                
                from services.erp_adapter import get_erp_adapter
                adapter = get_erp_adapter(self.school_id)
                fee = await adapter.get_fee_status(student_id, self.school_id)
                
                if fee and fee.get("student_name"):
                    due = fee.get("amount_due", 0.0)
                    paid = fee.get("amount_paid", 0.0)
                    pending = due - paid
                    due_date = fee.get("due_date", "July 15th")
                    due_date_spoken = format_date_for_speech(due_date)
                    
                    if pending <= 0:
                        response_text = f"OTP verified successfully. {student_name}'s fees are fully paid for the term."
                    else:
                        response_text = f"OTP verified successfully. {student_name}'s pending fee amount is ₹{int(pending):,} for Term 2, due on {due_date_spoken}."
                else:
                    response_text = "OTP verified successfully. However, I could not retrieve fee details from our database."
                
                self.session.say(response_text, add_to_chat_ctx=True)
            else:
                self.session.say("Sorry, that OTP is incorrect or has expired. Please repeat the 4 digits, or ask me to resend the OTP.", add_to_chat_ctx=True)
            
            raise StopResponse()

        # State 2: Awaiting manual Roll Number
        if session_data.get("awaiting_roll_number", False):
            roll_number = user_question.strip().replace(".", "").replace(" ", "")
            logger.info(f"Roll Number Verification: checking '{roll_number}' for school: {self.school_id}")
            
            def _db_query():
                conn = psycopg2.connect(DATABASE_URL)
                cur = conn.cursor()
                cur.execute(
                    "SELECT id, name, parent_phone, parent_name, class_name, section FROM students WHERE school_id = %s AND roll_number = %s",
                    (self.school_id, roll_number),
                )
                row = cur.fetchone()
                cur.close()
                conn.close()
                return row

            row = await asyncio.to_thread(_db_query)
            
            if row:
                student_id, student_name, parent_phone, parent_name, class_name, section = row
                class_str = f"{class_name}-{section}" if (class_name and section) else (class_name or "N/A")
                update_redis_session(self.call_id, {
                    "authenticated": True,
                    "awaiting_roll_number": False,
                    "student_id": str(student_id),
                    "student_name": student_name,
                    "parent_name": parent_name if parent_name else "Unknown Parent",
                    "class_name": class_str,
                })
                logger.info(f"Manual authentication successful for student: {student_name}")
                
                # Update agent instructions dynamically
                school = get_school_info(self.school_id)
                notices = get_school_notices(self.school_id)
                school_info_str = f"- Phone: {school['phone'] or 'N/A'}"
                new_prompt = build_system_prompt(
                    school["name"], 
                    school_info_str, 
                    notices, 
                    authenticated=True, 
                    student_name=student_name
                )
                await self.update_instructions(new_prompt)

                # Fetch and respond with attendance
                from services.erp_adapter import get_erp_adapter
                adapter = get_erp_adapter(self.school_id)
                att = await adapter.get_attendance(str(student_id), self.school_id)
                
                if att and att.get("student_name"):
                    percentage = int(round(att.get("percentage", 0.0)))
                    response_text = f"Roll number verified successfully. {student_name}'s attendance for June is {percentage}%. He was present {att.get('present_days')} out of {att.get('total_days')} days."
                else:
                    response_text = f"Roll number verified successfully. Parent of {student_name} is authenticated."
                
                self.session.say(response_text, add_to_chat_ctx=True)
            else:
                self.session.say("I'm sorry, I couldn't find any student with that roll number. Could you please say the roll number again?", add_to_chat_ctx=True)
            
            raise StopResponse()

        # 1. Classify intent
        intent = await classify_utterance_intent(user_question, self.school_name)
        logger.info(f"Utterance classified intent: {intent}")

        # Save intent to Redis and database
        call_id = self.call_id
        await save_call_intent(call_id, self.school_id, intent)

        # 2. Check for human transfer
        if intent == "human_transfer":
            logger.info("Handoff requested. Initiating transfer and closing session.")
            handle = self.session.say("Sure, let me transfer your call to our office staff. Please hold on.")
            
            async def do_transfer():
                try:
                    await handle.wait_for_playout()
                except Exception as e:
                    logger.error(f"Error waiting for playout: {e}")
                finally:
                    await self.session.aclose()
            
            asyncio.create_task(do_transfer())
            raise StopResponse()

        # 3. Intercept fee_query (Level 3 Auth)
        if intent == "fee_query":
            if not otp_verified:
                otp = random.randint(1000, 9999)
                r = get_redis_client()
                r.setex(f"otp:{self.call_id}", 300, json.dumps({"otp": otp, "phone": caller_phone}))
                await send_otp_sms(otp, caller_phone)
                update_redis_session(self.call_id, {"awaiting_otp": True})
                self.session.say("For security, I'm sending an OTP to your registered number. Please say the 4 digits.", add_to_chat_ctx=True)
            else:
                from services.erp_adapter import get_erp_adapter
                adapter = get_erp_adapter(self.school_id)
                fee = await adapter.get_fee_status(student_id, self.school_id)
                if fee and fee.get("student_name"):
                    due = fee.get("amount_due", 0.0)
                    paid = fee.get("amount_paid", 0.0)
                    pending = due - paid
                    due_date = fee.get("due_date", "July 15th")
                    due_date_spoken = format_date_for_speech(due_date)
                    if pending <= 0:
                        response_text = f"{student_name}'s fees are fully paid for the term."
                    else:
                        response_text = f"{student_name}'s pending fee amount is ₹{int(pending):,} for Term 2, due on {due_date_spoken}."
                else:
                    response_text = "I couldn't find fee records in our database."
                self.session.say(response_text, add_to_chat_ctx=True)
            raise StopResponse()

        # 4. Intercept attendance_query (Level 2 Auth)
        if intent == "attendance_query":
            if not authenticated:
                update_redis_session(self.call_id, {"awaiting_roll_number": True})
                self.session.say("I couldn't find your number in our records. Can you tell me your child's roll number to proceed?", add_to_chat_ctx=True)
            else:
                from services.erp_adapter import get_erp_adapter
                adapter = get_erp_adapter(self.school_id)
                att = await adapter.get_attendance(student_id, self.school_id)
                if att and att.get("student_name"):
                    percentage = int(round(att.get("percentage", 0.0)))
                    response_text = f"{student_name}'s attendance for June is {percentage}%. He was present {att.get('present_days')} out of {att.get('total_days')} days."
                else:
                    response_text = "I couldn't find attendance records in our database."
                self.session.say(response_text, add_to_chat_ctx=True)
            raise StopResponse()

        # 5. Check if it's a greeting/filler or a real question
        is_greeting_or_short = len(user_question.split()) < 3 and any(
            w in user_question.lower() 
            for w in ["hi", "hello", "hey", "yes", "no", "okay", "ok", "namaste", "good morning", "good afternoon", "child", "student"]
        )

        if not is_greeting_or_short:
            logger.info(f"Performing RAG search in knowledge base for: '{user_question}'")
            
            try:
                self.session.say("Just a second, let me check that for you.", add_to_chat_ctx=False)
            except Exception as e:
                logger.error(f"Failed to play filler word: {e}")
                
            relevant_chunks = await self.kb_service.search(query=user_question, school_id=self.school_id, top_k=3)
            logger.info(f"Found {len(relevant_chunks)} relevant chunks")
            
            if relevant_chunks:
                context_text = "\n\n".join(relevant_chunks)
                injected_prompt = f"""Use the following school information to answer the parent's question.
If the answer isn't in this context, say you'll connect them to the office.

Context:
{context_text}

Parent's question: {user_question}"""
                
                # Update the new_message content with the injected RAG context
                new_message.content = [injected_prompt]


# ─────────────────────── Agent Entry Point ────────────────────


async def entrypoint(ctx: JobContext):
    """
    Called when a participant joins the LiveKit room.
    Sets up the voice pipeline and starts the conversation.
    """
    logger.info(f"Agent entrypoint called for room: {ctx.room.name}")

    # Try to extract school_id and auth status from room metadata
    school_id = None
    school = None
    authenticated = False
    student_name = None

    room_metadata = ctx.room.metadata
    if room_metadata:
        try:
            meta = json.loads(room_metadata)
            school_id = meta.get("school_id")
            authenticated = meta.get("authenticated", False)
            student_name = meta.get("student_name")
        except (json.JSONDecodeError, TypeError):
            pass

    call_id = ctx.room.name

    # Check/fetch fallback from Redis session
    try:
        r = get_redis_client()
        raw = None
        for key in call_session_keys(call_id):
            raw = r.get(key)
            if raw:
                break
        if raw:
            data = json.loads(raw)
            if not school_id:
                school_id = data.get("school_id")
            if not authenticated:
                authenticated = data.get("authenticated", False)
            if not student_name:
                student_name = data.get("student_name")
    except Exception as e:
        logger.error(f"Failed to fetch fallback from Redis: {e}")

    # Fetch school from DB
    if school_id:
        school = get_school_info(school_id)
    if not school:
        school = get_default_school()

    if not school:
        logger.error("No school found in database. Cannot start agent.")
        return

    school_id = school["id"]
    school_name = school["name"]

    # Get recent notices for context
    notices = get_school_notices(school_id)

    # Build info string
    school_info_str = f"- Phone: {school['phone'] or 'N/A'}"

    system_prompt = build_system_prompt(school_name, school_info_str, notices, authenticated, student_name)
    logger.info(f"Agent configured for school: {school_name}")

    # Wait for a participant to connect
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    participant = await ctx.wait_for_participant()
    caller_identity = participant.identity or "unknown"

    # Update session in Redis (using merge/update so we don't wipe out router data)
    update_redis_session(call_id, {
        "school_id": school_id,
        "caller": caller_identity,
        "status": "active",
    })
    logger.info(f"Call started: {call_id} from {caller_identity}")

    # Create tools context
    kb_tools = SchoolVoiceAgentTools(school_id, caller_phone=caller_identity, call_id=call_id)

    # Create the agent with all components
    agent = SchoolVoiceAgent(
        school_id=school_id,
        school_name=school_name,
        call_id=call_id,
        instructions=system_prompt,
        stt=deepgram.STT(
            api_key=DEEPGRAM_API_KEY,
            language="hi",
            model="nova-2",
        ),
        llm=google.LLM(
            model="gemini-2.5-flash",
            api_key=GEMINI_API_KEY,
        ),
        tts=tts.StreamAdapter(
            tts=SarvamTTS(
                api_key=SARVAM_API_KEY,
                language_code="hi-IN",
                speaker="shreya",
                sample_rate=8000,
            ),
            text_pacing=True,
        ),
        vad=silero.VAD.load(),
        tools=[
            kb_tools.verify_roll_number,
            kb_tools.get_attendance_status,
            kb_tools.get_fee_status,
        ],
    )

    # Associate agent reference with tools context
    kb_tools.agent = agent

    session = AgentSession()

    @session.on("close")
    def on_close():
        cleanup_call_session(call_id)
        logger.info(f"Call ended: {call_id}")

    # Start the session — v1.5.x API: room is passed directly, no participant param
    await session.start(
        agent=agent,
        room=ctx.room,
    )

    logger.info(f"Voice agent session started for {school_name}")
    welcome_text = f"Hello, welcome to {school_name}. How can I help you today?"
    session.say(welcome_text, add_to_chat_ctx=True)


# ─────────────────────── Main ─────────────────────────────────

if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="school-voice-agent",
            api_key=LIVEKIT_API_KEY,
            api_secret=LIVEKIT_API_SECRET,
            ws_url=LIVEKIT_URL,
        ),
    )
