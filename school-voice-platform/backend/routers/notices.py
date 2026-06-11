from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID
import logging

from database import get_db, SessionLocal
from models.user import User
from models.notice import Notice
from schemas.notice import NoticeCreate, NoticeOut
from core.dependencies import get_current_user
from services.tts_service import TTSService

logger = logging.getLogger("notices_router")
router = APIRouter(prefix="/notices", tags=["Notices"])

# --- Background Task Helper ---

async def generate_notice_audio_bg(notice_id: UUID, text: str, school_id: UUID):
    """
    Background task to generate TTS audio and update the Notice status.
    Uses an independent db session to avoid closed session issues.
    """
    logger.info(f"Background audio generation started for notice {notice_id}")
    async with SessionLocal() as db:
        # Update status to generating
        await db.execute(
            select(Notice)
            .filter(Notice.id == notice_id)
        )
        await db.execute(
            Notice.__table__.update()
            .where(Notice.id == notice_id)
            .values(audio_status="generating")
        )
        await db.commit()
        
        try:
            tts = TTSService()
            relative_path = await tts.generate_audio(
                text=text,
                school_id=str(school_id),
                notice_id=str(notice_id)
            )
            
            # Update status to ready
            await db.execute(
                Notice.__table__.update()
                .where(Notice.id == notice_id)
                .values(audio_status="ready", audio_url=relative_path)
            )
            await db.commit()
            logger.info(f"Background audio generation succeeded for notice {notice_id}")
            
        except Exception as e:
            logger.error(f"Background audio generation failed for notice {notice_id}: {e}")
            await db.execute(
                Notice.__table__.update()
                .where(Notice.id == notice_id)
                .values(audio_status="failed")
            )
            await db.commit()

# --- Endpoints ---

@router.post("/", response_model=NoticeOut, status_code=status.HTTP_201_CREATED)
async def create_notice(
    request: NoticeCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a new notice and schedules TTS voice generation in the background.
    """
    new_notice = Notice(
        school_id=current_user.school_id,
        title=request.title,
        message=request.message,
        type=request.type or "general",
        audio_status="pending",
        created_by=current_user.id
    )
    db.add(new_notice)
    await db.commit()
    await db.refresh(new_notice)
    
    # Schedule TTS generation in the background task
    background_tasks.add_task(
        generate_notice_audio_bg,
        notice_id=new_notice.id,
        text=new_notice.message,
        school_id=current_user.school_id
    )
    
    return new_notice


@router.get("/", response_model=List[NoticeOut])
async def list_notices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lists all notices belonging to the current user's school.
    """
    result = await db.execute(
        select(Notice)
        .filter(Notice.school_id == current_user.school_id)
        .order_by(Notice.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{id}", response_model=NoticeOut)
async def get_notice(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves metadata for a single notice. Checks school ownership.
    """
    result = await db.execute(
        select(Notice)
        .filter(Notice.id == id, Notice.school_id == current_user.school_id)
    )
    notice = result.scalars().first()
    if not notice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notice not found"
        )
    return notice


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notice(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Deletes a notice. Checks school ownership.
    """
    result = await db.execute(
        select(Notice)
        .filter(Notice.id == id, Notice.school_id == current_user.school_id)
    )
    notice = result.scalars().first()
    if not notice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notice not found or permission denied"
        )
        
    await db.delete(notice)
    await db.commit()
    return None
