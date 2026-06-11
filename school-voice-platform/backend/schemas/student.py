from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional

class StudentBase(BaseModel):
    name: str
    class_name: Optional[str] = None
    section: Optional[str] = None
    roll_number: Optional[str] = None
    parent_name: Optional[str] = None
    parent_phone: str

class StudentCreate(StudentBase):
    school_id: UUID

class StudentOut(StudentBase):
    id: UUID
    school_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
