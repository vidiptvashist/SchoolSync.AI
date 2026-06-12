from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID
import logging

from database import get_db
from models.user import User
from models.campaign import Campaign
from models.notice import Notice
from models.student import Student
from schemas.campaign import CampaignCreate, CampaignOut
from schemas.call_log import CallLogOut
from models.call_log import CallLog
from core.dependencies import get_current_user
from services.campaign_service import campaign_service

logger = logging.getLogger("campaigns_router")
router = APIRouter(prefix="/campaigns", tags=["Campaigns"])

# --- Helper to resolve target phone numbers ---

async def resolve_campaign_phones(db: AsyncSession, school_id: UUID, target_type: str, target_filter: dict) -> list[str]:
    """
    Queries the students table based on target_type and target_filter.
    Returns a de-duplicated list of parent phone numbers.
    """
    query = select(Student).filter(Student.school_id == school_id)
    
    if target_type == "class":
        class_name = target_filter.get("class_name")
        if not class_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="class_name is required in target_filter for target_type='class'"
            )
        query = query.filter(Student.class_name == class_name)
        
    elif target_type == "section":
        class_name = target_filter.get("class_name")
        section = target_filter.get("section")
        if not class_name or not section:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="class_name and section are required in target_filter for target_type='section'"
            )
        query = query.filter(Student.class_name == class_name, Student.section == section)
        
    result = await db.execute(query)
    students = result.scalars().all()
    
    # De-duplicate parent phone numbers
    phones = [s.parent_phone for s in students if s.parent_phone]
    return list(set(phones))

# --- Endpoints ---

@router.post("/", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    request: CampaignCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a new call campaign. Resolves parent phone numbers dynamically.
    If scheduled_at is null, triggers the campaign immediately.
    """
    # 1. Fetch and verify the notice
    notice_result = await db.execute(
        select(Notice).filter(Notice.id == request.notice_id, Notice.school_id == current_user.school_id)
    )
    notice = notice_result.scalars().first()
    if not notice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Linked notice not found"
        )
        
    # 2. Resolve targets
    target_filter = request.target_filter or {}
    phone_numbers = await resolve_campaign_phones(
        db=db,
        school_id=current_user.school_id,
        target_type=request.target_type or "all",
        target_filter=target_filter
    )
    
    # Store resolved phones inside the target_filter column
    updated_filter = {
        **target_filter,
        "resolved_phones": phone_numbers
    }
    
    # 3. Create the campaign row
    new_campaign = Campaign(
        school_id=current_user.school_id,
        notice_id=request.notice_id,
        name=request.name or f"Campaign for {notice.title}",
        target_type=request.target_type or "all",
        target_filter=updated_filter,
        status="pending",
        total_calls=len(phone_numbers),
        answered_calls=0,
        scheduled_at=request.scheduled_at
    )
    db.add(new_campaign)
    await db.commit()
    await db.refresh(new_campaign)
    
    # 4. Trigger immediately if not scheduled
    if not request.scheduled_at:
        # Enforce that the notice audio is ready
        if notice.audio_status != "ready" or not notice.audio_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot launch campaign immediately: Notice audio status is not 'ready'"
            )
            
        background_tasks.add_task(
            campaign_service.launch_bulk_campaign,
            phone_numbers=phone_numbers,
            audio_url=notice.audio_url,
            campaign_id=str(new_campaign.id),
            school_id=str(current_user.school_id)
        )
        
    return new_campaign


@router.get("/", response_model=List[CampaignOut])
async def list_campaigns(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lists all campaigns for the current user's school.
    """
    result = await db.execute(
        select(Campaign)
        .filter(Campaign.school_id == current_user.school_id)
        .order_by(Campaign.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{id}", response_model=CampaignOut)
async def get_campaign(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves details for a single campaign. Checks school ownership.
    """
    result = await db.execute(
        select(Campaign)
        .filter(Campaign.id == id, Campaign.school_id == current_user.school_id)
    )
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
    return campaign


@router.post("/{id}/launch", response_model=CampaignOut)
async def launch_campaign(
    id: UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually triggers / dispatches a pending campaign.
    """
    # 1. Fetch campaign
    campaign_result = await db.execute(
        select(Campaign).filter(Campaign.id == id, Campaign.school_id == current_user.school_id)
    )
    campaign = campaign_result.scalars().first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
        
    # 2. Check campaign status
    if campaign.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Campaign is already in status '{campaign.status}' and cannot be launched manually"
        )
        
    # 3. Fetch notice and check audio status
    notice_result = await db.execute(
        select(Notice).filter(Notice.id == campaign.notice_id, Notice.school_id == current_user.school_id)
    )
    notice = notice_result.scalars().first()
    if not notice or notice.audio_status != "ready" or not notice.audio_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Notice audio file is not ready. Cannot dispatch calls."
        )
        
    # 4. Resolve phone numbers from target_filter.resolved_phones
    target_filter = campaign.target_filter or {}
    phone_numbers = target_filter.get("resolved_phones", [])
    
    if not phone_numbers:
        # Re-resolve if empty for some reason
        phone_numbers = await resolve_campaign_phones(
            db=db,
            school_id=current_user.school_id,
            target_type=campaign.target_type,
            target_filter=target_filter
        )
        # Update campaign total calls
        campaign.total_calls = len(phone_numbers)
        target_filter["resolved_phones"] = phone_numbers
        campaign.target_filter = target_filter
        db.add(campaign)
        await db.commit()
        await db.refresh(campaign)
        
    if not phone_numbers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No target phone numbers resolved. Notice cannot be broadcasted."
        )
        
    # 5. Dispatch background calling
    background_tasks.add_task(
        campaign_service.launch_bulk_campaign,
        phone_numbers=phone_numbers,
        audio_url=notice.audio_url,
        campaign_id=str(campaign.id),
        school_id=str(current_user.school_id)
    )
    
    return campaign


@router.get("/{id}/logs", response_model=List[CallLogOut])
async def list_campaign_call_logs(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns all call logs associated with a specific campaign. Checks school ownership.
    """
    # Verify campaign ownership
    camp_result = await db.execute(
        select(Campaign).filter(Campaign.id == id, Campaign.school_id == current_user.school_id)
    )
    campaign = camp_result.scalars().first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
        
    result = await db.execute(
        select(CallLog)
        .filter(CallLog.campaign_id == id, CallLog.school_id == current_user.school_id)
        .order_by(CallLog.created_at.desc())
    )
    return result.scalars().all()


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Deletes a campaign. Checks school ownership.
    Associated call logs are preserved but updated to have campaign_id = NULL
    due to ForeignKey ondelete='SET NULL'.
    """
    result = await db.execute(
        select(Campaign).filter(Campaign.id == id, Campaign.school_id == current_user.school_id)
    )
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found"
        )
        
    await db.delete(campaign)
    await db.commit()
    return None
