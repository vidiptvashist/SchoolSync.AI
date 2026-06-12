from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any

class CampaignBase(BaseModel):
    notice_id: UUID
    name: Optional[str] = None
    target_type: Optional[str] = "all"
    target_filter: Optional[Dict[str, Any]] = None
    status: Optional[str] = "pending"
    total_calls: Optional[int] = 0
    answered_calls: Optional[int] = 0
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class CampaignCreate(BaseModel):
    notice_id: UUID
    name: Optional[str] = None
    target_type: Optional[str] = "all"
    target_filter: Optional[Dict[str, Any]] = None
    scheduled_at: Optional[datetime] = None

class CampaignOut(CampaignBase):
    id: UUID
    school_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
