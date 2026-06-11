from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional

class CallLogBase(BaseModel):
    campaign_id: Optional[UUID] = None
    caller_phone: str
    direction: str
    status: str
    duration_seconds: Optional[int] = 0
    intent: Optional[str] = None
    summary: Optional[str] = None
    exotel_call_sid: Optional[str] = None

class CallLogCreate(CallLogBase):
    pass

class CallLogOut(CallLogBase):
    id: UUID
    school_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
