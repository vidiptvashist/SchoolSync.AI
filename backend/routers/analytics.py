from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, case, distinct
from typing import Optional, List
from datetime import datetime, timedelta, time
import json
import redis
import logging

from database import get_db
from models.user import User
from models.call_log import CallLog
from models.campaign import Campaign
from models.student import Student
from models.chat_session import ChatSession
from models.chat_message import ChatMessage
from core.dependencies import get_current_user
from routers.chat import auto_close_stale_sessions
from settings import REDIS_URL

logger = logging.getLogger("analytics_router")

router = APIRouter(prefix="/analytics", tags=["Analytics"])

# Establish connection to Redis for caching
try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
except Exception as e:
    logger.error(f"Failed to connect to Redis for analytics caching: {e}")
    redis_client = None

INTENT_LABELS = {
    "fee_query": "Fee Queries",
    "attendance_query": "Attendance Queries",
    "general_faq": "General FAQ",
    "human_transfer": "Human Transfer",
    "unknown": "Unknown/Other"
}

@router.get("/overview")
async def get_overview(
    date_from: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    date_to: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns an aggregated analytics overview of inbound and outbound call logs
    for the current user's school. Results are cached in Redis for 5 minutes.
    """
    # 1. Parse date parameters and establish default range (last 30 days)
    try:
        if date_to:
            dt_to = datetime.combine(datetime.strptime(date_to, "%Y-%m-%d").date(), time(23, 59, 59))
        else:
            dt_to = datetime.combine(datetime.now().date(), time(23, 59, 59))
            
        if date_from:
            dt_from = datetime.combine(datetime.strptime(date_from, "%Y-%m-%d").date(), time(0, 0, 0))
        else:
            dt_from = datetime.combine((dt_to - timedelta(days=30)).date(), time(0, 0, 0))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Please use YYYY-MM-DD."
        )

    date_from_str = dt_from.strftime("%Y-%m-%d")
    date_to_str = dt_to.strftime("%Y-%m-%d")
    
    # 2. Attempt to serve from Redis Cache (Bypassed in local/dev to ensure real-time updates)
    cache_key = f"analytics:{current_user.school_id}:{date_from_str}:{date_to_str}"
    if False and redis_client:
        try:
            cached_val = redis_client.get(cache_key)
            if cached_val:
                logger.info(f"Analytics Cache HIT for key: {cache_key}")
                return json.loads(cached_val)
        except Exception as e:
            logger.error(f"Redis cache check failed: {e}")

    logger.info(f"Analytics Cache BYPASSED/MISS for key: {cache_key}. Executing live DB queries...")

    # 3. Query main statistics using aggregation
    metrics_query = select(
        func.count(CallLog.id).label("total_calls"),
        func.sum(case((CallLog.direction == "inbound", 1), else_=0)).label("inbound_calls"),
        func.sum(case((CallLog.direction == "outbound", 1), else_=0)).label("outbound_calls"),
        func.sum(case((CallLog.status == "answered", 1), else_=0)).label("answered_calls"),
        func.coalesce(func.avg(CallLog.duration_seconds), 0).label("avg_duration"),
        func.count(distinct(CallLog.caller_phone)).label("unique_callers")
    ).filter(
        CallLog.school_id == current_user.school_id,
        CallLog.created_at >= dt_from,
        CallLog.created_at <= dt_to
    )
    
    metrics_result = await db.execute(metrics_query)
    metrics = metrics_result.first()
    
    total_calls = metrics.total_calls or 0
    inbound_calls = metrics.inbound_calls or 0
    outbound_calls = metrics.outbound_calls or 0
    answered_calls = metrics.answered_calls or 0
    missed_calls = total_calls - answered_calls
    call_success_rate = round((answered_calls / total_calls) * 100, 1) if total_calls > 0 else 0.0
    average_duration_seconds = int(round(metrics.avg_duration or 0))
    unique_callers = metrics.unique_callers or 0

    # 4. Query Top Intents
    intents_query = select(
        CallLog.intent,
        func.count(CallLog.id).label("count")
    ).filter(
        CallLog.school_id == current_user.school_id,
        CallLog.created_at >= dt_from,
        CallLog.created_at <= dt_to,
        CallLog.intent.isnot(None),
        CallLog.intent != ""
    ).group_by(
        CallLog.intent
    ).order_by(
        func.count(CallLog.id).desc()
    )
    
    intents_result = await db.execute(intents_query)
    top_intents = [
        {
            "intent": row.intent,
            "count": row.count,
            "label": INTENT_LABELS.get(row.intent, row.intent.replace("_", " ").title())
        }
        for row in intents_result.all()
    ]

    # 5. Query Calls by Day (grouped by date of created_at)
    by_day_query = select(
        func.date(CallLog.created_at).label("day"),
        func.sum(case((CallLog.direction == "inbound", 1), else_=0)).label("inbound"),
        func.sum(case((CallLog.direction == "outbound", 1), else_=0)).label("outbound")
    ).filter(
        CallLog.school_id == current_user.school_id,
        CallLog.created_at >= dt_from,
        CallLog.created_at <= dt_to
    ).group_by(
        func.date(CallLog.created_at)
    ).order_by(
        func.date(CallLog.created_at).asc()
    )
    
    by_day_result = await db.execute(by_day_query)
    calls_by_day = [
        {
            "date": row.day.strftime("%Y-%m-%d") if hasattr(row.day, "strftime") else str(row.day),
            "inbound": int(row.inbound or 0),
            "outbound": int(row.outbound or 0)
        }
        for row in by_day_result.all()
    ]

    # 6. Query Campaign Stats
    campaign_query = select(
        Campaign.name,
        Campaign.created_at,
        func.count(CallLog.id).label("total"),
        func.sum(case((CallLog.status == "answered", 1), else_=0)).label("answered")
    ).join(
        Campaign, Campaign.id == CallLog.campaign_id
    ).filter(
        CallLog.school_id == current_user.school_id,
        CallLog.created_at >= dt_from,
        CallLog.created_at <= dt_to
    ).group_by(
        Campaign.id, Campaign.name, Campaign.created_at
    ).order_by(
        func.count(CallLog.id).desc()
    )
    
    campaign_result = await db.execute(campaign_query)
    campaign_stats = [
        {
            "campaign_name": row.name or "Unnamed Campaign",
            "total": row.total or 0,
            "answered": row.answered or 0,
            "rate": round(((row.answered or 0) / (row.total or 1)) * 100, 1) if row.total else 0.0,
            "date": row.created_at.strftime("%Y-%m-%d") if row.created_at else None
        }
        for row in campaign_result.all()
    ]

    # 6.5 Query Chat statistics
    if current_user.school_id:
        await auto_close_stale_sessions(current_user.school_id, db)

    chat_metrics_query = select(
        func.count(ChatSession.id).label("total_sessions"),
        func.sum(case((ChatSession.status == "active", 1), else_=0)).label("active_sessions"),
        func.coalesce(func.avg(ChatSession.message_count), 0).label("avg_messages")
    ).filter(
        ChatSession.school_id == current_user.school_id,
        ChatSession.started_at >= dt_from,
        ChatSession.started_at <= dt_to
    )
    chat_metrics_res = await db.execute(chat_metrics_query)
    chat_metrics = chat_metrics_res.first()
    
    total_sessions = chat_metrics.total_sessions or 0
    active_sessions = chat_metrics.active_sessions or 0
    avg_messages_per_session = float(round(chat_metrics.avg_messages or 0.0, 1))

    chat_intents_query = select(
        ChatMessage.intent,
        func.count(ChatMessage.id).label("count")
    ).filter(
        ChatMessage.school_id == current_user.school_id,
        ChatMessage.created_at >= dt_from,
        ChatMessage.created_at <= dt_to,
        ChatMessage.intent.isnot(None),
        ChatMessage.intent != "",
        ChatMessage.intent != "unknown"
    ).group_by(
        ChatMessage.intent
    ).order_by(
        func.count(ChatMessage.id).desc()
    )
    chat_intents_res = await db.execute(chat_intents_query)
    top_chat_intents = [
        {
            "intent": row.intent,
            "count": row.count,
            "label": INTENT_LABELS.get(row.intent, row.intent.replace("_", " ").title())
        }
        for row in chat_intents_res.all()
    ]

    # 7. Compile Response Payload
    response_payload = {
        "total_calls": total_calls,
        "inbound_calls": inbound_calls,
        "outbound_calls": outbound_calls,
        "answered_calls": answered_calls,
        "missed_calls": missed_calls,
        "call_success_rate": call_success_rate,
        "average_duration_seconds": average_duration_seconds,
        "unique_callers": unique_callers,
        "top_intents": top_intents,
        "calls_by_day": calls_by_day,
        "campaign_stats": campaign_stats,
        "chat_stats": {
            "total_sessions": total_sessions,
            "active_sessions": active_sessions,
            "avg_messages_per_session": avg_messages_per_session,
            "top_chat_intents": top_chat_intents
        }
    }

    # 8. Store in Redis Cache for 5 minutes (300 seconds)
    if redis_client:
        try:
            redis_client.setex(cache_key, 300, json.dumps(response_payload))
            logger.info(f"Cached analytics overview under key: {cache_key}")
        except Exception as e:
            logger.error(f"Failed to cache analytics result in Redis: {e}")

    return response_payload


@router.get("/dashboard-kpis")
async def get_dashboard_kpis(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns simplified KPI summary metrics for the main school dashboard:
    - Total Students
    - Calls Today
    - Active Campaigns
    - Success Rate
    """
    # 1. Query Total Students
    students_query = select(func.count(Student.id)).filter(Student.school_id == current_user.school_id)
    students_result = await db.execute(students_query)
    total_students = students_result.scalar() or 0

    # 2. Query Calls Today (midnight today to end of today)
    today_start = datetime.combine(datetime.now().date(), time(0, 0, 0))
    today_end = datetime.combine(datetime.now().date(), time(23, 59, 59))
    
    calls_today_query = select(func.count(CallLog.id)).filter(
        CallLog.school_id == current_user.school_id,
        CallLog.created_at >= today_start,
        CallLog.created_at <= today_end
    )
    calls_today_result = await db.execute(calls_today_query)
    calls_today = calls_today_result.scalar() or 0

    # 3. Query Active Campaigns (status is 'running')
    active_campaigns_query = select(func.count(Campaign.id)).filter(
        Campaign.school_id == current_user.school_id,
        Campaign.status == "running"
    )
    active_campaigns_result = await db.execute(active_campaigns_query)
    active_campaigns = active_campaigns_result.scalar() or 0

    # 4. Success Rate (overall rate of answered calls)
    overall_calls_query = select(
        func.count(CallLog.id).label("total"),
        func.sum(case((CallLog.status == "answered", 1), else_=0)).label("answered")
    ).filter(CallLog.school_id == current_user.school_id)
    
    overall_result = await db.execute(overall_calls_query)
    overall_metrics = overall_result.first()
    
    total_calls = overall_metrics.total or 0
    answered_calls = overall_metrics.answered or 0
    success_rate = round((answered_calls / total_calls) * 100, 1) if total_calls > 0 else 0.0

    return {
        "total_students": total_students,
        "calls_today": calls_today,
        "active_campaigns": active_campaigns,
        "success_rate": f"{success_rate}%"
    }
