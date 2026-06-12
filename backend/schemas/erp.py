from pydantic import BaseModel
from uuid import UUID
from datetime import datetime, date
from typing import Optional

class AttendanceRecordOut(BaseModel):
    id: UUID
    school_id: UUID
    student_id: UUID
    month: str
    total_days: int
    present_days: int
    attendance_percentage: float
    updated_at: datetime

    class Config:
        from_attributes = True

class FeeRecordOut(BaseModel):
    id: UUID
    school_id: UUID
    student_id: UUID
    amount_due: float
    amount_paid: float
    due_date: date
    status: str
    description: Optional[str] = None

    class Config:
        from_attributes = True
