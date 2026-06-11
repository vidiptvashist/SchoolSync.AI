from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional

class SchoolBase(BaseModel):
    """Base fields shared between creation and retrieval"""
    name: str
    phone: Optional[str] = None
    exotel_number: Optional[str] = None

class SchoolCreate(SchoolBase):
    """Schema used when creating a new school"""
    pass

class SchoolOut(SchoolBase):
    """Schema used when sending school data back in API responses"""
    id: UUID
    created_at: datetime

    # Instructs Pydantic to read ORM objects (SQLAlchemy models)
    class Config:
        from_attributes = True
