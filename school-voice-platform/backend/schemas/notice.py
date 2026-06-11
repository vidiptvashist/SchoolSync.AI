from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional

class NoticeBase(BaseModel):
    title: str
    message: str
    type: Optional[str] = "general"
    audio_url: Optional[str] = None
    audio_status: Optional[str] = "pending"

class NoticeCreate(BaseModel):
    title: str
    message: str
    type: Optional[str] = "general"

class NoticeOut(NoticeBase):
    id: UUID
    school_id: UUID
    created_by: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True
