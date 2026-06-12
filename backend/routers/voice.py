from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import json
from datetime import datetime, timezone
import logging

from database import get_db
from models.call_log import CallLog
from models.student import Student
from core.dependencies import get_current_user
from models.user import User

import redis

logger = logging.getLogger("voice")

router = APIRouter(
    prefix="/voice",
    tags=["Voice"]
)

# Redis setup (same as before)
REDIS_HOST = "localhost"
REDIS_PORT = 6379
CALL_SESSION_PREFIX = "call"
LEGACY_CALL_SESSION_PREFIX = "call_session"

def _get_redis():
    return redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)

def _parse_started_at(started_at_str: Optional[str]) -> Optional[datetime]:
    if not started_at_str:
        return None
    try:
        return datetime.fromisoformat(started_at_str)
    except ValueError:
        return None

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
